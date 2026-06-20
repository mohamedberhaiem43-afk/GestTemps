using System.Security.Cryptography;
using System.Text;

namespace ABRPOINT.Server.Helpers
{
    /// <summary>
    /// Stockage et vérification du secret à usage unique placé dans <c>Utilisateur.UtiResetCode</c>.
    /// Ce champ est partagé par deux usages :
    ///   - OTP 6 chiffres du « mot de passe oublié » (/auth/forgot-password → /auth/reset-password) ;
    ///   - token de mise en place (setup-password) d'un nouveau compte employé (7 jours).
    ///
    /// SEC (#13) — Avant, le secret était stocké EN CLAIR et comparé par égalité ordinaire (==),
    /// sans compteur de tentatives : un OTP 6 chiffres (~10⁶ valeurs) était brute-forçable pendant
    /// sa fenêtre de validité (rotation d'IP pour contourner le rate limiter par IP), et tout accès
    /// SQL en lecture exposait un code réutilisable. On stocke désormais un hash BCrypt et on vérifie
    /// à temps constant. Le compteur <c>UtiResetAttempts</c> (cf. <see cref="MaxAttempts"/>) invalide
    /// le code après quelques échecs, indépendamment de l'IP — c'est la défense décisive contre le
    /// brute-force distribué.
    /// </summary>
    public static class ResetSecretHelper
    {
        /// <summary>Nombre d'échecs de vérification au-delà duquel le secret est invalidé.</summary>
        public const int MaxAttempts = 5;

        /// <summary>Hash BCrypt du secret (OTP ou token), à persister dans <c>UtiResetCode</c>.</summary>
        public static string Hash(string secret) => BCrypt.Net.BCrypt.HashPassword(secret);

        /// <summary>
        /// Vérifie un secret fourni contre la valeur stockée.
        ///   - Valeur émise après le correctif = hash BCrypt (préfixe <c>$2</c>) → <c>BCrypt.Verify</c>.
        ///   - Valeur héritée stockée en clair (OTP &lt; 15 min ou token setup &lt; 7 j émis AVANT le
        ///     déploiement) → comparaison à temps constant, le temps que ces valeurs expirent.
        /// Renvoie <c>false</c> sur valeur absente ou hash malformé (jamais d'exception).
        /// </summary>
        public static bool Verify(string? stored, string? provided)
        {
            if (string.IsNullOrEmpty(stored) || string.IsNullOrEmpty(provided)) return false;

            if (stored.StartsWith("$2", StringComparison.Ordinal))
            {
                try { return BCrypt.Net.BCrypt.Verify(provided, stored); }
                catch { return false; }
            }

            // Rétro-compat transitoire : ancienne valeur en clair.
            var a = Encoding.UTF8.GetBytes(stored);
            var b = Encoding.UTF8.GetBytes(provided);
            return a.Length == b.Length && CryptographicOperations.FixedTimeEquals(a, b);
        }
    }
}
