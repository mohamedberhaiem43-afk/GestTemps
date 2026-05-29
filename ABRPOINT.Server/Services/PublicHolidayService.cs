using System.Net.Http.Json;
using System.Text.Json.Serialization;

namespace ABRPOINT.Server.Services;

/// <summary>
/// Fournit les jours fériés officiels selon le pays souscrit par le tenant, pour une année donnée.
///   • France (FR)        → API officielle calendrier.api.gouv.fr (la plus précise).
///   • Pays couverts Nager → date.nager.at (≈110 pays : BE, DE, ES, IT, PT, GB, NL, LU, CH, CA, US…).
///   • Pays non couverts   → liste interne des fériés civils fixes (Maroc, Sénégal, générique).
///
/// Les fériés religieux musulmans (Aïd, Mouloud…) suivent le calendrier lunaire et ne sont pas
/// inclus dans le fallback : l'utilisateur les ajoute manuellement (dates variables chaque année).
/// </summary>
public interface IPublicHolidayService
{
    Task<List<PublicHolidayDto>> GetAsync(string? countryCode, int year, CancellationToken ct = default);
}

public sealed record PublicHolidayDto(string Date, string Label, bool Fixed);

public class PublicHolidayService : IPublicHolidayService
{
    private readonly IHttpClientFactory _httpFactory;
    private readonly ILogger<PublicHolidayService> _log;

    public PublicHolidayService(IHttpClientFactory httpFactory, ILogger<PublicHolidayService> log)
    {
        _httpFactory = httpFactory;
        _log = log;
    }

    // Dates fixes métropole FR (mm-dd) → pré-cochage « fixe (annuel) ».
    private static readonly HashSet<string> FrFixed = new()
    { "01-01", "05-01", "05-08", "07-14", "08-15", "11-01", "11-11", "12-25" };

    // Fallback « par connaissance » : fériés civils FIXES par pays (mm-dd → libellé).
    private static readonly Dictionary<string, Dictionary<string, string>> FallbackFixed =
        new(StringComparer.OrdinalIgnoreCase)
    {
        ["MA"] = new()
        {
            ["01-01"] = "Nouvel An", ["01-11"] = "Manifeste de l'Indépendance",
            ["05-01"] = "Fête du Travail", ["07-30"] = "Fête du Trône",
            ["08-14"] = "Oued Ed-Dahab", ["08-20"] = "Révolution du Roi et du Peuple",
            ["08-21"] = "Fête de la Jeunesse", ["11-06"] = "Marche Verte",
            ["11-18"] = "Fête de l'Indépendance",
        },
        ["SN"] = new()
        {
            ["01-01"] = "Nouvel An", ["04-04"] = "Fête de l'Indépendance",
            ["05-01"] = "Fête du Travail", ["08-15"] = "Assomption",
            ["11-01"] = "Toussaint", ["12-25"] = "Noël",
        },
        ["DZ"] = new()
        {
            ["01-01"] = "Nouvel An", ["01-12"] = "Yennayer", ["05-01"] = "Fête du Travail",
            ["07-05"] = "Fête de l'Indépendance", ["11-01"] = "Révolution du 1er Novembre",
        },
        ["TN"] = new()
        {
            ["01-01"] = "Nouvel An", ["03-20"] = "Fête de l'Indépendance",
            ["04-09"] = "Jour des Martyrs", ["05-01"] = "Fête du Travail",
            ["07-25"] = "Fête de la République", ["08-13"] = "Fête de la Femme",
            ["10-15"] = "Fête de l'Évacuation",
        },
    };

    // Générique si pays totalement inconnu.
    private static readonly Dictionary<string, string> GenericFixed = new()
    { ["01-01"] = "Nouvel An", ["05-01"] = "Fête du Travail", ["12-25"] = "Noël" };

    public async Task<List<PublicHolidayDto>> GetAsync(string? countryCode, int year, CancellationToken ct = default)
    {
        var cc = string.IsNullOrWhiteSpace(countryCode) ? "FR" : countryCode.Trim().ToUpperInvariant();
        var http = _httpFactory.CreateClient();
        http.Timeout = TimeSpan.FromSeconds(15);

        if (cc == "FR")
        {
            var fr = await TryFranceAsync(http, year, ct);
            if (fr.Count > 0) return fr;
        }
        else
        {
            var nager = await TryNagerAsync(http, cc, year, ct);
            if (nager.Count > 0) return nager;
        }

        // Fallback connaissance interne (pays non couverts par les API).
        var map = FallbackFixed.TryGetValue(cc, out var m) ? m : GenericFixed;
        return map
            .Select(kv => new PublicHolidayDto($"{year:D4}-{kv.Key}", kv.Value, true))
            .OrderBy(h => h.Date)
            .ToList();
    }

    private async Task<List<PublicHolidayDto>> TryFranceAsync(HttpClient http, int year, CancellationToken ct)
    {
        try
        {
            var url = $"https://calendrier.api.gouv.fr/jours-feries/metropole/{year}.json";
            var data = await http.GetFromJsonAsync<Dictionary<string, string>>(url, ct);
            if (data == null) return new();
            return data
                .Select(kv => new PublicHolidayDto(kv.Key, kv.Value, FrFixed.Contains(kv.Key.Length >= 10 ? kv.Key.Substring(5) : kv.Key)))
                .OrderBy(h => h.Date)
                .ToList();
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "API jours fériés FR indisponible — fallback.");
            return new();
        }
    }

    private async Task<List<PublicHolidayDto>> TryNagerAsync(HttpClient http, string iso2, int year, CancellationToken ct)
    {
        try
        {
            var url = $"https://date.nager.at/api/v3/PublicHolidays/{year}/{iso2}";
            using var res = await http.GetAsync(url, ct);
            if (!res.IsSuccessStatusCode) return new(); // 404 → pays non couvert → fallback
            var items = await res.Content.ReadFromJsonAsync<List<NagerHoliday>>(cancellationToken: ct);
            if (items == null) return new();
            return items
                .Where(i => !string.IsNullOrWhiteSpace(i.Date))
                .Select(i => new PublicHolidayDto(i.Date!, i.LocalName ?? i.Name ?? i.Date!, i.Fixed))
                .OrderBy(h => h.Date)
                .ToList();
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "API Nager.Date indisponible pour {Iso2} — fallback.", iso2);
            return new();
        }
    }

    private sealed class NagerHoliday
    {
        [JsonPropertyName("date")] public string? Date { get; set; }
        [JsonPropertyName("localName")] public string? LocalName { get; set; }
        [JsonPropertyName("name")] public string? Name { get; set; }
        [JsonPropertyName("fixed")] public bool Fixed { get; set; }
    }
}
