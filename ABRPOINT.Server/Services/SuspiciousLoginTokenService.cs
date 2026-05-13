using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Caching.Memory;

namespace ABRPOINT.Server.Services;

/// <summary>
/// Génère et valide les tokens "Ce n'était pas moi" inclus dans les emails d'alerte de
/// nouvelle connexion. Format : <c>base64url(payload).signature</c> où payload =
/// <c>{slug}|{uticod}|{issuedAtUnix}</c> et signature = HMAC-SHA256(secret, payload).
///
/// - Stateless côté serveur (pas de table de tokens). Seul prérequis : `Jwt:Key` config.
/// - TTL : 7 jours. Au-delà, le token est rejeté avant même de toucher la DB.
/// - Single-use enforced via <see cref="IMemoryCache"/> : un token déjà consommé renvoie
///   immédiatement <c>false</c>, ce qui empêche un attaquant qui aurait intercepté l'email
///   d'utiliser le lien après l'utilisateur légitime.
/// </summary>
public interface ISuspiciousLoginTokenService
{
    string Generate(string slug, string uticod);
    bool TryValidate(string? token, out string slug, out string uticod);
    void MarkConsumed(string token);
}

public sealed class SuspiciousLoginTokenService : ISuspiciousLoginTokenService
{
    private static readonly TimeSpan Validity = TimeSpan.FromDays(7);
    private readonly byte[] _secret;
    private readonly IMemoryCache _cache;

    public SuspiciousLoginTokenService(IConfiguration cfg, IMemoryCache cache)
    {
        var key = cfg["Jwt:Key"] ?? string.Empty;
        if (string.IsNullOrEmpty(key))
            throw new InvalidOperationException("Jwt:Key absent — requis pour signer les tokens de révocation.");
        _secret = Encoding.UTF8.GetBytes(key);
        _cache = cache;
    }

    public string Generate(string slug, string uticod)
    {
        var issued = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var payload = $"{slug}|{uticod}|{issued}";
        var sig = ComputeSignature(payload);
        return $"{Base64Url(Encoding.UTF8.GetBytes(payload))}.{sig}";
    }

    public bool TryValidate(string? token, out string slug, out string uticod)
    {
        slug = string.Empty;
        uticod = string.Empty;
        if (string.IsNullOrEmpty(token)) return false;
        var dot = token.IndexOf('.');
        if (dot <= 0 || dot == token.Length - 1) return false;

        var payloadB64 = token.Substring(0, dot);
        var providedSig = token.Substring(dot + 1);

        byte[] payloadBytes;
        try { payloadBytes = Base64UrlDecode(payloadB64); }
        catch { return false; }

        var payload = Encoding.UTF8.GetString(payloadBytes);
        var expectedSig = ComputeSignature(payload);
        // CryptographicOperations.FixedTimeEquals empêche le timing attack sur la
        // comparaison de signature (un attaquant qui mesure le délai de réponse ne
        // peut pas dériver caractère par caractère la signature attendue).
        var providedBytes = Encoding.ASCII.GetBytes(providedSig);
        var expectedBytes = Encoding.ASCII.GetBytes(expectedSig);
        if (providedBytes.Length != expectedBytes.Length) return false;
        if (!CryptographicOperations.FixedTimeEquals(providedBytes, expectedBytes)) return false;

        var parts = payload.Split('|');
        if (parts.Length != 3) return false;
        if (!long.TryParse(parts[2], out var issued)) return false;
        var age = DateTimeOffset.UtcNow.ToUnixTimeSeconds() - issued;
        if (age < 0 || age > (long)Validity.TotalSeconds) return false;

        // Anti-replay : si on a déjà marqué ce token comme consommé, refus.
        if (_cache.TryGetValue<bool>($"suspicious_revoke_used:{token}", out _)) return false;

        slug = parts[0];
        uticod = parts[1];
        return true;
    }

    public void MarkConsumed(string token)
    {
        // TTL aligné sur la validité du token : passé Validity, le token est invalide
        // de toute façon (rejet timestamp). Stocker plus longtemps ne sert à rien.
        _cache.Set($"suspicious_revoke_used:{token}", true, Validity);
    }

    private string ComputeSignature(string payload)
    {
        using var hmac = new HMACSHA256(_secret);
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(payload));
        // 24 chars de base64url ≈ 144 bits — bien au-dessus du seuil collision raisonnable.
        return Base64Url(hash).Substring(0, 24);
    }

    private static string Base64Url(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static byte[] Base64UrlDecode(string s)
    {
        var padded = s.Replace('-', '+').Replace('_', '/');
        switch (padded.Length % 4)
        {
            case 2: padded += "=="; break;
            case 3: padded += "="; break;
        }
        return Convert.FromBase64String(padded);
    }
}
