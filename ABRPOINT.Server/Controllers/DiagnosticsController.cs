using ABRPOINT.Server.Authorization;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace ABRPOINT.Server.Controllers;

/// <summary>
/// Endpoints d'auto-diagnostic, réservés aux admins du tenant. Le besoin pratique :
/// quand l'oubli de mot de passe ne reçoit pas d'email, l'admin ne peut pas savoir
/// pourquoi via le flow public (anti-énumération renvoie toujours 200). Avec ces
/// endpoints, il peut :
///   1. GET /api/admin/diagnostics/email-config — voir l'état de la config SMTP
///      (host / port / from / auth présente — pas de mot de passe).
///   2. POST /api/admin/diagnostics/test-email { to } — envoyer un email de test
///      vers une adresse choisie et obtenir le message d'erreur exact si l'envoi
///      échoue (timeout SMTP, auth refusée par OVH, From qui ne matche pas
///      l'utilisateur authentifié, etc.).
/// </summary>
[ApiController]
[Route("api/admin/diagnostics")]
[Authorize]
public class DiagnosticsController : ControllerBase
{
    private readonly IEmailService _emailService;
    private readonly ApplicationDbContext _db;
    private readonly ILogger<DiagnosticsController> _log;

    public DiagnosticsController(IEmailService emailService, ApplicationDbContext db, ILogger<DiagnosticsController> log)
    {
        _emailService = emailService;
        _db = db;
        _log = log;
    }

    /// <summary>
    /// L'utilisateur doit être admin du tenant pour appeler ces endpoints — sinon
    /// n'importe quel salarié pourrait lire la config SMTP et déclencher des envois.
    /// </summary>
    private async Task<bool> CallerIsAdminAsync()
    {
        var caller = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(caller)) return false;
        return await _db.Utilisateurs.AsNoTracking()
            .Where(u => u.Uticod == caller)
            .Select(u => u.Utiadm == "1" || PermissionCatalog.IsAdminRole(u.Utirole))
            .FirstOrDefaultAsync();
    }

    [HttpGet("email-config")]
    public async Task<IActionResult> GetEmailConfig()
    {
        if (!await CallerIsAdminAsync()) return Forbid();
        var status = _emailService.GetConfigStatus();
        return Ok(new
        {
            isConfigured = status.IsConfigured,
            reason = status.Reason,
            host = status.Host,
            port = status.Port,
            fromEmail = status.FromEmail,
            hasAuth = status.HasAuth,
        });
    }

    public sealed record TestEmailRequest(string To, string? Subject, string? Body);

    [HttpPost("test-email")]
    public async Task<IActionResult> SendTestEmail([FromBody] TestEmailRequest req)
    {
        if (!await CallerIsAdminAsync()) return Forbid();
        if (req is null || string.IsNullOrWhiteSpace(req.To) || !req.To.Contains('@'))
            return BadRequest(new { success = false, message = "Adresse email invalide." });

        var subject = string.IsNullOrWhiteSpace(req.Subject) ? "Concorde Workforce — Test SMTP" : req.Subject.Trim();
        var body = string.IsNullOrWhiteSpace(req.Body)
            ? "<p>Ceci est un email de test envoyé depuis le panneau d'administration de Concorde Workforce.</p>" +
              "<p>Si vous voyez ce message, la configuration SMTP fonctionne correctement.</p>"
            : req.Body;

        try
        {
            await _emailService.SendEmailAsync(req.To.Trim(), subject, body);
            _log.LogInformation("Test SMTP envoyé avec succès à {To}", req.To);
            return Ok(new { success = true, message = $"Email de test envoyé à {req.To}." });
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Échec du test SMTP vers {To}", req.To);
            // Contrairement au flow public, ICI on RENVOIE le message d'erreur. C'est
            // l'admin qui appelle (vérifié + authentifié), il a légitimement besoin
            // de diagnostiquer. On expose le message exception mais pas la stack pour
            // ne pas leaker l'arborescence interne.
            return StatusCode(500, new
            {
                success = false,
                message = $"Échec d'envoi : {ex.Message}",
                exceptionType = ex.GetType().Name,
            });
        }
    }
}
