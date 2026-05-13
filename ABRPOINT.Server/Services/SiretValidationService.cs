using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace ABRPOINT.Server.Services;

/// <summary>
/// Résultat de validation d'un identifiant entreprise. <see cref="IsValid"/> vrai = format
/// correct (et, pour les pays disposant d'une API publique, existence vérifiée). Le caller
/// utilise <see cref="ErrorCode"/> pour mapper sur un message UI ciblé.
/// </summary>
public sealed record SiretValidationResult(
    bool IsValid,
    string? ErrorCode,
    string? ErrorMessage,
    string? CompanyName);

/// <summary>
/// Validator multi-pays pour l'identifiant entreprise saisi au signup. Couvre FR (SIRET
/// via Sirene), BE (BCE via cbeapi.be + fallback mod 97 local), MA (ICE format only),
/// SN (NINEA format only). Stratégie commune : fail-open sur erreur API pour ne pas
/// bloquer un signup légitime ; la barrière dure contre la fraude reste l'index unique
/// filtré côté base (UX_Tenants_Siret_Active).
/// </summary>
public interface ISiretValidator
{
    Task<SiretValidationResult> ValidateAsync(string? rawSiret, string? countryCode, CancellationToken ct);
}

public class SiretValidator : ISiretValidator
{
    // Noms des clients nommés HttpClientFactory (cf. ServicesRegistration).
    public const string SireneClientName = "sirene";
    public const string CbeClientName = "cbe";

    private readonly IHttpClientFactory _httpFactory;
    private readonly IConfiguration _cfg;
    private readonly ILogger<SiretValidator> _log;

    public SiretValidator(IHttpClientFactory httpFactory, IConfiguration cfg, ILogger<SiretValidator> log)
    {
        _httpFactory = httpFactory;
        _cfg = cfg;
        _log = log;
    }

