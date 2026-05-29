using System.Net.Http.Json;
using System.Text.Json.Serialization;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Services;

public interface IFrenchCitiesImportService
{
    /// <summary>
    /// Importe les villes du pays indiqué (ISO-2 : FR, BE, MA, SN…). Si null/inconnu,
    /// retombe sur la France.
    /// </summary>
    Task<FrenchCitiesImportReport> ImportAsync(string? countryCode, CancellationToken ct = default);
}

public sealed record FrenchCitiesImportReport(int TotalFetched, int Inserted, int Skipped);

/// <summary>
/// Importe les villes selon le pays souscrit par le tenant.
///   • France (FR) → https://geo.api.gouv.fr/communes (code INSEE + population, gratuit, sans clé).
///   • Autres pays → https://countriesnow.space/api/v0.1/countries/cities (liste de villes par pays,
///     gratuit, sans clé). Pas de code officiel renvoyé : on génère un Vilcod séquentiel à partir
///     d'une base haute (≥ 900000) pour ne pas entrer en collision avec les codes INSEE (5 chiffres).
///
/// Import idempotent : on saute les villes déjà présentes (par code pour la France, par libellé
/// pour les autres pays).
/// </summary>
public class FrenchCitiesImportService : IFrenchCitiesImportService
{
    private const string FranceApiUrl = "https://geo.api.gouv.fr/communes?fields=code,nom,population&format=json&geometry=centre";
    private const string CountriesNowUrl = "https://countriesnow.space/api/v0.1/countries/cities";
    private const int TopCitiesCount = 300;
    // Base des codes générés (pays hors France) — au-dessus des codes INSEE (≤ 99999).
    private const int GeneratedCodeBase = 900000;

    // ISO-2 → nom anglais attendu par countriesnow.space.
    private static readonly Dictionary<string, string> CountryNames = new(StringComparer.OrdinalIgnoreCase)
    {
        ["FR"] = "France", ["BE"] = "Belgium", ["MA"] = "Morocco", ["SN"] = "Senegal",
        ["DZ"] = "Algeria", ["TN"] = "Tunisia", ["CI"] = "Ivory Coast", ["DE"] = "Germany",
        ["ES"] = "Spain", ["IT"] = "Italy", ["PT"] = "Portugal", ["GB"] = "United Kingdom",
        ["NL"] = "Netherlands", ["LU"] = "Luxembourg", ["CH"] = "Switzerland", ["CA"] = "Canada",
        ["US"] = "United States", ["CM"] = "Cameroon", ["ML"] = "Mali", ["BF"] = "Burkina Faso",
    };

    private readonly IHttpClientFactory _httpFactory;
    private readonly ApplicationDbContext _db;
    private readonly ILogger<FrenchCitiesImportService> _log;

    public FrenchCitiesImportService(IHttpClientFactory httpFactory, ApplicationDbContext db, ILogger<FrenchCitiesImportService> log)
    {
        _httpFactory = httpFactory;
        _db = db;
        _log = log;
    }

    private sealed record CityRow(string Name, string? Code);

