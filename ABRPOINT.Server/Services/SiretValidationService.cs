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
    string? CompanyName,
    string? CompanyAddress = null,
    // 2026-05-27 — Secteur d'activité (libellé NAF/NACE), extrait de l'API quand
    // dispo (FR Sirene = activite_principale.libelle ; BE BCE = activity label).
    // Null si l'API n'a pas pu fournir l'info ou pays manuel (MA/SN/TN).
    string? ActivitySector = null);

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
    public const string ViesClientName = "vies";

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
            "TN" => ValidateTunisia(id),
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
                return new(false, "siret_not_found", "Aucune entreprise enregistrée pour ce SIRET dans le référentiel Sirene.", null);

            var entreprise = results[0];
            var etat = TryFindEtatForSiret(entreprise, siret);
            if (etat is null)
                return new(false, "siret_not_found", "Le SIRET saisi ne correspond à aucun établissement de cette entreprise.", null);
            if (etat == "F" || etat == "C")
                return new(false, "siret_closed", "Cet établissement est administrativement fermé. Utilisez le SIRET d'un établissement actif.", null);

            var nom = entreprise.TryGetProperty("nom_complet", out var n) ? n.GetString() :
                      entreprise.TryGetProperty("nom_raison_sociale", out var nr) ? nr.GetString() : null;
            var adresse = TryExtractFrenchAddress(entreprise, siret);
            // Secteur d'activité : recherche-entreprises expose `activite_principale`
            // (libellé NAF déjà traduit, ex: « Conseil pour les affaires »). On le préfère
            // au code NAF brut pour qu'il soit lisible directement côté UI. Fallback sur
            // le siège si l'attribut n'est pas posé au niveau entreprise.
            var sector = TryExtractActivitySector(entreprise, siret);
            return new(true, null, null, nom, adresse, sector);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Échec appel API recherche-entreprises pour SIRET {Siret}. Validation tolérée.", siret);
            return new(true, null, null, null);
        }
    }

    /// <summary>
    /// Recompose l'adresse postale depuis la réponse Sirene (recherche-entreprises.api.gouv.fr).
    /// On cherche d'abord dans le siège, puis dans matching_etablissements pour le SIRET demandé.
    /// On préfère `adresse` (déjà formatée) ; sinon on concatène les composants.
    /// </summary>
    private static string? TryExtractFrenchAddress(JsonElement entreprise, string siret)
    {
        // Priorité au siège quand son SIRET correspond — c'est l'adresse "principale".
        if (entreprise.TryGetProperty("siege", out var siege)
            && siege.TryGetProperty("siret", out var sgSiret)
            && string.Equals(sgSiret.GetString(), siret, StringComparison.Ordinal))
        {
            var fromSiege = ExtractAddressFromEtablissement(siege);
            if (!string.IsNullOrWhiteSpace(fromSiege)) return fromSiege;
        }
        if (entreprise.TryGetProperty("matching_etablissements", out var matchs)
            && matchs.ValueKind == JsonValueKind.Array)
        {
            foreach (var et in matchs.EnumerateArray())
            {
                if (et.TryGetProperty("siret", out var etSiret)
                    && string.Equals(etSiret.GetString(), siret, StringComparison.Ordinal))
                {
                    var addr = ExtractAddressFromEtablissement(et);
                    if (!string.IsNullOrWhiteSpace(addr)) return addr;
                }
            }
        }
        return null;
    }

    /// <summary>
    /// Récupère le libellé d'activité principale depuis la réponse Sirene
    /// (recherche-entreprises.api.gouv.fr). On essaie successivement :
    ///   1. <c>entreprise.activite_principale</c> (libellé global, le plus utile).
    ///   2. <c>siege.libelle_activite_principale</c> (cas où l'attribut global manque).
    ///   3. <c>matching_etablissements[siret].libelle_activite_principale</c>.
    /// Renvoie null si rien d'exploitable — le caller laisse l'admin compléter manuellement.
    /// </summary>
    private static string? TryExtractActivitySector(JsonElement entreprise, string siret)
    {
        static string? StringOrNull(JsonElement el) =>
            el.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(el.GetString())
                ? el.GetString()
                : null;

        if (entreprise.TryGetProperty("activite_principale", out var ap))
        {
            var lib = StringOrNull(ap);
            if (lib != null) return lib.Trim();
        }
        if (entreprise.TryGetProperty("libelle_activite_principale", out var lap))
        {
            var lib = StringOrNull(lap);
            if (lib != null) return lib.Trim();
        }
        if (entreprise.TryGetProperty("siege", out var siege))
        {
            if (siege.TryGetProperty("libelle_activite_principale", out var lab))
            {
                var lib = StringOrNull(lab);
                if (lib != null) return lib.Trim();
            }
        }
        if (entreprise.TryGetProperty("matching_etablissements", out var matchs)
            && matchs.ValueKind == JsonValueKind.Array)
        {
            foreach (var et in matchs.EnumerateArray())
            {
                if (et.TryGetProperty("siret", out var etSiret)
                    && string.Equals(etSiret.GetString(), siret, StringComparison.Ordinal))
                {
                    if (et.TryGetProperty("libelle_activite_principale", out var lab))
                    {
                        var lib = StringOrNull(lab);
                        if (lib != null) return lib.Trim();
                    }
                }
            }
        }
        return null;
    }

    private static string? ExtractAddressFromEtablissement(JsonElement et)
    {
        // recherche-entreprises expose un champ `adresse` déjà concaténé — on préfère.
        if (et.TryGetProperty("adresse", out var pre) && pre.ValueKind == JsonValueKind.String)
        {
            var s = pre.GetString();
            if (!string.IsNullOrWhiteSpace(s)) return s.Trim();
        }
        // Fallback : reconstruction depuis composants individuels.
        string? Part(string prop) => et.TryGetProperty(prop, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;
        var num = Part("numero_voie");
        var typ = Part("type_voie");
        var lib = Part("libelle_voie");
        var cp = Part("code_postal");
        var ville = Part("libelle_commune") ?? Part("commune");
        var rue = string.Join(' ', new[] { num, typ, lib }.Where(s => !string.IsNullOrWhiteSpace(s)));
        var full = string.Join(", ", new[] { rue, $"{cp} {ville}".Trim() }.Where(s => !string.IsNullOrWhiteSpace(s)));
        return string.IsNullOrWhiteSpace(full) ? null : full;
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
            // Pas de clé cbeapi.be (service payant) → fallback sur VIES (service EU
            // gratuit officiel). Pour la BCE belge, le numéro EST le numéro TVA :
            // VIES renvoie nom + adresse exactement comme Sirene pour la France →
            // parité d'UX FR/BE sans coût additionnel. fail-open si VIES tombe.
            _log.LogDebug("Cbe:ApiKey non configurée — fallback sur VIES pour BCE {Bce}.", bce);
            var vies = await TryViesLookupAsync(bce, ct);
            return new(true, null, null, vies.Name, vies.Address);
        }

        try
        {
            var http = _httpFactory.CreateClient(CbeClientName);
            using var req = new HttpRequestMessage(HttpMethod.Get, $"api/v1/company/{bce}");
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
            req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

            using var resp = await http.SendAsync(req, ct);
            if (resp.StatusCode == System.Net.HttpStatusCode.NotFound)
                return new(false, "siret_not_found", "Aucune entreprise enregistrée pour ce numéro BCE dans le registre.", null);
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

            // Adresse — cbeapi.be expose un objet `address` avec street / zipcode / city,
            // ou parfois `headquarters_address`. On tente les deux et on tolère le format.
            string? addressString = null;
            if (data.TryGetProperty("address", out var addr) && addr.ValueKind == JsonValueKind.Object)
                addressString = FormatCbeAddress(addr);
            else if (data.TryGetProperty("headquarters_address", out var hq) && hq.ValueKind == JsonValueKind.Object)
                addressString = FormatCbeAddress(hq);

            // Si cbeapi.be n'a renvoyé NI dénomination NI adresse (réponse partielle,
            // schéma changé…), on tente VIES en complément pour ne pas afficher un
            // champ vide à l'utilisateur. C'est exactement le même comportement que
            // pour Sirene côté FR — l'utilisateur voit toujours quelque chose.
            if (string.IsNullOrWhiteSpace(denomination) && string.IsNullOrWhiteSpace(addressString))
            {
                var vies = await TryViesLookupAsync(bce, ct);
                denomination = vies.Name;
                addressString = vies.Address;
            }

            return new(true, null, null, denomination, addressString);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Échec appel cbeapi.be pour BCE {Bce}. Fallback VIES (fail-open).", bce);
            var vies = await TryViesLookupAsync(bce, ct);
            return new(true, null, null, vies.Name, vies.Address);
        }
    }

    /// <summary>
    /// VIES (VAT Information Exchange System) — service officiel EU, gratuit, sans
    /// clé. Pour la Belgique le BCE EST le n° TVA. Renvoie { name, address } ou
    /// (null, null) si l'entreprise n'est pas enregistrée ou si VIES est indisponible.
    /// Toujours fail-open : ne JAMAIS bloquer le signup à cause d'un VIES en panne.
    /// </summary>
    private async Task<(string? Name, string? Address)> TryViesLookupAsync(string bce, CancellationToken ct)
    {
        try
        {
            var http = _httpFactory.CreateClient(ViesClientName);
            // Endpoint REST : /ms/{country}/vat/{number} — country = BE pour Belgique.
            using var resp = await http.GetAsync($"ms/BE/vat/{bce}", ct);
            if (!resp.IsSuccessStatusCode)
            {
                _log.LogDebug("VIES a renvoyé {Status} pour BCE {Bce}.", resp.StatusCode, bce);
                return (null, null);
            }

            using var stream = await resp.Content.ReadAsStreamAsync(ct);
            using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
            var root = doc.RootElement;

            // VIES renvoie isValid=false si l'entreprise n'est pas enregistrée TVA
            // (cas légitime : asbl, indépendants en franchise…). On ne traite pas
            // ça comme une erreur — on laisse simplement les champs vides.
            var isValid = root.TryGetProperty("isValid", out var v) && v.ValueKind == JsonValueKind.True;
            if (!isValid)
            {
                _log.LogDebug("VIES : BCE {Bce} non enregistré TVA (asbl / franchise probablement).", bce);
                return (null, null);
            }

            string? name = root.TryGetProperty("name", out var n) && n.ValueKind == JsonValueKind.String
                ? n.GetString()?.Trim()
                : null;
            string? address = root.TryGetProperty("address", out var a) && a.ValueKind == JsonValueKind.String
                ? NormalizeViesAddress(a.GetString())
                : null;

            // VIES renvoie parfois "---" comme nom quand l'État membre masque la donnée
            // (option opt-out côté entreprise). On filtre ces placeholders inutiles.
            if (!string.IsNullOrWhiteSpace(name) && (name == "---" || name.StartsWith("Reserved", StringComparison.OrdinalIgnoreCase)))
                name = null;
            if (!string.IsNullOrWhiteSpace(address) && address == "---")
                address = null;

            return (name, address);
        }
        catch (Exception ex)
        {
            _log.LogDebug(ex, "VIES indisponible pour BCE {Bce} (fail-open).", bce);
            return (null, null);
        }
    }

    /// <summary>VIES renvoie l'adresse en multi-lignes (séparées par \n). On la
    /// reformate en une seule ligne lisible séparée par des virgules pour qu'elle
    /// s'affiche proprement dans la carte d'aide UI (identique à Sirene FR).</summary>
    private static string? NormalizeViesAddress(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var lines = raw.Split(new[] { '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var joined = string.Join(", ", lines);
        return string.IsNullOrWhiteSpace(joined) ? null : joined;
    }

    private static string? FormatCbeAddress(JsonElement addr)
    {
        string? Get(string prop) => addr.TryGetProperty(prop, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;
        var street = Get("street") ?? Get("street_name");
        var num = Get("street_number") ?? Get("number");
        var zip = Get("zipcode") ?? Get("postal_code") ?? Get("zip");
        var city = Get("city") ?? Get("municipality");
        var box = Get("box") ?? Get("box_number");
        var rue = string.Join(' ', new[] { num, street, string.IsNullOrWhiteSpace(box) ? null : $"bte {box}" }
                                    .Where(s => !string.IsNullOrWhiteSpace(s)));
        var full = string.Join(", ", new[] { rue, $"{zip} {city}".Trim() }.Where(s => !string.IsNullOrWhiteSpace(s)));
        return string.IsNullOrWhiteSpace(full) ? null : full;
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

    // ─────────────────────────────────────────────────────────────────────────
    // 🇹🇳 TUNISIE — Matricule Fiscal :
    //   - Forme courte (matricule de base) : 7 chiffres + 1 lettre clé. Ex: 1234567A
    //   - Forme complète (utilisée sur les factures TVA) : 7 chiffres + 1 lettre clé
    //     + code TVA (1 lettre : A/B/N/P/D) + code catégorie (1 lettre : M/P/C/N/S)
    //     + 3 chiffres établissement. Ex: 1234567AAM001 (12-13 chars).
    // Aucune API publique gratuite ne permet de valider l'existence côté DGI tunisienne
    // (le portail e-services nécessite une auth professionnelle), donc validation
    // format uniquement — l'unicité est garantie par UX_Tenants_Siret_Active en DB.
    // ─────────────────────────────────────────────────────────────────────────
    private static readonly Regex TunisianMatriculeFiscal = new(
        "^[0-9]{7}[A-Z]([A-Z]{1,3}[0-9]{0,3})?$",
        RegexOptions.Compiled);

    private static SiretValidationResult ValidateTunisia(string matricule)
    {
        // Normalisation : upper-case pour accepter aussi bien "1234567a" que "1234567A".
        // Le caller a déjà stripé espaces/tirets/points dans ValidateAsync.
        var normalized = matricule.ToUpperInvariant();
        if (!TunisianMatriculeFiscal.IsMatch(normalized))
            return new(false, "siret_format",
                "Le Matricule Fiscal tunisien doit contenir 7 chiffres + 1 lettre clé " +
                "(forme courte, ex: 1234567A) ou inclure les codes TVA/établissement " +
                "(ex: 1234567AAM001).",
                null);
        return new(true, null, null, null);
    }
}
