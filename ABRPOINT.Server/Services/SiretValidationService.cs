using System.Text.Json;
using System.Text.RegularExpressions;

namespace ABRPOINT.Server.Services;

/// <summary>
/// Résultat de validation d'un SIRET. <see cref="IsValid"/> vrai = SIRET existant et
/// administrativement actif dans le référentiel Sirene. <see cref="ErrorCode"/> permet
/// au caller de renvoyer un message ciblé ("siret_format" / "siret_not_found" / etc.).
/// </summary>
public sealed record SiretValidationResult(
    bool IsValid,
    string? ErrorCode,
    string? ErrorMessage,
    string? CompanyName);

public interface ISiretValidator
{
    Task<SiretValidationResult> ValidateAsync(string? rawSiret, CancellationToken ct);
}

/// <summary>
/// Vérifie un numéro SIRET en deux temps : (1) checksum Luhn local pour rejeter
/// instantanément les chaînes mal formées (économie d'appel HTTP) puis (2) appel à
/// l'API gouvernementale recherche-entreprises.api.gouv.fr (gratuite, sans auth)
/// pour confirmer que le SIRET existe et que l'établissement est actif.
///
/// Référence : https://recherche-entreprises.api.gouv.fr/docs
/// </summary>
public class SiretValidator : ISiretValidator
{
    private static readonly Regex DigitsOnly = new("^[0-9]{14}$", RegexOptions.Compiled);
    private readonly HttpClient _http;
    private readonly ILogger<SiretValidator> _log;

    public SiretValidator(HttpClient http, ILogger<SiretValidator> log)
    {
        _http = http;
        _log = log;
    }

    public async Task<SiretValidationResult> ValidateAsync(string? rawSiret, CancellationToken ct)
    {
        var siret = (rawSiret ?? string.Empty).Replace(" ", "").Replace("-", "").Trim();
        if (string.IsNullOrEmpty(siret))
            return new(false, "siret_required", "Le SIRET est obligatoire.", null);
        if (!DigitsOnly.IsMatch(siret))
            return new(false, "siret_format", "Le SIRET doit contenir exactement 14 chiffres.", null);
        if (!IsLuhnValid(siret))
            return new(false, "siret_checksum", "Numéro SIRET invalide (clé de contrôle incorrecte).", null);

        // Appel API gouvernementale. Pas de clé requise, mais l'API a un rate limit
        // public (~7 req/s) : on garde un timeout court (HttpClient configuré côté DI)
        // et on remonte une erreur "neutre" si l'appel échoue — la fraude reste rare,
        // refuser un signup légitime à cause d'un timeout API serait pire que tolérer
        // un fraudeur occasionnel. En cas d'erreur réseau, on continue (fail-open).
        try
        {
            // Endpoint : /search?q={SIRET}&minimal=true&include=siege. Renvoie 0 ou 1
            // résultat. On accepte aussi les "matching_etablissements" pour les SIRET
            // d'établissements secondaires (pas seulement le siège).
            var url = $"search?q={siret}&minimal=true&include=siege,matching_etablissements&page=1&per_page=1";
            using var resp = await _http.GetAsync(url, ct);
            if (!resp.IsSuccessStatusCode)
            {
                _log.LogWarning("API recherche-entreprises a renvoyé {Status} pour SIRET {Siret}. Validation tolérée.", resp.StatusCode, siret);
                return new(true, null, null, null); // fail-open
            }

            using var stream = await resp.Content.ReadAsStreamAsync(ct);
            using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
            var root = doc.RootElement;

            if (!root.TryGetProperty("results", out var results) || results.GetArrayLength() == 0)
                return new(false, "siret_not_found", "Aucune entreprise trouvée pour ce SIRET dans le référentiel Sirene.", null);

            var entreprise = results[0];

            // Recherche le SIRET exact dans siege OU matching_etablissements, et vérifie son état.
            // État administratif : "A" = Actif, "F" = Fermé. On rejette les fermés pour éviter
            // qu'un fraudeur réutilise un SIRET d'entreprise dissoute.
            var etatActif = TryFindEtatForSiret(entreprise, siret);
            if (etatActif is null)
                return new(false, "siret_not_found", "Le SIRET saisi ne correspond à aucun établissement de cette entreprise.", null);
            if (etatActif == "F" || etatActif == "C")
                return new(false, "siret_closed", "Cet établissement est administrativement fermé. Utilisez le SIRET d'un établissement actif.", null);

            var nom = entreprise.TryGetProperty("nom_complet", out var n) ? n.GetString() :
                      entreprise.TryGetProperty("nom_raison_sociale", out var nr) ? nr.GetString() : null;
            return new(true, null, null, nom);
        }
        catch (Exception ex)
        {
            // Erreur réseau / parsing → on log mais on n'invalide pas le SIRET (fail-open).
            // Si l'API tombe en panne, le formulaire reste fonctionnel ; la contrainte
            // d'unicité côté DB protège tout de même contre les multi-comptes par SIRET.
            _log.LogWarning(ex, "Échec appel API recherche-entreprises pour SIRET {Siret}. Validation tolérée.", siret);
            return new(true, null, null, null);
        }
    }

    /// <summary>
    /// Cherche le SIRET donné dans les blocs `siege` et `matching_etablissements` et
    /// retourne l'état administratif ('A' / 'F' / 'C') ou null si introuvable.
    /// </summary>
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

    /// <summary>
    /// Vérifie le SIRET via l'algorithme Luhn standard (clé de contrôle sur 14 chiffres).
    /// Cas particulier La Poste (356 0000 00) : tous les SIRET commencent par "356000000"
    /// et la règle Luhn ne s'applique pas — on accepte sans contrôle local et on délègue
    /// à l'API Sirene.
    /// </summary>
    private static bool IsLuhnValid(string siret)
    {
        if (siret.StartsWith("356000000", StringComparison.Ordinal))
            return true;

        var sum = 0;
        for (var i = 0; i < siret.Length; i++)
        {
            // Position counted from the right : positions paires (1-indexées depuis la
            // droite) sont doublées. Sur une chaîne de 14 chiffres, ce sont les indices
            // pairs 0, 2, 4, ..., 12 quand on parcourt de gauche à droite.
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
}