    public async Task<FrenchCitiesImportReport> ImportAsync(string? countryCode, CancellationToken ct = default)
    {
        // S'assure que la colonne vilcod accepte 6 chars avant d'insérer un code (INSEE ou généré).
        await BaseDataSchemaMigrator.MigrateAsync(_db, ct);

        var cc = string.IsNullOrWhiteSpace(countryCode) ? "FR" : countryCode.Trim().ToUpperInvariant();

        var http = _httpFactory.CreateClient();
        http.Timeout = TimeSpan.FromSeconds(30);

        var cities = cc == "FR"
            ? await FetchFranceAsync(http, ct)
            : await FetchCountriesNowAsync(http, cc, ct);

        if (cities.Count == 0)
            return new FrenchCitiesImportReport(0, 0, 0);

        var existingCodes = await _db.Villes.Select(v => v.Vilcod).ToListAsync(ct);
        var existingCodeSet = new HashSet<string>(existingCodes.Where(c => c != null)!, StringComparer.OrdinalIgnoreCase);
        var existingNames = await _db.Villes.Select(v => v.Villib).ToListAsync(ct);
        var existingNameSet = new HashSet<string>(
            existingNames.Where(n => !string.IsNullOrWhiteSpace(n)).Select(n => n!.Trim().ToLowerInvariant()));

        // Compteur pour les codes générés (pays hors France) : on part du max existant ≥ base.
        var maxGenerated = existingCodeSet
            .Select(c => int.TryParse(c, out var n) ? n : 0)
            .Where(n => n >= GeneratedCodeBase)
            .DefaultIfEmpty(GeneratedCodeBase)
            .Max();
        var nextCode = maxGenerated + 1;

        var inserted = 0;
        var skipped = 0;
        foreach (var c in cities)
        {
            var nameKey = c.Name.Trim().ToLowerInvariant();
            string code;
            if (c.Code != null)
            {
                // France : dédoublonnage par code INSEE (comportement historique).
                if (existingCodeSet.Contains(c.Code)) { skipped++; continue; }
                code = c.Code;
            }
            else
            {
                // Autres pays : pas de code officiel → dédoublonnage par libellé + code généré.
                if (existingNameSet.Contains(nameKey)) { skipped++; continue; }
                code = nextCode.ToString();
                nextCode++;
            }

            var libelle = c.Name.Length > 100 ? c.Name.Substring(0, 100) : c.Name;
            _db.Villes.Add(new Ville { Vilcod = code, Villib = libelle, CreatedAt = DateTime.UtcNow });
            existingCodeSet.Add(code);
            existingNameSet.Add(nameKey);
            inserted++;
        }

        if (inserted > 0)
            await _db.SaveChangesAsync(ct);

        _log.LogInformation("Import villes {Country} : {Inserted} insérées, {Skipped} ignorées.", cc, inserted, skipped);
        return new FrenchCitiesImportReport(cities.Count, inserted, skipped);
    }

    private async Task<List<CityRow>> FetchFranceAsync(HttpClient http, CancellationToken ct)
    {
        List<GeoApiCommune> communes;
        try
        {
            communes = await http.GetFromJsonAsync<List<GeoApiCommune>>(FranceApiUrl, ct) ?? new();
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Échec de l'appel à geo.api.gouv.fr");
            throw;
        }

        return communes
            .Where(c => !string.IsNullOrWhiteSpace(c.Code) && !string.IsNullOrWhiteSpace(c.Nom))
            .OrderByDescending(c => c.Population ?? 0)
            .Take(TopCitiesCount)
            .Select(c => new CityRow(c.Nom!, c.Code!))
            .ToList();
    }

    private async Task<List<CityRow>> FetchCountriesNowAsync(HttpClient http, string iso2, CancellationToken ct)
    {
        if (!CountryNames.TryGetValue(iso2, out var countryName))
        {
            _log.LogWarning("Import villes : pays {Iso2} non mappé pour countriesnow.space — aucun import.", iso2);
            return new();
        }

        CountriesNowResponse? resp;
        try
        {
            using var res = await http.PostAsJsonAsync(CountriesNowUrl, new { country = countryName }, ct);
            res.EnsureSuccessStatusCode();
            resp = await res.Content.ReadFromJsonAsync<CountriesNowResponse>(cancellationToken: ct);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Échec de l'appel à countriesnow.space pour {Country}", countryName);
            throw;
        }

        var data = resp?.Data ?? new List<string>();
        return data
            .Where(n => !string.IsNullOrWhiteSpace(n))
            .Select(n => n.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(TopCitiesCount)
            .Select(n => new CityRow(n, null))
            .ToList();
    }

    private sealed class GeoApiCommune
    {
        [JsonPropertyName("code")] public string? Code { get; set; }
        [JsonPropertyName("nom")] public string? Nom { get; set; }
        [JsonPropertyName("population")] public int? Population { get; set; }
    }

    private sealed class CountriesNowResponse
    {
        [JsonPropertyName("error")] public bool Error { get; set; }
        [JsonPropertyName("msg")] public string? Msg { get; set; }
        [JsonPropertyName("data")] public List<string>? Data { get; set; }
    }
}
