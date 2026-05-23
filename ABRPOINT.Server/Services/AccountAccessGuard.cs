using ABRPOINT.Server.Data;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Services;

/// <summary>
/// Garde centralisée qui détermine si un compte utilisateur a le droit de se
/// connecter ou de continuer une session. Source de vérité unique pour les 3
/// raisons de blocage :
///
///   1. <c>Utilisateur.Utiactif != "1"</c>  → compte désactivé par l'admin.
///   2. Une fiche <c>Employe</c> liée a <c>Actif != "A"</c> (sortie / suspension).
///   3. Une fiche <c>Employe</c> liée a <c>Empsort &lt;= today</c> (fin de contrat
///      atteinte). RGPD clause 13.3 / Art. 32 : la révocation d'accès doit être
///      effective dès la date de sortie déclarée, pas seulement après que l'admin
///      ait pensé à basculer <c>Actif</c>.
///
/// Appelée par UtilisateursController (login web, 2FA, refresh) et
/// MobileAuthController (login mobile, refresh, login biométrique).
/// </summary>
public static class AccountAccessGuard
{
    public enum DisableReason
    {
        None = 0,
        UserDisabled,
        EmployeeInactiveOrContractEnded,
    }

    /// <summary>
    /// Lit en base le statut courant de <paramref name="uticod"/> et renvoie la
    /// raison de blocage, ou <see cref="DisableReason.None"/> si l'accès est OK.
    /// </summary>
    public static async Task<DisableReason> CheckAsync(
        ApplicationDbContext db,
        string? uticod,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(uticod)) return DisableReason.UserDisabled;

        // Étape 1 — drapeau utilisateur. AsNoTracking + projection sur le seul
        // champ utile : évite de matérialiser la ligne Utilisateur complète
        // (qui peut contenir des PII chiffrées comme tel/cin).
        var utiactif = await db.Utilisateurs.AsNoTracking()
            .Where(u => u.Uticod == uticod)
            .Select(u => u.Utiactif)
            .FirstOrDefaultAsync(ct);
        if (utiactif != "1") return DisableReason.UserDisabled;

        // Étape 2 — fiches employé : on bloque si AU MOINS UNE a soit un Actif
        // explicitement non-A, soit une date de sortie passée. Sémantique
        // conservatrice cohérente avec l'existant : il ne suffit pas d'avoir
        // un poste actif quelque part, il faut qu'aucun de ses contrats ne
        // soit arrivé à terme. Ceci protège du cas multi-fiches où l'admin
        // n'aurait mis à jour qu'un seul Empsort.
        var today = DateTime.Today;
        var blocked = await db.Employes.AsNoTracking()
            .AnyAsync(e => e.Empcod == uticod
                && ((e.Actif != null && e.Actif != "A")
                    || (e.Empsort != null && e.Empsort <= today)),
                ct);
        return blocked ? DisableReason.EmployeeInactiveOrContractEnded : DisableReason.None;
    }

    /// <summary>
    /// Message utilisateur en français correspondant à chaque raison. Évite la
    /// duplication des libellés à travers tous les contrôleurs.
    /// </summary>
    public static string MessageFor(DisableReason reason) => reason switch
    {
        DisableReason.UserDisabled =>
            "Compte désactivé. Contactez votre administrateur pour réactiver l'accès.",
        DisableReason.EmployeeInactiveOrContractEnded =>
            "Accès refusé : votre contrat est arrivé à terme ou votre fiche employé n'est plus active. Contactez votre administrateur.",
        _ => string.Empty,
    };

    public static bool IsDisabled(DisableReason reason) => reason != DisableReason.None;
}
