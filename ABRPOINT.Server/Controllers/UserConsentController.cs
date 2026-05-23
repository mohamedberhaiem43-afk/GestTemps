using ABRPOINT.Server.Data;
using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace ABRPOINT.Server.Controllers;

/// <summary>
/// Enregistre l'acquittement (« J'ai compris ») par un Salarié-Utilisateur de la
/// notice d'information RGPD courante. Sert de preuve pour l'employeur que l'art. 13
/// RGPD est rempli.
/// </summary>
[ApiController]
[Route("api/me/consent")]
[Authorize]
public class UserConsentController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public UserConsentController(ApplicationDbContext db)
    {
        _db = db;
    }

    [HttpPost("acknowledge")]
    public async Task<IActionResult> Acknowledge(CancellationToken ct)
    {
        var caller = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(caller)) return Unauthorized();

        var notice = await _db.DataProcessingNotices.AsNoTracking().FirstOrDefaultAsync(ct);
        if (notice is null)
            return UnprocessableEntity(new { error = "Aucune notice d'information définie pour ce tenant." });

        // Idempotent : si l'utilisateur a déjà acquitté cette version, on ne crée
        // pas de doublon (économie d'audit et de bruit). On garde le 1er ack comme
        // référence horodatée.
        var existing = await _db.UserConsents
            .Where(c => c.Uticod == caller && c.NoticeVersion == notice.Version)
            .OrderBy(c => c.AcknowledgedAt)
            .FirstOrDefaultAsync(ct);
        if (existing != null)
            return Ok(new { acknowledged = true, version = notice.Version, alreadyAcknowledgedAt = existing.AcknowledgedAt });

        var xff = HttpContext.Request.Headers["X-Forwarded-For"].ToString();
        var ip = !string.IsNullOrWhiteSpace(xff)
            ? xff.Split(',')[0].Trim()
            : HttpContext.Connection.RemoteIpAddress?.ToString();
        if (ip != null && ip.Length > 45) ip = ip.Substring(0, 45);

        var entry = new UserConsent
        {
            Uticod = caller.Length > 20 ? caller.Substring(0, 20) : caller,
            NoticeVersion = notice.Version,
            AcknowledgedAt = DateTime.UtcNow,
            IpAddress = ip,
        };
        _db.UserConsents.Add(entry);
        await _db.SaveChangesAsync(ct);
        return Ok(new { acknowledged = true, version = notice.Version, acknowledgedAt = entry.AcknowledgedAt });
    }
}
