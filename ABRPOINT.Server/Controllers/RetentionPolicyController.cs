using ABRPOINT.Server.Authorization;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace ABRPOINT.Server.Controllers;

/// <summary>
/// Lecture/écriture de la politique de rétention RGPD du tenant (clause 13.3 du
/// contrat éditeur). Réservé aux admins du tenant — il s'agit d'un paramétrage
/// engageant la responsabilité du client (Responsable de traitement).
///
/// Les bornes min/max sont validées ici : on ne fait pas confiance au client UI
/// pour interdire des durées hors plage légale (perte de preuve forensique côté
/// bas, principe de minimisation côté haut).
/// </summary>
[ApiController]
[Route("api/admin/retention-policy")]
[Authorize]
public class RetentionPolicyController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public RetentionPolicyController(ApplicationDbContext db)
    {
        _db = db;
    }

    // Bornes alignées sur RetentionPolicyBounds (constantes utilisées aussi par les
    // hosted services pour clamp défensif côté lecture — defense in depth).
    public static class Bounds
    {
        public const int AuditLogMin = 30;
        public const int AuditLogMax = 730;     // 2 ans
        public const int PresenceAnonymizeMin = 90;
        public const int PresenceAnonymizeMax = 1825;  // 5 ans
        public const int PresenceDeleteMin = 180;
        public const int PresenceDeleteMax = 1825;     // 5 ans (limite légale FR L3171-3)
        public const int RefreshTokenMin = 7;
        public const int RefreshTokenMax = 90;
        public const int KnownDeviceMin = 30;
        public const int KnownDeviceMax = 730;
        public const int PushTokenMin = 30;
        public const int PushTokenMax = 365;
        public const int RagChatLogMin = 7;
        public const int RagChatLogMax = 365;
    }

    public sealed class RetentionPolicyDto
    {
        public int AuditLogDays { get; set; }
        public int PresenceAnonymizeDays { get; set; }
        public int PresenceDeleteDays { get; set; }
        public int RefreshTokenDaysAfterExpiry { get; set; }
        public int KnownDeviceInactiveDays { get; set; }
        public int PushTokenInactiveDays { get; set; }
        public int RagChatLogDays { get; set; }
        public DateTime UpdatedAt { get; set; }
        public string? UpdatedBy { get; set; }
    }

    public sealed class BoundsDto
    {
        public required int Min { get; init; }
        public required int Max { get; init; }
    }

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        if (!await CallerIsAdminAsync(ct)) return Forbid();
        var policy = await GetOrSeedAsync(ct);
        return Ok(new
        {
            policy = ToDto(policy),
            bounds = new
            {
                auditLog = new BoundsDto { Min = Bounds.AuditLogMin, Max = Bounds.AuditLogMax },
                presenceAnonymize = new BoundsDto { Min = Bounds.PresenceAnonymizeMin, Max = Bounds.PresenceAnonymizeMax },
                presenceDelete = new BoundsDto { Min = Bounds.PresenceDeleteMin, Max = Bounds.PresenceDeleteMax },
                refreshToken = new BoundsDto { Min = Bounds.RefreshTokenMin, Max = Bounds.RefreshTokenMax },
                knownDevice = new BoundsDto { Min = Bounds.KnownDeviceMin, Max = Bounds.KnownDeviceMax },
                pushToken = new BoundsDto { Min = Bounds.PushTokenMin, Max = Bounds.PushTokenMax },
                ragChatLog = new BoundsDto { Min = Bounds.RagChatLogMin, Max = Bounds.RagChatLogMax },
            },
        });
    }

    [HttpPut]
    public async Task<IActionResult> Update([FromBody] RetentionPolicyDto input, CancellationToken ct)
    {
        if (!await CallerIsAdminAsync(ct)) return Forbid();
        if (input is null) return BadRequest(new { error = "Body manquant." });

        var error = Validate(input);
        if (error != null) return BadRequest(new { error });

        // Règle cohérence cross-champ : la suppression doit venir APRÈS l'anonymisation.
        if (input.PresenceDeleteDays < input.PresenceAnonymizeDays)
            return BadRequest(new { error = "La suppression des pointages doit intervenir après l'anonymisation." });

        var policy = await GetOrSeedAsync(ct);
        policy.AuditLogDays = input.AuditLogDays;
        policy.PresenceAnonymizeDays = input.PresenceAnonymizeDays;
        policy.PresenceDeleteDays = input.PresenceDeleteDays;
        policy.RefreshTokenDaysAfterExpiry = input.RefreshTokenDaysAfterExpiry;
        policy.KnownDeviceInactiveDays = input.KnownDeviceInactiveDays;
        policy.PushTokenInactiveDays = input.PushTokenInactiveDays;
        policy.RagChatLogDays = input.RagChatLogDays;
        policy.UpdatedAt = DateTime.UtcNow;
        policy.UpdatedBy = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        await _db.SaveChangesAsync(ct);
        return Ok(ToDto(policy));
    }

    private async Task<RetentionPolicy> GetOrSeedAsync(CancellationToken ct)
    {
        var existing = await _db.RetentionPolicies.FirstOrDefaultAsync(ct);
        if (existing != null) return existing;
        var seed = new RetentionPolicy { Id = 1 };
        _db.RetentionPolicies.Add(seed);
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

    private static RetentionPolicyDto ToDto(RetentionPolicy p) => new()
    {
        AuditLogDays = p.AuditLogDays,
        PresenceAnonymizeDays = p.PresenceAnonymizeDays,
        PresenceDeleteDays = p.PresenceDeleteDays,
        RefreshTokenDaysAfterExpiry = p.RefreshTokenDaysAfterExpiry,
        KnownDeviceInactiveDays = p.KnownDeviceInactiveDays,
        PushTokenInactiveDays = p.PushTokenInactiveDays,
        RagChatLogDays = p.RagChatLogDays,
        UpdatedAt = p.UpdatedAt,
        UpdatedBy = p.UpdatedBy,
    };

    private static string? Validate(RetentionPolicyDto d)
    {
        if (d.AuditLogDays < Bounds.AuditLogMin || d.AuditLogDays > Bounds.AuditLogMax)
            return $"AuditLog : {Bounds.AuditLogMin}-{Bounds.AuditLogMax} jours.";
        if (d.PresenceAnonymizeDays < Bounds.PresenceAnonymizeMin || d.PresenceAnonymizeDays > Bounds.PresenceAnonymizeMax)
            return $"Anonymisation pointages : {Bounds.PresenceAnonymizeMin}-{Bounds.PresenceAnonymizeMax} jours.";
        if (d.PresenceDeleteDays < Bounds.PresenceDeleteMin || d.PresenceDeleteDays > Bounds.PresenceDeleteMax)
            return $"Suppression pointages : {Bounds.PresenceDeleteMin}-{Bounds.PresenceDeleteMax} jours.";
        if (d.RefreshTokenDaysAfterExpiry < Bounds.RefreshTokenMin || d.RefreshTokenDaysAfterExpiry > Bounds.RefreshTokenMax)
            return $"Refresh tokens : {Bounds.RefreshTokenMin}-{Bounds.RefreshTokenMax} jours.";
        if (d.KnownDeviceInactiveDays < Bounds.KnownDeviceMin || d.KnownDeviceInactiveDays > Bounds.KnownDeviceMax)
            return $"Devices connus : {Bounds.KnownDeviceMin}-{Bounds.KnownDeviceMax} jours.";
        if (d.PushTokenInactiveDays < Bounds.PushTokenMin || d.PushTokenInactiveDays > Bounds.PushTokenMax)
            return $"Push tokens : {Bounds.PushTokenMin}-{Bounds.PushTokenMax} jours.";
        if (d.RagChatLogDays < Bounds.RagChatLogMin || d.RagChatLogDays > Bounds.RagChatLogMax)
            return $"Chats IA : {Bounds.RagChatLogMin}-{Bounds.RagChatLogMax} jours.";
        return null;
    }
}
