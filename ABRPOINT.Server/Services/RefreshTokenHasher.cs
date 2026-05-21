using System.Security.Cryptography;
using System.Text;

namespace ABRPOINT.Server.Services;

/// <summary>
/// Hashage SHA-256 des refresh tokens avant stockage en base.
///
/// Pourquoi pas BCrypt/Argon2 ? Le token est déjà aléatoire 256 bits (entropie
/// suffisante), donc le rainbow / brute-force n'a pas de sens : SHA-256 suffit
/// et reste constant-time côté DB (égalité d'index B-tree). BCrypt sur chaque
/// refresh introduirait 100 ms de CPU par requête sans gain de sécurité.
///
/// Pourquoi pas HMAC ? On ne cherche pas à empêcher la fabrication offline (le
/// token est généré côté serveur, pas dérivé d'un secret partagé). HMAC ajouterait
/// une clé à gérer pour zéro bénéfice ici.
///
/// Conséquence : si un dump SQL fuit, les valeurs `token` en base sont des hash
/// — non rejouables tant que l'attaquant n'a pas un canal HTTP authentifié.
/// </summary>
public static class RefreshTokenHasher
{
    public static string Hash(string plainToken)
    {
        if (string.IsNullOrEmpty(plainToken)) return string.Empty;
        var bytes = Encoding.UTF8.GetBytes(plainToken);
        var hash = SHA256.HashData(bytes);
        return Convert.ToBase64String(hash);
    }
}
