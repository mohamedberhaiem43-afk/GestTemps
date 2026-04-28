using System.Net.Http.Json;
using System.Text.Json.Serialization;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Services;

public interface IFrenchCitiesImportService
{
    Task<FrenchCitiesImportReport> ImportAsync(CancellationToken ct = default);
}

public sealed record FrenchCitiesImportReport(int TotalFetched, int Inserted, int Skipped);

/// <summary>
/// Importe les communes françaises depuis l'API publique gratuite du gouvernement :
/// https://geo.api.gouv.fr/communes (≈ 35 000 communes, sans clé d'API).
///
/// Stratégie : on utilise le code INSEE (5 chiffres) comme Vilcod. Les villes
/// déjà présentes (par code) sont sautées — l'import est donc idempotent et on
/// peut le relancer pour rattraper de nouvelles communes sans casser les
/// références existantes (Employe.Vilcod, etc.).
/// </summary>
public class FrenchCitiesImportService : IFrenchCitiesImportService
{
    // On demande nom + code + population, et on garde uniquement les 200 plus peuplées.
    // Importer 35 000 communes faisait sauter la mémoire / le timeout HTTP — 200 villes
    // couvrent largement les besoins business (toutes les préfectures + grandes agglos).
    private const string ApiUrl = "https://geo.api.gouv.fr/communes?fields=code,nom,population&format=json&geometry=centre";
    private const int TopCitiesCount = 200;

    private readonly IHttpClientFactory _httpFactory;
    private readonly ApplicationDbContext _db;
    private readonly ILogger<FrenchCitiesImportService> _log;

    public FrenchCitiesImportService(IHttpClientFactory httpFactory, ApplicationDbContext db, ILogger<FrenchCitiesImportService> log)
    {
        _httpFactory = httpFactory;
        _db = db;
        _log = log;
    }

    public async Task<FrenchCitiesImportReport> ImportAsync(CancellationToken ct = default)
    {
        // S'assure que la colonne vilcod accepte 6 chars avant d'insérer un code INSEE de 5 chiffres.
        await BaseDataSchemaMigrator.MigrateAsync(_db, ct);

        var http = _httpFactory.CreateClient();
        http.Timeout = TimeSpan.FromSeconds(30);

        List<GeoApiCommune> communes;
        try
        {
            communes = await http.GetFromJsonAsync<List<GeoApiCommune>>(ApiUrl, ct)
                ?? new List<GeoApiCommune>();
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Échec de l'appel à geo.api.gouv.fr");
            throw;
        }

        if (communes.Count == 0)
        {
            return new FrenchCitiesImportReport(0, 0, 0);
        }

        // Trier par population décroissante et garder les 200 plus peuplées : couvre Paris,
        // Marseille, Lyon, … jusqu'aux préfectures et chefs-lieux. Les communes sans population
        // renseignée sont relégées en fin de liste.
        var topCities = communes
            .Where(c => !string.IsNullOrWhiteSpace(c.Code) && !string.IsNullOrWhiteSpace(c.Nom))
            .OrderByDescending(c => c.Population ?? 0)
            .Take(TopCitiesCount)
            .ToList();

        // Pré-charge l'ensemble des codes existants pour éviter N round-trips DB.
        var existingCodes = await _db.Villes.Select(v => v.Vilcod).ToListAsync(ct);
        var existingSet = new HashSet<string>(existingCodes, StringComparer.OrdinalIgnoreCase);

        var inserted = 0;
        var skipped = 0;
        foreach (var c in topCities)
        {
            if (existingSet.Contains(c.Code!))
            {
                skipped++; continue;
            }
            var libelle = c.Nom!.Length > 100 ? c.Nom.Substring(0, 100) : c.Nom;
            _db.Villes.Add(new Ville
            {
                Vilcod = c.Code!,
                Villib = libelle,
                CreatedAt = DateTime.UtcNow,
            });
            existingSet.Add(c.Code!);
            inserted++;
        }
        // Un seul SaveChanges pour 200 lignes : pas de pression connection-pool.
        if (inserted > 0)
        {
            await _db.SaveChangesAsync(ct);
        }

        _log.LogInformation("Import villes France (top {Top}) : {Inserted} insérées, {Skipped} ignorées.",
            TopCitiesCount, inserted, skipped);
        return new FrenchCitiesImportReport(topCities.Count, inserted, skipped);
    }

    private sealed class GeoApiCommune
    {
        [JsonPropertyName("code")]
        public string? Code { get; set; }

        [JsonPropertyName("nom")]
        public string? Nom { get; set; }

        [JsonPropertyName("population")]
        public int? Population { get; set; }
    }
}
