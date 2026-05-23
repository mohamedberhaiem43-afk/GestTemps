using ABRPOINT.Server.Authorization;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace ABRPOINT.Server.Controllers;

/// <summary>
/// Notice d'information RGPD destinée aux Salariés-Utilisateurs (Art. 13 RGPD).
///
/// Endpoints :
///   • <c>GET  /api/admin/processing-notice</c> — admin : récupère le contenu courant (édition).
///   • <c>PUT  /api/admin/processing-notice</c> — admin : édite le contenu. Incrémente <c>Version</c>.
///   • <c>GET  /api/processing-notice/current</c> — tout utilisateur authentifié :
///     renvoie la notice + statut d'acquittement (a-t-il vu la version courante ?).
/// </summary>
[ApiController]
[Authorize]
public class ProcessingNoticeController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public ProcessingNoticeController(ApplicationDbContext db)
    {
        _db = db;
    }

    public sealed class NoticeDto
    {
        public string Title { get; set; } = "";
        public string Body { get; set; } = "";
        public int Version { get; set; }
        public DateTime UpdatedAt { get; set; }
        public string? UpdatedBy { get; set; }
    }

    public sealed class UpdateNoticeRequest
    {
        public string? Title { get; set; }
        public string? Body { get; set; }
    }

    public sealed class CurrentNoticeResponse
    {
        public required NoticeDto Notice { get; init; }
        public required bool RequiresAcknowledgment { get; init; }
        public DateTime? LastAcknowledgedAt { get; init; }
    }

    [HttpGet("api/admin/processing-notice")]
    public async Task<IActionResult> GetForAdmin(CancellationToken ct)
    {
        if (!await CallerIsAdminAsync(ct)) return Forbid();
        var notice = await GetOrSeedAsync(ct);
        return Ok(ToDto(notice));
    }

    [HttpPut("api/admin/processing-notice")]
    public async Task<IActionResult> Update([FromBody] UpdateNoticeRequest req, CancellationToken ct)
    {
        if (!await CallerIsAdminAsync(ct)) return Forbid();
        if (req is null) return BadRequest(new { error = "Body manquant." });

        var title = (req.Title ?? "").Trim();
        var body = (req.Body ?? "").Trim();
        if (title.Length == 0 || title.Length > 200)
            return BadRequest(new { error = "Le titre doit faire entre 1 et 200 caractères." });
        if (body.Length == 0)
            return BadRequest(new { error = "Le corps de la notice ne peut pas être vide." });
        if (body.Length > 20_000)
            return BadRequest(new { error = "Le corps de la notice ne peut pas dépasser 20 000 caractères." });

        var notice = await GetOrSeedAsync(ct);
        // Le contenu a-t-il réellement changé ? Si oui on bumpe la version → tous
        // les salariés re-verront la bannière. Sinon on ne touche à rien pour éviter
        // de spammer un re-acknowledgment sur un simple "Sauvegarder sans rien changer".
        var changed = !string.Equals(notice.Title, title, StringComparison.Ordinal)
                   || !string.Equals(notice.Body, body, StringComparison.Ordinal);

        notice.Title = title;
        notice.Body = body;
        if (changed)
        {
            notice.Version += 1;
            notice.UpdatedAt = DateTime.UtcNow;
            notice.UpdatedBy = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        }
        await _db.SaveChangesAsync(ct);
        return Ok(ToDto(notice));
    }

    [HttpGet("api/processing-notice/current")]
    public async Task<IActionResult> GetCurrent(CancellationToken ct)
    {
        var caller = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(caller)) return Unauthorized();

        var notice = await GetOrSeedAsync(ct);
        var lastAck = await _db.UserConsents.AsNoTracking()
            .Where(c => c.Uticod == caller && c.NoticeVersion == notice.Version)
            .OrderByDescending(c => c.AcknowledgedAt)
            .Select(c => (DateTime?)c.AcknowledgedAt)
            .FirstOrDefaultAsync(ct);

        return Ok(new CurrentNoticeResponse
        {
            Notice = ToDto(notice),
            RequiresAcknowledgment = !lastAck.HasValue,
            LastAcknowledgedAt = lastAck,
        });
    }

    private async Task<DataProcessingNotice> GetOrSeedAsync(CancellationToken ct)
    {
        var existing = await _db.DataProcessingNotices.FirstOrDefaultAsync(ct);
        if (existing != null) return existing;
        var seed = new DataProcessingNotice { Id = 1 };
        _db.DataProcessingNotices.Add(seed);
        await _db.SaveChangesAsync(ct);
        return seed;
    }

    private async Task<bool> CallerIsAdminAsync(CancellationToken ct)
    {
        var caller = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(caller)) return false;
        return await _db.Utilisateurs.AsNoTracking()
            .Where(u => u.Uticod == caller)
            .Select(u => u.Utiadm == "1" || PermissionCatalog.IsAdminRole(u.Utirole))
            .FirstOrDefaultAsync(ct);
    }

    private static NoticeDto ToDto(DataProcessingNotice n) => new()
    {
        Title = n.Title,
        Body = n.Body,
        Version = n.Version,
        UpdatedAt = n.UpdatedAt,
        UpdatedBy = n.UpdatedBy,
    };
}
