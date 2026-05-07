using System.Linq.Expressions;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Helpers;

/// <summary>
/// Génère les prochains codes séquentiels (numériques zéro-paddés) pour les
/// entités de Données de Base (Direction, Service, Fonction, Pays, Ville).
///
/// Approche : on récupère la liste des codes existants pour le périmètre
/// (soccod si applicable), on filtre ceux qui sont purement numériques
/// (les codes alphabétiques type ISO "FRA"/"MAR" sont ignorés), on prend
/// MAX + 1 et on zero-pad à la largeur de la colonne.
///
/// Multi-tenant safe : chaque tenant ayant sa propre DB, le DbContext
/// fourni est déjà bound au tenant courant.
/// </summary>
public static class SequentialCodeGenerator
{
    // ⚠ IgnoreQueryFilters() est CRITIQUE : ApplicationDbContext applique un filtre global
    // soft-delete sur tous les BaseEntity (DeletedAt IS NULL). Sans ce bypass, le générateur
    // ne voit pas les lignes soft-deleted, propose un code dont la PK existe physiquement
    // en base, et l'INSERT explose en violation PK.
    public static Task<string> NextDirectionCodeAsync(ApplicationDbContext db, string soccod, CancellationToken ct = default)
        => NextAsync(db.Directions.IgnoreQueryFilters().Where(d => d.Soccod == soccod).Select(d => d.Dircod), width: 4, ct);

    public static Task<string> NextServiceCodeAsync(ApplicationDbContext db, string soccod, CancellationToken ct = default)
        => NextAsync(db.Services.IgnoreQueryFilters().Where(s => s.Soccod == soccod).Select(s => s.Sercod), width: 4, ct);

    public static Task<string> NextFonctionCodeAsync(ApplicationDbContext db, string soccod, CancellationToken ct = default)
        => NextAsync(db.Fonctions.IgnoreQueryFilters().Where(f => f.Soccod == soccod).Select(f => f.Foncod), width: 6, ct);

    public static Task<string> NextSectionCodeAsync(ApplicationDbContext db, string soccod, CancellationToken ct = default)
        => NextAsync(db.Sections.IgnoreQueryFilters().Where(s => s.Soccod == soccod).Select(s => s.Seccod), width: 4, ct);

    // ⚠ width: 2 OBLIGATOIRE — même si Poste.codposte est nvarchar(10), le code est aussi
    // référencé par Lcategorie.codposte / Categorie.codposte / Postemploye.codposte qui sont
    // en nvarchar(2). Un code à 4 chiffres y serait tronqué et l'INSERT renverrait
    // "String or binary data would be truncated" → 500 lors du save d'une classe horaire.
    public static Task<string> NextCodposteAsync(ApplicationDbContext db, string soccod, CancellationToken ct = default)
        => NextAsync(db.Postes.IgnoreQueryFilters().Where(p => p.Soccod == soccod).Select(p => p.Codposte), width: 2, ct);

    public static Task<string> NextCatcodAsync(ApplicationDbContext db, string soccod, CancellationToken ct = default)
        => NextAsync(db.Lcategories.IgnoreQueryFilters().Where(l => l.Soccod == soccod).Select(l => l.Catcod), width: 2, ct);

    public static Task<string> NextAbscodAsync(ApplicationDbContext db, string soccod, CancellationToken ct = default)
        => NextAsync(db.Absences.IgnoreQueryFilters().Where(a => a.Soccod == soccod).Select(a => a.Abscod), width: 4, ct);

    public static Task<string> NextNationCodeAsync(ApplicationDbContext db, CancellationToken ct = default)
        => NextAsync(db.Nations.IgnoreQueryFilters().Select(n => n.Natcod), width: 3, ct);

    public static Task<string> NextVilleCodeAsync(ApplicationDbContext db, CancellationToken ct = default)
        => NextAsync(db.Villes.IgnoreQueryFilters().Select(v => v.Vilcod), width: 6, ct);

    public static Task<string> NextQualifCodeAsync(ApplicationDbContext db, string soccod, CancellationToken ct = default)
        => NextAsync(db.Qualifs.IgnoreQueryFilters().Where(q => q.Soccod == soccod).Select(q => q.Quacod), width: 4, ct);

    public static Task<string> NextRubcodAsync(ApplicationDbContext db, string soccod, CancellationToken ct = default)
        => NextAsync(db.Rubriques.IgnoreQueryFilters().Where(r => r.Soccod == soccod).Select(r => r.Rubcod), width: 4, ct);

