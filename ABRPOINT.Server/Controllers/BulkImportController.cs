using ABRPOINT.Server.Data;
using ABRPOINT.Server.Helpers;
using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Controllers;

/// <summary>
/// Imports en masse depuis Excel : le frontend parse le .xlsx avec SheetJS, envoie les
/// lignes en JSON. Pour chaque entité, on auto-génère le code (séquentiel) et, dans le
/// cas des employés, on crée à la volée les Services / Fonctions référencés par libellé
/// si ils n'existent pas encore — ainsi un import depuis un fichier RH "brut" ne casse pas.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class BulkImportController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly ILogger<BulkImportController> _log;

    public BulkImportController(ApplicationDbContext db, ILogger<BulkImportController> log)
    {
        _db = db;
        _log = log;
    }

    public sealed record ImportReport(int Inserted, int Skipped, int Created, List<string> Errors);

    public sealed class ServiceRow { public string? Serlib { get; set; } }
    public sealed class FonctionRow { public string? Fonlib { get; set; } public string? Fontype { get; set; } }
    public sealed class EmployeRow
    {
        public string? Empcod { get; set; }
        public string? Emplib { get; set; }
        public string? Emplnais { get; set; }
        public string? Empdnais { get; set; }
        public string? Empsexe { get; set; }
        public string? Empcin { get; set; }
        public string? Emptel { get; set; }
        public string? Empemail { get; set; }
        public string? Empadr { get; set; }
        public string? Empemb { get; set; } // ISO date string
        public string? ServiceLib { get; set; }
        public string? FonctionLib { get; set; }
    }

    public sealed class ServicesImportRequest { public List<ServiceRow> Rows { get; set; } = new(); public string? Soccod { get; set; } }
    public sealed class FonctionsImportRequest { public List<FonctionRow> Rows { get; set; } = new(); public string? Soccod { get; set; } }
    public sealed class EmployesImportRequest { public List<EmployeRow> Rows { get; set; } = new(); public string Soccod { get; set; } = ""; public string Sitcod { get; set; } = "01"; }

    [HttpPost("services")]
    public async Task<ActionResult<ImportReport>> ImportServices([FromBody] ServicesImportRequest req)
    {
        if (req.Rows == null || req.Rows.Count == 0) return BadRequest(new { error = "Aucune ligne." });
        var soccod = string.IsNullOrWhiteSpace(req.Soccod)
            ? (await _db.Societes.Select(s => s.Soccod).FirstOrDefaultAsync() ?? "01")
            : req.Soccod;

        var existing = (await _db.Services.Where(s => s.Soccod == soccod).Select(s => s.Serlib).ToListAsync())
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(x => x!.Trim().ToLowerInvariant())
            .ToHashSet();
        var inserted = 0; var skipped = 0; var errors = new List<string>();

        foreach (var row in req.Rows)
        {
            var lib = row.Serlib?.Trim();
            if (string.IsNullOrWhiteSpace(lib)) { skipped++; continue; }
            if (existing.Contains(lib.ToLowerInvariant())) { skipped++; continue; }
            try
            {
                var code = await SequentialCodeGenerator.NextServiceCodeAsync(_db, soccod);
                _db.Services.Add(new Service { Sercod = code, Soccod = soccod, Serlib = lib, CreatedAt = DateTime.UtcNow });
                await _db.SaveChangesAsync();
                existing.Add(lib.ToLowerInvariant());
                inserted++;
            }
            catch (Exception ex) { errors.Add($"{lib}: {ex.Message}"); }
        }
        return Ok(new ImportReport(inserted, skipped, 0, errors));
    }

    [HttpPost("fonctions")]
    public async Task<ActionResult<ImportReport>> ImportFonctions([FromBody] FonctionsImportRequest req)
    {
        if (req.Rows == null || req.Rows.Count == 0) return BadRequest(new { error = "Aucune ligne." });
        var soccod = string.IsNullOrWhiteSpace(req.Soccod)
            ? (await _db.Societes.Select(s => s.Soccod).FirstOrDefaultAsync() ?? "01")
            : req.Soccod;

        var existing = (await _db.Fonctions.Where(f => f.Soccod == soccod).Select(f => f.Fonlib).ToListAsync())
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(x => x!.Trim().ToLowerInvariant())
            .ToHashSet();
        var inserted = 0; var skipped = 0; var errors = new List<string>();

        foreach (var row in req.Rows)
        {
            var lib = row.Fonlib?.Trim();
            if (string.IsNullOrWhiteSpace(lib)) { skipped++; continue; }
            if (existing.Contains(lib.ToLowerInvariant())) { skipped++; continue; }
            try
            {
                var code = await SequentialCodeGenerator.NextFonctionCodeAsync(_db, soccod);
                _db.Fonctions.Add(new Fonction { Foncod = code, Soccod = soccod, Fonlib = lib, Fontype = row.Fontype?.Trim(), CreatedAt = DateTime.UtcNow });
                await _db.SaveChangesAsync();
                existing.Add(lib.ToLowerInvariant());
                inserted++;
            }
            catch (Exception ex) { errors.Add($"{lib}: {ex.Message}"); }
        }
        return Ok(new ImportReport(inserted, skipped, 0, errors));
    }

    /// <summary>
    /// Import employés. Auto-création des Service/Fonction par libellé s'ils n'existent pas.
    /// `Created` dans le report = nombre de Services + Fonctions créés à la volée.
    /// </summary>
    [HttpPost("employes")]
    public async Task<ActionResult<ImportReport>> ImportEmployes([FromBody] EmployesImportRequest req)
    {
        if (req.Rows == null || req.Rows.Count == 0) return BadRequest(new { error = "Aucune ligne." });
        if (string.IsNullOrWhiteSpace(req.Soccod)) return BadRequest(new { error = "Soccod requis." });
        var soccod = req.Soccod;
        var sitcod = string.IsNullOrWhiteSpace(req.Sitcod) ? "01" : req.Sitcod;

        // Maps libellé → code (insensible à la casse).
        var serviceMap = (await _db.Services
            .Where(s => s.Soccod == soccod)
            .Select(s => new { s.Sercod, s.Serlib })
            .ToListAsync())
            .Where(s => !string.IsNullOrWhiteSpace(s.Serlib))
            .GroupBy(s => s.Serlib!.Trim().ToLowerInvariant())
            .ToDictionary(g => g.Key, g => g.First().Sercod);
        var fonctionMap = (await _db.Fonctions
            .Where(f => f.Soccod == soccod)
            .Select(f => new { f.Foncod, f.Fonlib })
            .ToListAsync())
            .Where(f => !string.IsNullOrWhiteSpace(f.Fonlib))
            .GroupBy(f => f.Fonlib!.Trim().ToLowerInvariant())
            .ToDictionary(g => g.Key, g => g.First().Foncod);

        var existingEmpcods = (await _db.Employes
            .Where(e => e.Soccod == soccod && e.Sitcod == sitcod)
            .Select(e => e.Empcod)
            .ToListAsync())
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var inserted = 0; var skipped = 0; var created = 0; var errors = new List<string>();

        foreach (var row in req.Rows)
        {
            var name = row.Emplib?.Trim();
            if (string.IsNullOrWhiteSpace(name)) { skipped++; continue; }

            try
            {
                // Auto-création Service si nécessaire.
                string? sercod = null;
                if (!string.IsNullOrWhiteSpace(row.ServiceLib))
                {
                    var key = row.ServiceLib.Trim().ToLowerInvariant();
                    if (!serviceMap.TryGetValue(key, out sercod))
                    {
                        sercod = await SequentialCodeGenerator.NextServiceCodeAsync(_db, soccod);
                        _db.Services.Add(new Service { Sercod = sercod, Soccod = soccod, Serlib = row.ServiceLib.Trim(), CreatedAt = DateTime.UtcNow });
                        await _db.SaveChangesAsync();
                        serviceMap[key] = sercod;
                        created++;
                    }
                }
                // Auto-création Fonction si nécessaire.
                string? foncod = null;
                if (!string.IsNullOrWhiteSpace(row.FonctionLib))
                {
                    var key = row.FonctionLib.Trim().ToLowerInvariant();
                    if (!fonctionMap.TryGetValue(key, out foncod))
                    {
                        foncod = await SequentialCodeGenerator.NextFonctionCodeAsync(_db, soccod);
                        _db.Fonctions.Add(new Fonction { Foncod = foncod, Soccod = soccod, Fonlib = row.FonctionLib.Trim(), CreatedAt = DateTime.UtcNow });
                        await _db.SaveChangesAsync();
                        fonctionMap[key] = foncod;
                        created++;
                    }
                }

                // Empcod : utilise celui fourni ou auto-génère un code séquentiel sur 6 chiffres.
                var empcod = row.Empcod?.Trim();
                if (string.IsNullOrWhiteSpace(empcod))
                {
                    var existingCount = await _db.Employes.CountAsync(e => e.Soccod == soccod);
                    empcod = (existingCount + inserted + 1).ToString().PadLeft(6, '0');
                }
                if (existingEmpcods.Contains(empcod)) { skipped++; continue; }

                DateTime? embDate = null;
                if (!string.IsNullOrWhiteSpace(row.Empemb) && DateTime.TryParse(row.Empemb, out var d)) embDate = d;

                _db.Employes.Add(new Employe
                {
                    Empcod = empcod,
                    Soccod = soccod,
                    Sitcod = sitcod,
                    Emplib = name,
                    Sercod = sercod,
                    Foncod = foncod,
                    Empcin = row.Empcin?.Trim(),
                    Emptel = row.Emptel?.Trim(),
                    Empemail = row.Empemail?.Trim(),
                    Empadr = row.Empadr?.Trim(),
                    Empsexe = row.Empsexe?.Trim(),
                    Emplnais = row.Emplnais?.Trim(),
                    Empdnais = row.Empdnais?.Trim(),
                    Empemb = embDate,
                    Actif = "1",
                    CreatedAt = DateTime.UtcNow,
                });
                await _db.SaveChangesAsync();
                existingEmpcods.Add(empcod);
                inserted++;
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "Import employé échoué pour {Name}", name);
                errors.Add($"{name}: {ex.Message}");
            }
        }
        return Ok(new ImportReport(inserted, skipped, created, errors));
    }
}
