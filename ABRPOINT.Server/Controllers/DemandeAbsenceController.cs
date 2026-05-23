using ABRPOINT.Server.Authorization;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Helpers;
using ABRPOINT.Server.Models;
using ABRPOINT.Server.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace ABRPOINT.Server.Controllers;

/// <summary>
/// Workflow de demandes d'absence avec justificatif (certificat médical,
/// convocation, attestation…). Endpoints :
///   • POST   /api/DemandeAbsence                — multipart : champs + fichier
///   • POST   /api/DemandeAbsence/{id}/cancel    — annulation par le demandeur
///   • GET    /api/DemandeAbsence/me             — mes demandes
///   • GET    /api/DemandeAbsence/pending        — demandes à valider (admin/manager)
///   • GET    /api/DemandeAbsence?status=…       — liste filtrée (admin/manager)
///   • POST   /api/DemandeAbsence/{id}/approve   — approuve (admin/manager)
///   • POST   /api/DemandeAbsence/{id}/reject    — refuse, motif obligatoire
///
/// Plan gating : <c>LeaveManagement</c> (ouvert à tous les packs, comme
/// Teletravail). Gardé pour homogénéité ; restriction possible plus tard sans
/// toucher au contrôleur si la politique commerciale change.
///
/// La création passe par un multipart/form-data car on accepte un fichier
/// justificatif. C'est le point qui diffère de TeletravailController (qui prend
/// du JSON pur).
/// </summary>
[Route("api/[controller]")]
[ApiController]
[Authorize]
[RequirePlanFeature(nameof(PlanFeatures.LeaveManagement))]
public class DemandeAbsenceController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly ICurrentTenant _currentTenant;
    private readonly ILogger<DemandeAbsenceController> _log;

    public DemandeAbsenceController(
        ApplicationDbContext db,
        ICurrentTenant currentTenant,
        ILogger<DemandeAbsenceController> log)
    {
        _db = db;
        _currentTenant = currentTenant;
        _log = log;
    }

    // ───────────────────────────────────────────────────────────────────────
    // DTOs
    // ───────────────────────────────────────────────────────────────────────
    public sealed class DecisionRequest
    {
        public string? Comment { get; set; }
    }

    public sealed class DemandeAbsenceDto
    {
        public int Id { get; set; }
        public string? Empcod { get; set; }
        public string? EmployeeName { get; set; }
        public DateTime RequestedAt { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public float? DaysCount { get; set; }
        public string? Abscod { get; set; }
        public string? AbsenceLabel { get; set; }
        public string? Reason { get; set; }
        public string? JustificationUrl { get; set; }
        public string? JustificationFilename { get; set; }
        public string? JustificationMime { get; set; }
        public long? JustificationSize { get; set; }
        public string Status { get; set; } = "Pending";
        public string? DecidedBy { get; set; }
        public string? DecidedByName { get; set; }
        public DateTime? DecidedAt { get; set; }
        public string? DecisionComment { get; set; }
    }

    // ───────────────────────────────────────────────────────────────────────
    // POST /api/DemandeAbsence — création (multipart/form-data)
    // Champs attendus : StartDate, EndDate, Abscod (opt), Reason (opt), file (opt).
    // ───────────────────────────────────────────────────────────────────────
    [HttpPost]
    [RequestSizeLimit(15_000_000)] // 15 Mo : un certificat médical scanné = ~5 Mo max
    [RequestFormLimits(MultipartBodyLengthLimit = 15_000_000)]
    public async Task<IActionResult> Create(CancellationToken ct)
    {
        var caller = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(caller)) return Unauthorized();

        // Convention Uticod == Empcod (cf. note dans TeletravailController.Create).
        var employe = await _db.Employes.AsNoTracking()
            .Where(e => e.Empcod == caller)
            .Select(e => new { e.Empcod, e.Soccod })
            .FirstOrDefaultAsync(ct);
        if (employe == null)
            return BadRequest(new { error = "Compte non rattaché à un collaborateur." });

        var form = await Request.ReadFormAsync(ct);
        if (!DateTime.TryParse(form["StartDate"].ToString(), out var startDate))
            return BadRequest(new { error = "StartDate invalide." });
        if (!DateTime.TryParse(form["EndDate"].ToString(), out var endDate))
            return BadRequest(new { error = "EndDate invalide." });
        if (endDate.Date < startDate.Date)
            return BadRequest(new { error = "La date de fin doit être ≥ à la date de début." });

        var abscod = form["Abscod"].ToString();
        var reason = form["Reason"].ToString();
        if (!string.IsNullOrEmpty(reason) && reason.Length > 1000)
            return BadRequest(new { error = "Motif trop long (1000 caractères max)." });

        var entity = new DemandeAbsence
        {
            Soccod = employe.Soccod,
            Empcod = employe.Empcod,
            StartDate = startDate.Date,
            EndDate = endDate.Date,
            Abscod = string.IsNullOrWhiteSpace(abscod) ? null : abscod.Trim(),
            Reason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim(),
            DaysCount = CountBusinessDays(startDate.Date, endDate.Date),
            Status = "Pending",
            RequestedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
        };

        // Sauvegarde du justificatif (facultatif côté API ; côté UI on le
        // recommande fortement pour qu'une demande médicale ait du sens).
        var file = form.Files.FirstOrDefault();
        if (file != null && file.Length > 0)
        {
            var slug = _currentTenant.Current?.Slug;
            var (success, filePath, error) = await FileHelper.SaveFile(file, slug);
            if (!success)
                return BadRequest(new { error = error ?? "Échec de l'upload du justificatif." });
            entity.JustificationUrl = filePath;
            entity.JustificationFilename = file.FileName;
            entity.JustificationMime = file.ContentType;
            entity.JustificationSize = file.Length;
        }

        _db.DemandesAbsence.Add(entity);
        await _db.SaveChangesAsync(ct);
        return Ok(await ProjectAsync(entity.Id, ct));
    }

    // ───────────────────────────────────────────────────────────────────────
    // POST /api/DemandeAbsence/{id}/cancel
    // ───────────────────────────────────────────────────────────────────────
    [HttpPost("{id:int}/cancel")]
    public async Task<IActionResult> Cancel(int id, CancellationToken ct)
    {
        var caller = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(caller)) return Unauthorized();

        var entity = await _db.DemandesAbsence.FirstOrDefaultAsync(d => d.Id == id, ct);
        if (entity == null) return NotFound();
        if (!string.Equals(entity.Empcod, caller, StringComparison.OrdinalIgnoreCase))
            return Forbid();
        if (!string.Equals(entity.Status, "Pending", StringComparison.OrdinalIgnoreCase))
            return Conflict(new { error = "Seules les demandes en attente peuvent être annulées." });

        entity.Status = "Cancelled";
        entity.DecidedAt = DateTime.UtcNow;
        entity.DecidedBy = caller;
        await _db.SaveChangesAsync(ct);
        return Ok(await ProjectAsync(entity.Id, ct));
    }

    // ───────────────────────────────────────────────────────────────────────
    // GET /api/DemandeAbsence/me
    // ───────────────────────────────────────────────────────────────────────
    [HttpGet("me")]
    public async Task<IActionResult> ListMine(CancellationToken ct)
    {
        var caller = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(caller)) return Unauthorized();
        var items = await ProjectListAsync(q => q.Where(d => d.Empcod == caller), ct);
        return Ok(items);
    }

    [HttpGet("pending")]
    public async Task<IActionResult> ListPending(CancellationToken ct)
    {
        if (!await CallerCanDecideAsync(ct)) return Forbid();
        var items = await ProjectListAsync(q => q.Where(d => d.Status == "Pending"), ct);
        return Ok(items);
    }

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? status, [FromQuery] string? empcod, CancellationToken ct)
    {
        if (!await CallerCanDecideAsync(ct)) return Forbid();
        var items = await ProjectListAsync(q =>
        {
            if (!string.IsNullOrWhiteSpace(status)) q = q.Where(d => d.Status == status);
            if (!string.IsNullOrWhiteSpace(empcod)) q = q.Where(d => d.Empcod == empcod);
            return q;
        }, ct);
        return Ok(items);
    }

    // ───────────────────────────────────────────────────────────────────────
    // Approve / Reject
    // ───────────────────────────────────────────────────────────────────────
    [HttpPost("{id:int}/approve")]
    public async Task<IActionResult> Approve(int id, [FromBody] DecisionRequest req, CancellationToken ct)
        => await DecideAsync(id, accept: true, req?.Comment, ct);

    [HttpPost("{id:int}/reject")]
    public async Task<IActionResult> Reject(int id, [FromBody] DecisionRequest req, CancellationToken ct)
    {
        if (req == null || string.IsNullOrWhiteSpace(req.Comment))
            return BadRequest(new { error = "Motif de refus obligatoire." });
        return await DecideAsync(id, accept: false, req.Comment, ct);
    }

    private async Task<IActionResult> DecideAsync(int id, bool accept, string? comment, CancellationToken ct)
    {
        var caller = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(caller)) return Unauthorized();
        if (!await CallerCanDecideAsync(ct)) return Forbid();

        var entity = await _db.DemandesAbsence.FirstOrDefaultAsync(d => d.Id == id, ct);
        if (entity == null) return NotFound();
        if (!string.Equals(entity.Status, "Pending", StringComparison.OrdinalIgnoreCase))
            return Conflict(new { error = "Demande déjà traitée." });

        entity.Status = accept ? "Approved" : "Rejected";
        entity.DecidedBy = caller;
        entity.DecidedAt = DateTime.UtcNow;
        entity.DecisionComment = string.IsNullOrWhiteSpace(comment) ? null : comment.Trim();
        await _db.SaveChangesAsync(ct);
        return Ok(await ProjectAsync(entity.Id, ct));
    }

    // ───────────────────────────────────────────────────────────────────────
    // Helpers — repris à l'identique de TeletravailController pour cohérence.
    // ───────────────────────────────────────────────────────────────────────
    private async Task<bool> CallerCanDecideAsync(CancellationToken ct)
    {
        var caller = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(caller)) return false;
        return await _db.Utilisateurs.AsNoTracking()
            .Where(u => u.Uticod == caller)
            .Select(u => u.Utiadm == "1"
                      || PermissionCatalog.IsAdminRole(u.Utirole)
                      || u.Utirole == PermissionCatalog.Roles.Manager)
            .FirstOrDefaultAsync(ct);
    }

    private Task<DemandeAbsenceDto?> ProjectAsync(int id, CancellationToken ct)
        => BaseProjection().Where(d => d.Id == id).FirstOrDefaultAsync(ct);

    private async Task<List<DemandeAbsenceDto>> ProjectListAsync(
        Func<IQueryable<DemandeAbsence>, IQueryable<DemandeAbsence>> filter,
        CancellationToken ct)
    {
        var filtered = filter(_db.DemandesAbsence.AsNoTracking()).Select(d => d.Id);
        return await BaseProjection()
            .Where(p => filtered.Contains(p.Id))
            .OrderByDescending(p => p.RequestedAt)
            .ToListAsync(ct);
    }

    /// <summary>
    /// Projection enrichie : nom collaborateur (Employes.Emplib), libellé du type
    /// d'absence (Absence.Abslib) si renseigné, nom du décideur (Utilisateurs).
    /// </summary>
    private IQueryable<DemandeAbsenceDto> BaseProjection()
    {
        return from d in _db.DemandesAbsence.AsNoTracking()
               join e in _db.Employes.AsNoTracking() on d.Empcod equals e.Empcod into ej
               from e in ej.DefaultIfEmpty()
               join a in _db.Absences.AsNoTracking() on d.Abscod equals a.Abscod into aj
               from a in aj.DefaultIfEmpty()
               join u in _db.Utilisateurs.AsNoTracking() on d.DecidedBy equals u.Uticod into uj
               from u in uj.DefaultIfEmpty()
               select new DemandeAbsenceDto
               {
                   Id = d.Id,
                   Empcod = d.Empcod,
                   EmployeeName = e != null ? e.Emplib : null,
                   RequestedAt = d.RequestedAt,
                   StartDate = d.StartDate,
                   EndDate = d.EndDate,
                   DaysCount = d.DaysCount,
                   Abscod = d.Abscod,
                   AbsenceLabel = a != null ? a.Abslib : null,
                   Reason = d.Reason,
                   JustificationUrl = d.JustificationUrl,
                   JustificationFilename = d.JustificationFilename,
                   JustificationMime = d.JustificationMime,
                   JustificationSize = d.JustificationSize,
                   Status = d.Status,
                   DecidedBy = d.DecidedBy,
                   DecidedByName = u != null ? ((u.Utiprn ?? "") + " " + (u.Utinom ?? "")).Trim() : null,
                   DecidedAt = d.DecidedAt,
                   DecisionComment = d.DecisionComment,
               };
    }

    private static float CountBusinessDays(DateTime start, DateTime end)
    {
        var d = start.Date;
        var last = end.Date;
        int count = 0;
        while (d <= last)
        {
            if (d.DayOfWeek != DayOfWeek.Saturday && d.DayOfWeek != DayOfWeek.Sunday) count++;
            d = d.AddDays(1);
        }
        return count;
    }
}