    /// <summary>
    /// Génère le prochain code employé en combinant :
    ///   - un préfixe optionnel (2 caractères) selon le mode paramétré côté Parametre.Parmodemp :
    ///       "S" → 2 premières lettres de Societe.Soclib
    ///       "N" → 2 premières lettres du nom employé fourni
    ///       "X" ou null/vide → pas de préfixe
    ///   - un suffixe numérique séquentiel zéro-paddé.
    /// La largeur totale du code est fixée à 6 caractères pour rester compatible avec
    /// la colonne empcod (NVARCHAR(12)). Le suffixe occupe (6 − longueur préfixe) chiffres.
    ///
    /// Le compteur séquentiel est calculé sur l'ensemble des codes employés du couple (Soccod, Sitcod)
    /// dont le préfixe correspond à celui calculé. Cela garantit l'unicité même quand on change de mode.
    /// </summary>
    public static async Task<string> NextEmpcodAsync(
        ApplicationDbContext db,
        string soccod,
        string sitcod,
        string? employeeName,
        CancellationToken ct = default)
    {
        const int totalWidth = 6;

        // Lire le mode + libellé société en une passe pour éviter 2 round-trips DB.
        var meta = await (
            from p in db.Parametres
            where p.Soccod == soccod
            join s in db.Societes on p.Soccod equals s.Soccod into sj
            from s in sj.DefaultIfEmpty()
            select new { p.Parmodemp, s.Soclib }
        ).FirstOrDefaultAsync(ct);

        var mode = meta?.Parmodemp?.Trim().ToUpperInvariant();
        string prefix = mode switch
        {
            "S" => SafePrefix(meta?.Soclib, 2),
            "N" => SafePrefix(employeeName, 2),
            _ => string.Empty,
        };

        // On considère TOUS les codes potentiellement réservés, pas seulement Employes vivants :
        // une suppression d'employé est SOFT (DeletedAt set) — la ligne reste physiquement en base
        // mais le filtre global la masque. IgnoreQueryFilters() est donc requis pour voir les lignes
        // soft-deleted, sinon le séquentiel renvoie un code dont la PK existe encore physiquement
        // → violation PK à l'INSERT. On unionne aussi Utilisateur(Uticod) et Socuser pour bloquer
        // les autres réservations historiques.
        var empCodes = await db.Employes.IgnoreQueryFilters()
            .Where(e => e.Soccod == soccod && e.Sitcod == sitcod)
            .Select(e => e.Empcod)
            .ToListAsync(ct);
        var userCodes = await db.Utilisateurs.IgnoreQueryFilters()
            .Select(u => u.Uticod).ToListAsync(ct);
        var socuserCodes = await db.Socusers.IgnoreQueryFilters()
            .Where(s => s.Soccod == soccod && s.Sitcod == sitcod)
            .Select(s => s.Uticod)
            .ToListAsync(ct);

        var taken = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var max = 0;
        foreach (var c in empCodes.Concat(userCodes).Concat(socuserCodes))
        {
            if (string.IsNullOrWhiteSpace(c)) continue;
            var raw = c.Trim();
            taken.Add(raw);

            string numericPart;
            if (!string.IsNullOrEmpty(prefix) && raw.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                numericPart = raw[prefix.Length..];
            else if (string.IsNullOrEmpty(prefix))
                numericPart = raw;
            else
                continue; // code d'un autre préfixe → ignoré pour le calcul du max

            if (int.TryParse(numericPart, out var n) && n > max) max = n;
        }

        var suffixWidth = totalWidth - prefix.Length;
        if (suffixWidth <= 0) suffixWidth = totalWidth; // cas pathologique : préfixe trop long

        // Filet de sécurité : si max+1 collisionne tout de même avec un code "hors préfixe"
        // (mode changé, code legacy non numérique réutilisé), on incrémente jusqu'à libre.
        var n2 = max;
        string candidate;
        do
        {
            n2++;
            candidate = prefix + n2.ToString().PadLeft(suffixWidth, '0');
        } while (taken.Contains(candidate));
        return candidate;
    }

    /// <summary>
    /// Extrait `length` premiers caractères alphanumériques (UPPER, latin) d'un libellé,
    /// sans espace ni accent. Renvoie une chaîne vide si le libellé n'a pas assez de
    /// caractères utilisables.
    /// </summary>
    private static string SafePrefix(string? label, int length)
    {
        if (string.IsNullOrWhiteSpace(label)) return string.Empty;
        var clean = new string(label.Where(char.IsLetterOrDigit).ToArray()).ToUpperInvariant();
        return clean.Length >= length ? clean[..length] : clean;
    }

    private static async Task<string> NextAsync(IQueryable<string?> codesQuery, int width, CancellationToken ct)
    {
        var codes = await codesQuery.ToListAsync(ct);
        var taken = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var max = 0;
        foreach (var c in codes)
        {
            if (string.IsNullOrWhiteSpace(c)) continue;
            var raw = c.Trim();
            taken.Add(raw);
            // Trim padding pour traiter "0001" comme 1.
            if (int.TryParse(raw, out var n) && n > max) max = n;
        }

        // Filet de sécurité : on incrémente tant que le candidat formaté entre en collision
        // avec un code existant. Couvre les codes saisis sans padding ("50") qui pourraient
        // collisionner avec un max+1 zéro-paddé ("0050"), et tout autre cas de doublon legacy.
        var nextNum = max;
        string candidate;
        do
        {
            nextNum++;
            candidate = nextNum.ToString().PadLeft(width, '0');
        } while (taken.Contains(candidate));
        return candidate;
    }
}