    public async Task<SiretValidationResult> ValidateAsync(string? rawSiret, string? countryCode, CancellationToken ct)
    {
        var country = (countryCode ?? "FR").Trim().ToUpperInvariant();
        var id = (rawSiret ?? string.Empty).Replace(" ", "").Replace("-", "").Replace(".", "").Trim();

        if (string.IsNullOrEmpty(id))
            return new(false, "siret_required", "Le numéro d'entreprise est obligatoire.", null);

        return country switch
        {
            "FR" => await ValidateFranceAsync(id, ct),
            "BE" => await ValidateBelgiumAsync(id, ct),
            "MA" => ValidateMorocco(id),
            "SN" => ValidateSenegal(id),
            _ => new(false, "siret_country_unsupported", "Pays non supporté pour la validation.", null),
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 🇫🇷 FRANCE — SIRET 14 chiffres + Luhn + API Sirene (recherche-entreprises.api.gouv.fr)
    // ─────────────────────────────────────────────────────────────────────────
    private static readonly Regex Digits14 = new("^[0-9]{14}$", RegexOptions.Compiled);

    private async Task<SiretValidationResult> ValidateFranceAsync(string siret, CancellationToken ct)
    {
        if (!Digits14.IsMatch(siret))
            return new(false, "siret_format", "Le SIRET doit contenir exactement 14 chiffres.", null);
        if (!IsLuhnValid(siret))
            return new(false, "siret_checksum", "Numéro SIRET invalide (clé de contrôle incorrecte).", null);

        try
        {
            var http = _httpFactory.CreateClient(SireneClientName);
            var url = $"search?q={siret}&minimal=true&include=siege,matching_etablissements&page=1&per_page=1";
            using var resp = await http.GetAsync(url, ct);
            if (!resp.IsSuccessStatusCode)
            {
                _log.LogWarning("API recherche-entreprises a renvoyé {Status} pour SIRET {Siret}. Validation tolérée.", resp.StatusCode, siret);
                return new(true, null, null, null);
            }

            using var stream = await resp.Content.ReadAsStreamAsync(ct);
            using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
            var root = doc.RootElement;

            if (!root.TryGetProperty("results", out var results) || results.GetArrayLength() == 0)
                return new(false, "siret_not_found", "Aucune entreprise trouvée pour ce SIRET dans le référentiel Sirene.", null);

            var entreprise = results[0];
            var etat = TryFindEtatForSiret(entreprise, siret);
            if (etat is null)
                return new(false, "siret_not_found", "Le SIRET saisi ne correspond à aucun établissement de cette entreprise.", null);
            if (etat == "F" || etat == "C")
                return new(false, "siret_closed", "Cet établissement est administrativement fermé. Utilisez le SIRET d'un établissement actif.", null);

            var nom = entreprise.TryGetProperty("nom_complet", out var n) ? n.GetString() :
                      entreprise.TryGetProperty("nom_raison_sociale", out var nr) ? nr.GetString() : null;
            return new(true, null, null, nom);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Échec appel API recherche-entreprises pour SIRET {Siret}. Validation tolérée.", siret);
            return new(true, null, null, null);
        }
    }

    private static string? TryFindEtatForSiret(JsonElement entreprise, string siret)
    {
        if (entreprise.TryGetProperty("siege", out var siege)
            && siege.TryGetProperty("siret", out var sgSiret)
            && string.Equals(sgSiret.GetString(), siret, StringComparison.Ordinal))
        {
            return siege.TryGetProperty("etat_administratif", out var etat) ? etat.GetString() : "A";
        }

        if (entreprise.TryGetProperty("matching_etablissements", out var matchs)
            && matchs.ValueKind == JsonValueKind.Array)
        {
            foreach (var et in matchs.EnumerateArray())
            {
                if (et.TryGetProperty("siret", out var etSiret)
                    && string.Equals(etSiret.GetString(), siret, StringComparison.Ordinal))
                {
                    return et.TryGetProperty("etat_administratif", out var etat) ? etat.GetString() : "A";
                }
            }
        }

        return null;
    }

    private static bool IsLuhnValid(string siret)
    {
        if (siret.StartsWith("356000000", StringComparison.Ordinal))
            return true;

        var sum = 0;
        for (var i = 0; i < siret.Length; i++)
        {
            var digit = siret[i] - '0';
            if (i % 2 == 0)
            {
                digit *= 2;
                if (digit > 9) digit -= 9;
            }
            sum += digit;
        }
        return sum % 10 == 0;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 🇧🇪 BELGIQUE — BCE/KBO 10 chiffres + checksum mod 97 + API cbeapi.be
    // Validation en couches :
    //   1) Format 10 chiffres + préfixe 0/1 (rejet immédiat des saisies bidon).
    //   2) Checksum mod 97 local (SPF Économie — pas d'appel réseau, robuste).
    //   3) Appel cbeapi.be si Cbe:ApiKey configurée → confirme existence + état actif
    //      + récupère la dénomination pour affichage UI.
    // Si la clé n'est pas configurée OU si l'API tombe, on retombe sur 1+2 seul
    // (fail-open) ; la contrainte unique côté DB reste le garde-fou anti-fraude.
    // ─────────────────────────────────────────────────────────────────────────
    private static readonly Regex Digits10 = new("^[0-9]{10}$", RegexOptions.Compiled);

    private async Task<SiretValidationResult> ValidateBelgiumAsync(string bce, CancellationToken ct)
    {
        if (!Digits10.IsMatch(bce))
            return new(false, "siret_format", "Le numéro BCE doit contenir 10 chiffres (sans le préfixe BE).", null);
        if (bce[0] != '0' && bce[0] != '1')
            return new(false, "siret_format", "Le numéro BCE belge doit commencer par 0 ou 1.", null);

        var baseNum = long.Parse(bce.Substring(0, 8));
        var providedCheck = int.Parse(bce.Substring(8, 2));
        var expectedCheck = 97 - (int)(baseNum % 97);
        if (providedCheck != expectedCheck)
            return new(false, "siret_checksum", "Numéro BCE invalide (clé de contrôle mod 97 incorrecte).", null);

        var apiKey = _cfg["Cbe:ApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey) || apiKey.Contains("REPLACE"))
        {
            // Pas de clé configurée → on s'arrête au check local. Format + mod 97 +
            // unicité DB suffisent comme défense de base. Log info pour que l'admin
            // sache qu'il pourrait activer la vérif API si désiré.
            _log.LogDebug("Cbe:ApiKey non configurée — validation BE limitée au format+mod97 local.");
            return new(true, null, null, null);
        }

        try
        {
            var http = _httpFactory.CreateClient(CbeClientName);
            using var req = new HttpRequestMessage(HttpMethod.Get, $"api/v1/company/{bce}");
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
            req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

            using var resp = await http.SendAsync(req, ct);
            if (resp.StatusCode == System.Net.HttpStatusCode.NotFound)
                return new(false, "siret_not_found", "Aucune entreprise trouvée pour ce numéro BCE dans le registre.", null);
            if (resp.StatusCode == System.Net.HttpStatusCode.Unauthorized || resp.StatusCode == System.Net.HttpStatusCode.Forbidden)
            {
                _log.LogWarning("cbeapi.be a refusé l'auth (Cbe:ApiKey invalide?). Fallback sur validation locale.");
                return new(true, null, null, null);
            }
            if (!resp.IsSuccessStatusCode)
            {
                _log.LogWarning("cbeapi.be a renvoyé {Status} pour BCE {Bce}. Fallback sur validation locale.", resp.StatusCode, bce);
                return new(true, null, null, null);
            }

            using var stream = await resp.Content.ReadAsStreamAsync(ct);
            using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
            if (!doc.RootElement.TryGetProperty("data", out var data))
                return new(true, null, null, null); // schéma inattendu → fail-open

            // État : "active" = ouvert. Tout autre statut connu de cbeapi.be (cessation,
            // dissolution, faillite) doit bloquer le signup — c'est précisément ce qu'on
            // veut éviter pour la fraude (réutilisation d'un BCE d'entreprise fermée).
            var status = data.TryGetProperty("status", out var s) ? s.GetString() : null;
            if (!string.IsNullOrEmpty(status) && !string.Equals(status, "active", StringComparison.OrdinalIgnoreCase))
                return new(false, "siret_closed", $"Cette entreprise n'est pas active dans le registre BCE (statut : {status}).", null);

            // Dénomination : on essaie plusieurs champs par ordre de préférence (le plus
            // descriptif d'abord). L'utilisateur voit le nom → confirmation visuelle qu'il
            // a saisi le bon numéro et pas celui d'une autre boîte.
            string? denomination = null;
            if (data.TryGetProperty("denomination_with_legal_form", out var dl) && dl.ValueKind == JsonValueKind.String)
                denomination = dl.GetString();
            else if (data.TryGetProperty("denomination", out var d2) && d2.ValueKind == JsonValueKind.String)
                denomination = d2.GetString();
            else if (data.TryGetProperty("commercial_name", out var d3) && d3.ValueKind == JsonValueKind.String)
                denomination = d3.GetString();

            return new(true, null, null, denomination);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Échec appel cbeapi.be pour BCE {Bce}. Fallback sur validation locale (fail-open).", bce);
            return new(true, null, null, null);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 🇲🇦 MAROC — ICE (Identifiant Commun de l'Entreprise) : 15 chiffres
    // Aucune API publique gratuite officielle (la DGI marocaine n'en expose pas).
    // ─────────────────────────────────────────────────────────────────────────
    private static readonly Regex Digits15 = new("^[0-9]{15}$", RegexOptions.Compiled);

    private static SiretValidationResult ValidateMorocco(string ice)
    {
        if (!Digits15.IsMatch(ice))
            return new(false, "siret_format", "L'ICE doit contenir 15 chiffres.", null);
        return new(true, null, null, null);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 🇸🇳 SÉNÉGAL — NINEA : 9 chiffres
    // Aucune API publique gratuite officielle.
    // ─────────────────────────────────────────────────────────────────────────
    private static readonly Regex Digits9 = new("^[0-9]{9}$", RegexOptions.Compiled);

    private static SiretValidationResult ValidateSenegal(string ninea)
    {
        if (!Digits9.IsMatch(ninea))
            return new(false, "siret_format", "Le NINEA doit contenir 9 chiffres.", null);
        return new(true, null, null, null);
    }
}
