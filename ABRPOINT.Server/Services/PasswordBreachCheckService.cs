using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Caching.Memory;

namespace ABRPOINT.Server.Services;

/// <summary>
/// Vérifie qu'un mot de passe ne figure pas dans la base publique des fuites
/// haveibeenpwned.com (Pwned Passwords API v3, k-anonymity). Cas d'usage : signup
/// + changement de mot de passe — on refuse les mots de passe déjà fuités, c'est
/// la mesure single la plus efficace contre le credential stuffing.
///
/// Confidentialité : on envoie SEULEMENT les 5 premiers caractères du SHA-1 du
/// mot de passe. L'API renvoie tous les hashs qui commencent par ce préfixe
/// (~500-800 résultats), on cherche localement la suite. HIBP ne voit jamais le
/// mot de passe ni son hash complet — k-anonymity standard de l'industrie.
/// </summary>
public interface IPasswordBreachChecker
{
    /// <summary>
    /// Retourne le nombre d'occurrences trouvées dans les fuites publiques.
    /// 0 = jamais fuité. >0 = le mot de passe a été vu N fois dans des breaches connus.
    /// Si l'API HIBP est inaccessible, on retombe sur 0 (fail-open) pour ne pas bloquer
    /// le signup légitime — le tradeoff sécurité/disponibilité penche vers l'inscription.
    /// </summary>
    Task<int> GetBreachCountAsync(string password, CancellationToken ct);
}

public sealed class PasswordBreachChecker : IPasswordBreachChecker
{
    private readonly HttpClient _http;
    private readonly ILogger<PasswordBreachChecker> _log;
    private readonly IMemoryCache _cache;

    // PERF — TTL du cache HIBP : 1h. Les listes HIBP ne sont mises à jour qu'à
    // chaque release publique (mensuel/trimestriel), donc 1h est conservateur
    // sans gaspiller de mémoire. Chaque entrée = ~5-30 KB de hashes.
    private static readonly TimeSpan CacheTtl = TimeSpan.FromHours(1);

    public PasswordBreachChecker(HttpClient http, ILogger<PasswordBreachChecker> log, IMemoryCache cache)
    {
        _http = http;
        _log = log;
        _cache = cache;
    }

    public async Task<int> GetBreachCountAsync(string password, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(password)) return 0;

        var sha1Hex = ComputeSha1Hex(password);
        var prefix = sha1Hex.Substring(0, 5);
        var suffix = sha1Hex.Substring(5);

        try
        {
            // PERF — Cache par préfixe SHA1[0..5]. Un préfixe matche ~500-800
            // mots de passe — donc le cache absorbe quasi tous les signups suivants
            // qui partagent un préfixe (souvent vrai sur mots de passe communs).
            // Économise un round-trip HTTP de ~200-500 ms.
            var cacheKey = $"hibp:{prefix}";
            string? body;
            if (!_cache.TryGetValue(cacheKey, out body) || body is null)
            {
                // Header "Add-Padding: true" recommandé par HIBP — masque le nombre exact de
                // résultats au niveau réseau (anti-traffic-analysis si un MITM observe les tailles).
                using var req = new HttpRequestMessage(HttpMethod.Get, $"range/{prefix}");
                req.Headers.Add("Add-Padding", "true");
                using var resp = await _http.SendAsync(req, ct);
                if (!resp.IsSuccessStatusCode)
                {
                    _log.LogWarning("HIBP a renvoyé {Status} pour préfixe {Prefix}. Vérification tolérée.", resp.StatusCode, prefix);
                    return 0;
                }

                body = await resp.Content.ReadAsStringAsync(ct);
                _cache.Set(cacheKey, body, CacheTtl);
            }

            // Format : "<SUFFIX>:<COUNT>\r\n" répété. Recherche linéaire — la liste fait
            // ~500-800 entrées max, donc négligeable côté CPU.
            foreach (var line in body.Split('\n'))
            {
                var trimmed = line.Trim();
                if (trimmed.Length == 0) continue;
                var sep = trimmed.IndexOf(':');
                if (sep <= 0) continue;
                var lineSuffix = trimmed.Substring(0, sep);
                if (!string.Equals(lineSuffix, suffix, StringComparison.OrdinalIgnoreCase)) continue;
                // Format de count : "12345" (ASCII décimal). Ligne padding HIBP : count=0,
                // on l'ignore car non-significatif (entrées de bourrage).
                if (int.TryParse(trimmed.AsSpan(sep + 1), out var count) && count > 0)
                    return count;
            }
            return 0;
        }
        catch (Exception ex)
        {
            // Fail-open : si HIBP est down, on n'invalide pas le mot de passe. Le risque
            // résiduel est qu'un user choisisse "123456" pendant une panne HIBP, mais c'est
            // moins grave que de bloquer tous les signups quand l'API tombe.
            _log.LogWarning(ex, "Échec appel HIBP — fail-open, mot de passe accepté.");
            return 0;
        }
    }

    private static string ComputeSha1Hex(string input)
    {
        var bytes = Encoding.UTF8.GetBytes(input);
        var hash = SHA1.HashData(bytes);
        var sb = new StringBuilder(hash.Length * 2);
        foreach (var b in hash) sb.Append(b.ToString("X2"));
        return sb.ToString();
    }
}
