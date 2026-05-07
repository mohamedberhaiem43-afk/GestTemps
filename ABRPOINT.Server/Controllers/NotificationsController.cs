using ABRPOINT.Server.Authorization;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using ABRPOINT.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace ABRPOINT.Server.Controllers;

/// <summary>
/// Centre de notifications de l'utilisateur courant. Toutes les routes opèrent sur
/// le `Uticod` extrait du JWT — pas de leak entre utilisateurs.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class NotificationsController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    public NotificationsController(ApplicationDbContext db) { _db = db; }

    private string? CurrentUticod => User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

    /// <summary>Liste les notifications de l'utilisateur courant (les plus récentes en premier).</summary>
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] int take = 50, [FromQuery] bool unreadOnly = false, CancellationToken ct = default)
    {
        var uticod = CurrentUticod;
        if (string.IsNullOrEmpty(uticod)) return Unauthorized();

        var q = _db.Notifications.AsNoTracking().Where(n => n.Uticod == uticod);
        if (unreadOnly) q = q.Where(n => n.ReadAt == null);

        take = Math.Clamp(take, 1, 200);
        var items = await q
            .OrderByDescending(n => n.CreatedAt)
            .Take(take)
            .Select(n => new
            {
                id = n.Id,
                title = n.Title,
                body = n.Body,
                category = n.Category,
                dataJson = n.DataJson,
                createdAt = n.CreatedAt,
                readAt = n.ReadAt,
            })
            .ToListAsync(ct);

        return Ok(items);
    }

    /// <summary>Compteur non lus pour le badge de la cloche.</summary>
    [HttpGet("unread-count")]
    public async Task<IActionResult> UnreadCount(CancellationToken ct)
    {
        try
        {
            var uticod = CurrentUticod;
            if (string.IsNullOrEmpty(uticod)) return Unauthorized();
            var count = await _db.Notifications
                .CountAsync(n => n.Uticod == uticod && n.ReadAt == null, ct);
            return Ok(new { count });
        }
        catch (Exception)
        {
            throw;
        }
    }

    [HttpPost("{id}/read")]
    public async Task<IActionResult> MarkRead(int id, CancellationToken ct)
    {
        var uticod = CurrentUticod;
        if (string.IsNullOrEmpty(uticod)) return Unauthorized();
        var n = await _db.Notifications.FirstOrDefaultAsync(x => x.Id == id && x.Uticod == uticod, ct);
        if (n is null) return NotFound();
        if (n.ReadAt is null)
        {
            n.ReadAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
        }
        return Ok(new { id = n.Id, readAt = n.ReadAt });
    }

    [HttpPost("read-all")]
    public async Task<IActionResult> MarkAllRead(CancellationToken ct)
    {
        var uticod = CurrentUticod;
        if (string.IsNullOrEmpty(uticod)) return Unauthorized();
        var unread = await _db.Notifications.Where(n => n.Uticod == uticod && n.ReadAt == null).ToListAsync(ct);
        var now = DateTime.UtcNow;
        foreach (var n in unread) n.ReadAt = now;
        await _db.SaveChangesAsync(ct);
        return Ok(new { updated = unread.Count });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var uticod = CurrentUticod;
        if (string.IsNullOrEmpty(uticod)) return Unauthorized();
        var n = await _db.Notifications.FirstOrDefaultAsync(x => x.Id == id && x.Uticod == uticod, ct);
        if (n is null) return NotFound();
        _db.Notifications.Remove(n);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    /// <summary>
    /// Liste toutes les catégories connues + l'état des deux canaux (push / in-app)
    /// pour l'utilisateur courant. L'absence d'une row côté DB est interprétée comme
    /// "tout activé" (opt-in par défaut).
    /// Réponse : [{ code, label, description, group, push, inapp }]
    /// </summary>
    [HttpGet("preferences")]
    public async Task<IActionResult> GetPreferences(CancellationToken ct)
    {
        try
        {
            var uticod = CurrentUticod;
            if (string.IsNullOrEmpty(uticod)) return Unauthorized();

            var prefs = await _db.NotificationPreferences
                .AsNoTracking()
                .Where(p => p.Uticod == uticod)
                .Select(p => new { p.Category, p.Enabled, p.PushEnabled, p.InappEnabled })
                .ToListAsync(ct);
            var byCategory = prefs.ToDictionary(p => p.Category, StringComparer.OrdinalIgnoreCase);

            var items = NotificationCategoryCatalog.All.Select(c =>
            {
                var hasRow = byCategory.TryGetValue(c.Code, out var p);
                // Convention : pas de row = activé. Si master enabled=false, tout est désactivé.
                var pushOn = !hasRow || (p!.Enabled && p.PushEnabled);
                var inappOn = !hasRow || (p!.Enabled && p.InappEnabled);
                return new
                {
                    code = c.Code,
                    label = c.Label,
                    description = c.Description,
                    group = c.Group,
                    push = pushOn,
                    inapp = inappOn,
                };
            });
            return Ok(items);
        }
        catch (Exception)
        {
            throw;
        }
    }

    /// <summary>
    /// Bulk update des préférences. Body : [{ code, push, inapp }, ...].
    /// Catégories non listées dans le body restent à leur valeur courante.
    /// </summary>
    [HttpPut("preferences")]
    public async Task<IActionResult> UpdatePreferences([FromBody] List<PreferenceUpdate> updates, CancellationToken ct)
    {
        var uticod = CurrentUticod;
        if (string.IsNullOrEmpty(uticod)) return Unauthorized();
        if (updates is null || updates.Count == 0)
            return BadRequest(new { message = "Body vide." });

        var existing = await _db.NotificationPreferences
            .Where(p => p.Uticod == uticod)
            .ToListAsync(ct);
        var byCategory = existing.ToDictionary(p => p.Category, StringComparer.OrdinalIgnoreCase);

        foreach (var u in updates)
        {
            if (string.IsNullOrEmpty(u.Code) || !NotificationCategoryCatalog.IsKnown(u.Code)) continue;
            // Master switch dérivé : si push OU inapp est on, on garde le master à true.
            var master = u.Push || u.Inapp;
            if (byCategory.TryGetValue(u.Code, out var pref))
            {
                pref.Enabled = master;
                pref.PushEnabled = u.Push;
                pref.InappEnabled = u.Inapp;
                pref.UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                _db.NotificationPreferences.Add(new NotificationPreference
                {
                    Uticod = uticod,
                    Category = u.Code,
                    Enabled = master,
                    PushEnabled = u.Push,
                    InappEnabled = u.Inapp,
                    UpdatedAt = DateTime.UtcNow,
                });
            }
        }
        await _db.SaveChangesAsync(ct);
        return Ok(new { updated = updates.Count });
    }

    public class PreferenceUpdate
    {
        public string Code { get; set; } = string.Empty;
        public bool Push { get; set; } = true;
        public bool Inapp { get; set; } = true;
    }

    /// <summary>Récupère les heures silencieuses du user courant. 200 même si pas de row : on retourne les défauts.</summary>
    [HttpGet("quiet-hours")]
    public async Task<IActionResult> GetQuietHours(CancellationToken ct)
    {
        try
        {
            var uticod = CurrentUticod;
            if (string.IsNullOrEmpty(uticod)) return Unauthorized();
            var s = await _db.NotificationUserSettings.AsNoTracking().FirstOrDefaultAsync(x => x.Uticod == uticod, ct);
            return Ok(new
            {
                enabled = s?.QuietEnabled ?? false,
                mode = s?.QuietMode ?? "manual",
                start = s?.QuietStart ?? "22:00",
                end = s?.QuietEnd ?? "07:00",
            });
        }
        catch (Exception)
        {
            throw;
        }
    }

    [HttpPut("quiet-hours")]
    public async Task<IActionResult> UpdateQuietHours([FromBody] QuietHoursUpdate body, CancellationToken ct)
    {
        var uticod = CurrentUticod;
        if (string.IsNullOrEmpty(uticod)) return Unauthorized();
        if (body is null) return BadRequest(new { message = "Body manquant." });

        if (!IsValidHHmm(body.Start) || !IsValidHHmm(body.End))
            return BadRequest(new { message = "Format HH:mm requis (ex: 22:00)." });
        var mode = (body.Mode ?? "manual").ToLowerInvariant();
        if (mode != "manual" && mode != "auto_poste")
            return BadRequest(new { message = "Mode invalide (manual | auto_poste)." });

        var s = await _db.NotificationUserSettings.FirstOrDefaultAsync(x => x.Uticod == uticod, ct);
        if (s is null)
        {
            s = new NotificationUserSettings { Uticod = uticod };
            _db.NotificationUserSettings.Add(s);
        }
        s.QuietEnabled = body.Enabled;
        s.QuietMode = mode;
        s.QuietStart = body.Start;
        s.QuietEnd = body.End;
        s.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(new { enabled = s.QuietEnabled, mode = s.QuietMode, start = s.QuietStart, end = s.QuietEnd });
    }

    /// <summary>
    /// État courant du créneau silencieux pour l'utilisateur. Permet à l'UI d'afficher
    /// un bandeau "Vous êtes actuellement silencieux jusqu'à HH:mm" sans dupliquer la logique.
    /// </summary>
    [HttpGet("quiet-status")]
    public async Task<IActionResult> GetQuietStatus(CancellationToken ct)
    {
        var uticod = CurrentUticod;
        if (string.IsNullOrEmpty(uticod)) return Unauthorized();
        var resolver = new QuietHoursResolver(_db);
        var state = await resolver.EvaluateAsync(uticod, DateTime.Now, ct);
        return Ok(new
        {
            silent = state.IsSilent,
            until = state.Until,
            reason = state.Reason,
            mode = state.Mode,
        });
    }

    /// <summary>
    /// Self-service : envoie une notification push de test à l'utilisateur courant.
    /// Endpoint dédié (vs /Roles/test-push qui exige [Admin] et renvoie 403 pour
    /// les employés) — un employé doit pouvoir vérifier son propre pipeline push
    /// depuis l'écran "Préférences notifications".
    /// </summary>
    [HttpPost("test-push")]
    public async Task<IActionResult> TestPushSelf([FromServices] IUserNotificationService notify, CancellationToken ct)
    {
        var uticod = CurrentUticod;
        if (string.IsNullOrEmpty(uticod)) return Unauthorized();

        var sent = await notify.NotifyUserAsync(
            uticod,
            "🔔 Notification de test",
            "Si vous recevez ce message, les notifications push sont opérationnelles.",
            new { type = "test_push" }, ct);
        return Ok(new { sent });
    }

    private static bool IsValidHHmm(string? v)
    {
        if (string.IsNullOrEmpty(v)) return false;
        var parts = v.Split(':');
        return parts.Length == 2
            && int.TryParse(parts[0], out var h) && h >= 0 && h <= 23
            && int.TryParse(parts[1], out var m) && m >= 0 && m <= 59;
    }

    public class QuietHoursUpdate
    {
        public bool Enabled { get; set; }
        public string Mode { get; set; } = "manual";
        public string Start { get; set; } = "22:00";
        public string End { get; set; } = "07:00";
    }
}
