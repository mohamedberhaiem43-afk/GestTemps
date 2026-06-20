using ABRPOINT.Server.Data;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace ABRPOINT.Server.Authorization;

/// <summary>
/// Helper d'isolation PAR SITE (Sitcod) à l'intérieur d'un tenant.
///
/// Modèle métier : un utilisateur ne consulte/gère que les données des sites auxquels il est
/// rattaché via la table <c>Socuser</c> (Soccod, Uticod, Sitcod). SEUL l'administrateur
/// (Utiadm='1' ou rôle Administrator) a une visibilité globale sur tous les sites de la société.
/// Les autres profils (Responsable RH, Manager, employé) sont scopés à leurs sites.
///
/// Pas de cache mémoire ici (contrairement à <see cref="SoccodAccess"/>) : les requêtes sont
/// triviales et toujours bornées au DbContext (donc au tenant) courant.
/// </summary>
public static class SiteAccess
{
    public static string? CallerUticod(HttpContext? ctx) =>
        ctx?.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;

    /// <summary>Vrai si l'utilisateur voit tous les sites (admin global).</summary>
    public static async Task<bool> IsAdminAsync(ApplicationDbContext db, string uticod, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(uticod)) return false;
        var u = await db.Utilisateurs.AsNoTracking()
            .Where(x => x.Uticod == uticod)
            .Select(x => new { x.Utiadm, x.Utirole })
            .FirstOrDefaultAsync(ct);
        return u != null && (u.Utiadm == "1" || PermissionCatalog.IsAdminRole(u.Utirole));
    }

    /// <summary>Liste des Soccod accessibles à l'utilisateur. Admin → toutes les sociétés.</summary>
    public static async Task<List<string>> AccessibleSoccodsAsync(
        ApplicationDbContext db, string uticod, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(uticod)) return new List<string>();
        if (await IsAdminAsync(db, uticod, ct))
        {
            return await db.Societes.AsNoTracking()
                .Where(s => s.Soccod != null).Select(s => s.Soccod!).Distinct().ToListAsync(ct);
        }
        return await db.Socusers.AsNoTracking()
            .Where(s => s.Uticod == uticod && s.Soccod != null)
            .Select(s => s.Soccod!).Distinct().ToListAsync(ct);
    }

    /// <summary>
    /// Liste des Sitcod accessibles à l'utilisateur dans une société. Admin → tous les sites
    /// de la société ; sinon → les Sitcod de ses lignes Socuser.
    /// </summary>
    public static async Task<List<string>> AccessibleSitcodsAsync(
        ApplicationDbContext db, string soccod, string uticod, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(uticod)) return new List<string>();
        if (await IsAdminAsync(db, uticod, ct))
        {
            return (await db.Sites.AsNoTracking()
                    .Where(s => s.Soccod == soccod && s.Sitcod != null)
                    .Select(s => s.Sitcod!)
                    .Distinct()
                    .ToListAsync(ct));
        }

        return await db.Socusers.AsNoTracking()
            .Where(s => s.Soccod == soccod && s.Uticod == uticod && s.Sitcod != null)
            .Select(s => s.Sitcod!)
            .Distinct()
            .ToListAsync(ct);
    }

    /// <summary>
    /// Restreint une liste d'<paramref name="empcods"/> à ceux dont l'employé appartient à un
    /// site accessible au demandeur. Admin → liste inchangée. Empêche l'énumération d'employés
    /// d'autres sites via le paramètre <c>empcods</c> des endpoints d'états/rapports.
    /// </summary>
    public static async Task<List<string>> FilterEmpcodsByAccessAsync(
        ApplicationDbContext db, string soccod, string uticod, IEnumerable<string>? empcods, CancellationToken ct = default)
    {
        var requested = (empcods ?? Enumerable.Empty<string>())
            .Where(e => !string.IsNullOrWhiteSpace(e))
            .Distinct()
            .ToList();
        if (requested.Count == 0) return new List<string>();

        // Pas de caller authentifié (contexte de test / endpoint sans [Authorize]) → on ne
        // filtre pas. En production, [Authorize] garantit toujours un uticod.
        if (string.IsNullOrEmpty(uticod)) return requested;
        if (await IsAdminAsync(db, uticod, ct)) return requested;

        var sitcods = await AccessibleSitcodsAsync(db, soccod, uticod, ct);
        if (sitcods.Count == 0) return new List<string>();

        return await db.Employes.AsNoTracking()
            .Where(e => e.Soccod == soccod
                        && requested.Contains(e.Empcod)
                        && e.Sitcod != null
                        && sitcods.Contains(e.Sitcod))
            .Select(e => e.Empcod)
            .ToListAsync(ct);
    }

    /// <summary>
    /// Sentinelle renvoyée à un non-admin sans aucun employé accessible : code volontairement
    /// inexistant pour forcer un résultat VIDE (les repos d'états interprètent une liste vide
    /// comme « tous les employés » — on ne doit donc jamais leur passer une liste vide).
    /// </summary>
    public const string NoAccessSentinel = "__NO_SITE_ACCESS__";

    /// <summary>
    /// Calcule la liste d'empcods à effectivement passer aux états/rapports, en tenant compte
    /// de l'accès par site du demandeur :
    ///   - Admin → la requête est honorée telle quelle (liste vide = tous les employés).
    ///   - Non-admin → restreint aux employés de SES sites ; si la requête est vide (= « tous »),
    ///     on substitue tous SES employés ; jamais de liste vide renvoyée (sentinelle sinon).
    /// </summary>
    /// <summary>
    /// Contrôle d'accès MONO-EMPLOYÉ pour les endpoints prenant un <c>empcod</c> en route
    /// (fiche, contrat, états, soldes, rapports PDF…). Empêche l'IDOR/BOLA inter-site :
    ///   - Pas de caller authentifié (test / endpoint sans [Authorize]) → autorisé (cohérent
    ///     avec <see cref="ScopedEmpcodsAsync"/> / <see cref="FilterEmpcodsByAccessAsync"/>).
    ///   - <paramref name="allowSelf"/> (défaut true) → un utilisateur accède à SON propre
    ///     dossier (convention <c>Uticod == Empcod</c>). À passer <c>false</c> pour les
    ///     opérations de gestion destructives (un salarié ne supprime pas son propre solde).
    ///   - Admin global → toujours autorisé.
    ///   - Sinon → l'employé ciblé doit appartenir à un site accessible au demandeur (Socuser).
    /// Renvoie <c>false</c> si l'employé n'existe pas, n'a pas de site, ou est hors périmètre.
    /// </summary>
    public static async Task<bool> CallerCanAccessEmployeeAsync(
        ApplicationDbContext db, string soccod, string empcod, string? uticod,
        bool allowSelf = true, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(empcod)) return false;
        if (string.IsNullOrEmpty(uticod)) return true; // pas de caller (test) → ne pas bloquer
        if (allowSelf && string.Equals(uticod, empcod, StringComparison.OrdinalIgnoreCase))
            return true;
        if (await IsAdminAsync(db, uticod, ct)) return true;

        var sitcods = await AccessibleSitcodsAsync(db, soccod, uticod, ct);
        if (sitcods.Count == 0) return false;

        return await db.Employes.AsNoTracking()
            .AnyAsync(e => e.Soccod == soccod
                           && e.Empcod == empcod
                           && e.Sitcod != null
                           && sitcods.Contains(e.Sitcod), ct);
    }

    public static async Task<List<string>> ScopedEmpcodsAsync(
        ApplicationDbContext db, string soccod, string uticod, IEnumerable<string>? requested, CancellationToken ct = default)
    {
        var req = (requested ?? Enumerable.Empty<string>())
            .Where(e => !string.IsNullOrWhiteSpace(e))
            .Distinct()
            .ToList();

        // Pas de caller authentifié (test / endpoint sans [Authorize]) → pas de scoping.
        if (string.IsNullOrEmpty(uticod)) return req;
        if (await IsAdminAsync(db, uticod, ct)) return req;

        var sitcods = await AccessibleSitcodsAsync(db, soccod, uticod, ct);
        var accessible = sitcods.Count == 0
            ? new List<string>()
            : await db.Employes.AsNoTracking()
                .Where(e => e.Soccod == soccod && e.Sitcod != null && sitcods.Contains(e.Sitcod))
                .Select(e => e.Empcod)
                .ToListAsync(ct);

        var effective = req.Count == 0 ? accessible : req.Where(r => accessible.Contains(r)).ToList();
        if (effective.Count == 0) effective.Add(NoAccessSentinel);
        return effective;
    }
}
