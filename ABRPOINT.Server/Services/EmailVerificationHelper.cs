using System.Security.Cryptography;

namespace ABRPOINT.Server.Services;

/// <summary>
/// Helpers stateless pour la vérification email par OTP 6 chiffres. Utilisé par
/// SignupController (envoi initial) et UtilisateursController (verify + resend).
/// Tout l'état (hash, expiry, compteur d'essais) vit dans la colonne uti_email_verif_*
/// de la table utilisateur du tenant — aucune dépendance cache/session ici.
/// </summary>
public static class EmailVerificationHelper
{
    /// <summary>Durée de vie d'un code OTP en minutes. Au-delà, /verify-email renvoie code_expired.</summary>
    public const int CodeLifetimeMinutes = 15;

    /// <summary>Nombre max de tentatives de vérification avant invalidation du code en cours.</summary>
    public const int MaxAttempts = 5;

    /// <summary>Délai mini entre deux resends pour un même utilisateur, en secondes.</summary>
    public const int ResendCooldownSeconds = 60;

    /// <summary>
    /// Génère un code OTP 6 chiffres cryptographiquement aléatoire (000000–999999, padding gauche).
    /// RNGCryptoServiceProvider plutôt que Random pour éviter qu'un attaquant ayant capturé
    /// un code ne devine les suivants à partir de la seed du PRNG.
    /// </summary>
    public static string GenerateCode()
    {
        // 4 octets → entier 0..2^32-1 → modulo 10^6. Léger biais statistique (~0.04%)
        // négligeable pour un OTP (le keyspace utile reste 10^6 codes équiprobables à 4 chiffres près).
        Span<byte> buf = stackalloc byte[4];
        RandomNumberGenerator.Fill(buf);
        var n = BitConverter.ToUInt32(buf) % 1_000_000U;
        return n.ToString("D6");
    }
}
