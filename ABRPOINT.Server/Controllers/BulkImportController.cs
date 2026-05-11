using ABRPOINT.Server.Annotations.AdminAttributes;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Helpers;
using ABRPOINT.Server.Models;
using ABRPOINT.Server.Services;
using ABRPOINT.Server.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Controllers;

/// <summary>
/// Imports en masse depuis Excel : le frontend parse le .xlsx avec SheetJS, envoie les
/// lignes en JSON. Pour chaque entité, on auto-génère le code (séquentiel) et, dans le
/// cas des employés, on crée à la volée les Services / Fonctions référencés par libellé
/// si ils n'existent pas encore — ainsi un import depuis un fichier RH "brut" ne casse pas.
/// </summary>
// SEC-10 — Imports en masse réservés aux admins. Les opérations exposées (création
// d'employés, services, fonctions, directions, villes, pays) sont destructives à
// l'échelle du tenant ; sans `[Admin]` n'importe quel utilisateur authentifié pouvait
// les déclencher.
[ApiController]
[Route("api/[controller]")]
[Authorize]
[Admin]
[EnableRateLimiting("bulk-import")] // SEC-29 — 10 imports/heure/user max.
public class BulkImportController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly ICurrentTenant _currentTenant;
    private readonly ILogger<BulkImportController> _log;
    private readonly EncryptionService _encryptionService;

    public BulkImportController(ApplicationDbContext db, ICurrentTenant currentTenant, ILogger<BulkImportController> log, EncryptionService encryptionService)
    {
        _db = db;
        _currentTenant = currentTenant;
        _log = log;
        _encryptionService = encryptionService;
    }

    public sealed record ImportReport(int Inserted, int Skipped, int Created, List<string> Errors);

    public sealed class ServiceRow { public string? Serlib { get; set; } public string? Serloc { get; set; } }
    public sealed class FonctionRow { public string? Fonlib { get; set; } public string? Fontype { get; set; } }
    public sealed class DirectionRow
    {
        public string? Dircod { get; set; }
        public string? Dirlib { get; set; }
        public string? Dirloc { get; set; }
        public string? Diremail { get; set; }
        public string? Dirresp { get; set; }
    }
    public sealed class SectionRow
    {
        public string? Seccod { get; set; }
        public string? Seclib { get; set; }
        public string? Sectype { get; set; }
    }
    public sealed class VilleRow { public string? Vilcod { get; set; } public string? Villib { get; set; } }
    public sealed class PaysRow { public string? Natcod { get; set; } public string? Natlib { get; set; } }
    public sealed class QualificationRow { public string? Qualib { get; set; } public string? Catcod { get; set; } }
    public sealed class RubriqueRow
    {
        public string? Rubcod { get; set; }
        public string? Rublib { get; set; }
        public string? Rubunite { get; set; }
        public string? Vartype { get; set; }
    }
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
    public sealed class DirectionsImportRequest { public List<DirectionRow> Rows { get; set; } = new(); public string? Soccod { get; set; } }
    public sealed class SectionsImportRequest { public List<SectionRow> Rows { get; set; } = new(); public string? Soccod { get; set; } }
    public sealed class VillesImportRequest { public List<VilleRow> Rows { get; set; } = new(); }
    public sealed class PaysImportRequest { public List<PaysRow> Rows { get; set; } = new(); }
    public sealed class QualificationsImportRequest { public List<QualificationRow> Rows { get; set; } = new(); public string? Soccod { get; set; } }
    public sealed class RubriquesImportRequest { public List<RubriqueRow> Rows { get; set; } = new(); public string? Soccod { get; set; } }
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

        // Quota plan : essai gratuit borné à 10 (cf. TrialPolicy.MaxEmployees).
        // Packs payants (Starter/Standard/Premium) : pas de plafond dur — les salariés
        // au-delà de IncludedEmployees sont facturés via overage (cf. PlanCatalog).
        var limits = TrialPolicy.GetLimits(_currentTenant.Current);
        if (limits.MaxEmployees.HasValue)
        {
            var current = await _db.Employes.CountAsync();
            if (current + req.Rows.Count > limits.MaxEmployees.Value)
            {
                var planLabel = TrialPolicy.IsTrialing(_currentTenant.Current)
                    ? "l'essai gratuit"
                    : $"votre plan {_currentTenant.Current?.PlanCode}";
                return StatusCode(402, new
                {
                    code = "plan_limit_employees",
                    message = $"Limite de {planLabel} atteinte ({limits.MaxEmployees.Value} collaborateurs maximum). Vous avez {current} collaborateurs et tentez d'en ajouter {req.Rows.Count}."
                });
            }
        }

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

                // Empcod : utilise celui fourni ou auto-génère selon le mode paramétré
                // (préfixe société, préfixe nom, ou pur séquentiel).
                var empcod = row.Empcod?.Trim();
                if (string.IsNullOrWhiteSpace(empcod))
                {
                    empcod = await SequentialCodeGenerator.NextEmpcodAsync(_db, soccod, sitcod, name);
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
                    // SEC-10 — Chiffrer CIN/téléphone à l'identique du flux unitaire
                    // (cf. EmployesController.Add). Sans ça, l'import contournait la
                    // protection AES et stockait les données personnelles en clair.
                    Empcin = string.IsNullOrWhiteSpace(row.Empcin) ? null : _encryptionService.Encrypt(row.Empcin.Trim()),
                    Emptel = string.IsNullOrWhiteSpace(row.Emptel) ? null : _encryptionService.Encrypt(row.Emptel.Trim()),
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

    [HttpPost("directions")]
    public async Task<ActionResult<ImportReport>> ImportDirections([FromBody] DirectionsImportRequest req)
    {
        if (req.Rows == null || req.Rows.Count == 0) return BadRequest(new { error = "Aucune ligne." });
        var soccod = string.IsNullOrWhiteSpace(req.Soccod)
            ? (await _db.Societes.Select(s => s.Soccod).FirstOrDefaultAsync() ?? "01")
            : req.Soccod;

        // On dédoublonne par Dircod (clé fonctionnelle) ; à défaut, par libellé.
        var existingCodes = (await _db.Directions.Where(d => d.Soccod == soccod).Select(d => d.Dircod).ToListAsync())
            .Where(c => !string.IsNullOrWhiteSpace(c)).Select(c => c!.Trim().ToUpperInvariant()).ToHashSet();
        var existingLibs = (await _db.Directions.Where(d => d.Soccod == soccod).Select(d => d.Dirlib).ToListAsync())
            .Where(c => !string.IsNullOrWhiteSpace(c)).Select(c => c!.Trim().ToLowerInvariant()).ToHashSet();
        var inserted = 0; var skipped = 0; var errors = new List<string>();

        foreach (var row in req.Rows)
        {
            var lib = row.Dirlib?.Trim();
            if (string.IsNullOrWhiteSpace(lib)) { skipped++; continue; }
            try
            {
                var code = string.IsNullOrWhiteSpace(row.Dircod)
                    ? await SequentialCodeGenerator.NextDirectionCodeAsync(_db, soccod)
                    : row.Dircod!.Trim();
                if (existingCodes.Contains(code.ToUpperInvariant()) || existingLibs.Contains(lib.ToLowerInvariant())) { skipped++; continue; }

                _db.Directions.Add(new Direction
                {
                    Dircod = code, Soccod = soccod, Dirlib = lib,
                    Dirloc = row.Dirloc?.Trim(), Diremail = row.Diremail?.Trim(), Dirresp = row.Dirresp?.Trim(),
                    CreatedAt = DateTime.UtcNow,
                });
                await _db.SaveChangesAsync();
                existingCodes.Add(code.ToUpperInvariant());
                existingLibs.Add(lib.ToLowerInvariant());
                inserted++;
            }
            catch (Exception ex) { errors.Add($"{lib}: {ex.Message}"); }
        }
        return Ok(new ImportReport(inserted, skipped, 0, errors));
    }

    [HttpPost("sections")]
    public async Task<ActionResult<ImportReport>> ImportSections([FromBody] SectionsImportRequest req)
    {
        if (req.Rows == null || req.Rows.Count == 0) return BadRequest(new { error = "Aucune ligne." });
        var soccod = string.IsNullOrWhiteSpace(req.Soccod)
            ? (await _db.Societes.Select(s => s.Soccod).FirstOrDefaultAsync() ?? "01")
            : req.Soccod;

        var existingCodes = (await _db.Sections.Where(s => s.Soccod == soccod).Select(s => s.Seccod).ToListAsync())
            .Where(c => !string.IsNullOrWhiteSpace(c)).Select(c => c!.Trim().ToUpperInvariant()).ToHashSet();
        var existingLibs = (await _db.Sections.Where(s => s.Soccod == soccod).Select(s => s.Seclib).ToListAsync())
            .Where(c => !string.IsNullOrWhiteSpace(c)).Select(c => c!.Trim().ToLowerInvariant()).ToHashSet();
        var inserted = 0; var skipped = 0; var errors = new List<string>();

        foreach (var row in req.Rows)
        {
            var lib = row.Seclib?.Trim();
            if (string.IsNullOrWhiteSpace(lib)) { skipped++; continue; }
            try
            {
                var code = string.IsNullOrWhiteSpace(row.Seccod)
                    ? await SequentialCodeGenerator.NextSectionCodeAsync(_db, soccod)
                    : row.Seccod!.Trim();
                if (existingCodes.Contains(code.ToUpperInvariant()) || existingLibs.Contains(lib.ToLowerInvariant())) { skipped++; continue; }

                _db.Sections.Add(new Section { Seccod = code, Soccod = soccod, Seclib = lib, Sectype = row.Sectype?.Trim(), CreatedAt = DateTime.UtcNow });
                await _db.SaveChangesAsync();
                existingCodes.Add(code.ToUpperInvariant());
                existingLibs.Add(lib.ToLowerInvariant());
                inserted++;
            }
            catch (Exception ex) { errors.Add($"{lib}: {ex.Message}"); }
        }
        return Ok(new ImportReport(inserted, skipped, 0, errors));
    }

    [HttpPost("villes")]
    public async Task<ActionResult<ImportReport>> ImportVilles([FromBody] VillesImportRequest req)
    {
        if (req.Rows == null || req.Rows.Count == 0) return BadRequest(new { error = "Aucune ligne." });
        var existingCodes = (await _db.Villes.Select(v => v.Vilcod).ToListAsync())
            .Where(c => !string.IsNullOrWhiteSpace(c)).Select(c => c!.Trim().ToUpperInvariant()).ToHashSet();
        var inserted = 0; var skipped = 0; var errors = new List<string>();

        foreach (var row in req.Rows)
        {
            var lib = row.Villib?.Trim();
            if (string.IsNullOrWhiteSpace(lib)) { skipped++; continue; }
            try
            {
                var code = string.IsNullOrWhiteSpace(row.Vilcod)
                    ? await SequentialCodeGenerator.NextVilleCodeAsync(_db)
                    : row.Vilcod!.Trim();
                if (existingCodes.Contains(code.ToUpperInvariant())) { skipped++; continue; }

                _db.Villes.Add(new Ville { Vilcod = code, Villib = lib, CreatedAt = DateTime.UtcNow });
                await _db.SaveChangesAsync();
                existingCodes.Add(code.ToUpperInvariant());
                inserted++;
            }
            catch (Exception ex) { errors.Add($"{lib}: {ex.Message}"); }
        }
        return Ok(new ImportReport(inserted, skipped, 0, errors));
    }

    [HttpPost("pays")]
    public async Task<ActionResult<ImportReport>> ImportPays([FromBody] PaysImportRequest req)
    {
        if (req.Rows == null || req.Rows.Count == 0) return BadRequest(new { error = "Aucune ligne." });
        var existingCodes = (await _db.Nations.Select(n => n.Natcod).ToListAsync())
            .Where(c => !string.IsNullOrWhiteSpace(c)).Select(c => c!.Trim().ToUpperInvariant()).ToHashSet();
        var inserted = 0; var skipped = 0; var errors = new List<string>();

        foreach (var row in req.Rows)
        {
            var lib = row.Natlib?.Trim();
            if (string.IsNullOrWhiteSpace(lib)) { skipped++; continue; }
            try
            {
                var code = string.IsNullOrWhiteSpace(row.Natcod)
                    ? await SequentialCodeGenerator.NextNationCodeAsync(_db)
                    : row.Natcod!.Trim();
                if (existingCodes.Contains(code.ToUpperInvariant())) { skipped++; continue; }

                _db.Nations.Add(new Nation { Natcod = code, Natlib = lib, CreatedAt = DateTime.UtcNow });
                await _db.SaveChangesAsync();
                existingCodes.Add(code.ToUpperInvariant());
                inserted++;
            }
            catch (Exception ex) { errors.Add($"{lib}: {ex.Message}"); }
        }
        return Ok(new ImportReport(inserted, skipped, 0, errors));
    }

    [HttpPost("rubriques")]
    public async Task<ActionResult<ImportReport>> ImportRubriques([FromBody] RubriquesImportRequest req)
    {
        if (req.Rows == null || req.Rows.Count == 0) return BadRequest(new { error = "Aucune ligne." });
        var soccod = string.IsNullOrWhiteSpace(req.Soccod)
            ? (await _db.Societes.Select(s => s.Soccod).FirstOrDefaultAsync() ?? "01")
            : req.Soccod;

        // Dédoublonnage par Rubcod (PK fonctionnelle) ET par Rublib (un même libellé
        // ne devrait pas être dupliqué — l'utilisateur retrouverait deux rubriques
        // identiques côté formulaire et l'export paie cumulerait deux fois la grandeur).
        var existingCodes = (await _db.Rubriques.Where(r => r.Soccod == soccod).Select(r => r.Rubcod).ToListAsync())
            .Where(c => !string.IsNullOrWhiteSpace(c)).Select(c => c!.Trim().ToUpperInvariant()).ToHashSet();
        var existingLibs = (await _db.Rubriques.Where(r => r.Soccod == soccod).Select(r => r.Rublib).ToListAsync())
            .Where(c => !string.IsNullOrWhiteSpace(c)).Select(c => c!.Trim().ToLowerInvariant()).ToHashSet();
        var inserted = 0; var skipped = 0; var errors = new List<string>();

        foreach (var row in req.Rows)
        {
            var lib = row.Rublib?.Trim();
            if (string.IsNullOrWhiteSpace(lib)) { skipped++; continue; }
            if (existingLibs.Contains(lib.ToLowerInvariant())) { skipped++; continue; }
            try
            {
                var code = string.IsNullOrWhiteSpace(row.Rubcod)
                    ? await SequentialCodeGenerator.NextRubcodAsync(_db, soccod)
                    : row.Rubcod!.Trim();
                if (existingCodes.Contains(code.ToUpperInvariant())) { skipped++; continue; }

                // Normalisation tolérante : "Heure"/"H"/"Hour" → "H", "Jour"/"J"/"Day" → "J".
                // Les utilisateurs RH écrivent souvent en clair dans le fichier source.
                var rawUnite = row.Rubunite?.Trim().ToUpperInvariant();
                string? unite = rawUnite switch
                {
                    "H" or "HEURE" or "HEURES" or "HOUR" or "HOURS" => "H",
                    "J" or "JOUR" or "JOURS" or "DAY" or "DAYS" => "J",
                    _ => string.IsNullOrEmpty(rawUnite) ? null : rawUnite,
                };

                _db.Rubriques.Add(new Rubrique
                {
                    Rubcod = code,
                    Soccod = soccod,
                    Rublib = lib,
                    Rubunite = unite,
                    Vartype = string.IsNullOrWhiteSpace(row.Vartype) ? null : row.Vartype.Trim().ToUpperInvariant(),
                    CreatedAt = DateTime.UtcNow,
                });
                await _db.SaveChangesAsync();
                existingCodes.Add(code.ToUpperInvariant());
                existingLibs.Add(lib.ToLowerInvariant());
                inserted++;
            }
            catch (Exception ex) { errors.Add($"{lib}: {ex.Message}"); }
        }
        return Ok(new ImportReport(inserted, skipped, 0, errors));
    }

    [HttpPost("qualifications")]
    public async Task<ActionResult<ImportReport>> ImportQualifications([FromBody] QualificationsImportRequest req)
    {
        if (req.Rows == null || req.Rows.Count == 0) return BadRequest(new { error = "Aucune ligne." });
        var soccod = string.IsNullOrWhiteSpace(req.Soccod)
            ? (await _db.Societes.Select(s => s.Soccod).FirstOrDefaultAsync() ?? "01")
            : req.Soccod;

        var existingLibs = (await _db.Qualifs.Where(q => q.Soccod == soccod).Select(q => q.Qualib).ToListAsync())
            .Where(c => !string.IsNullOrWhiteSpace(c)).Select(c => c!.Trim().ToLowerInvariant()).ToHashSet();
        var inserted = 0; var skipped = 0; var errors = new List<string>();

        foreach (var row in req.Rows)
        {
            var lib = row.Qualib?.Trim();
            if (string.IsNullOrWhiteSpace(lib)) { skipped++; continue; }
            if (existingLibs.Contains(lib.ToLowerInvariant())) { skipped++; continue; }
            try
            {
                var code = await SequentialCodeGenerator.NextQualifCodeAsync(_db, soccod);
                _db.Qualifs.Add(new Qualif { Quacod = code, Soccod = soccod, Qualib = lib, Catcod = row.Catcod?.Trim(), CreatedAt = DateTime.UtcNow });
                await _db.SaveChangesAsync();
                existingLibs.Add(lib.ToLowerInvariant());
                inserted++;
            }
            catch (Exception ex) { errors.Add($"{lib}: {ex.Message}"); }
        }
        return Ok(new ImportReport(inserted, skipped, 0, errors));
    }
}
