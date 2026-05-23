using ABRPOINT.Server.Authorization;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.RegularExpressions;

namespace ABRPOINT.Server.Controllers;

/// <summary>
/// Politique de géolocalisation paramétrable par tenant (clause 13.3 points 2 et 4).
/// Réservé aux admins du tenant.
/// </summary>
[ApiController]
[Route("api/admin/geolocation-policy")]
[Authorize]
public class GeolocationPolicyController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private static readonly Regex TimeRegex = new(@"^([01]\d|2[0-3]):[0-5]\d$", RegexOptions.Compiled);
    private static readonly Regex DaysRegex = new(@"^[1-7]+$", RegexOptions.Compiled);

    public GeolocationPolicyController(ApplicationDbContext db)
    {
        _db = db;
    }

    public sealed class PolicyDto
    {
        public bool EnabledForClockIn { get; set; }
        public bool EnabledForMissions { get; set; }
        public string WindowStartTime { get; set; } = "";
        public string WindowEndTime { get; set; } = "";
        public string AllowedDays { get; set; } = "";
        public DateTime UpdatedAt { get; set; }
        public string? UpdatedBy { get; set; }
    }

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        if (!await CallerIsAdminAsync(ct)) return Forbid();
        var policy = await GetOrSeedAsync(ct);
        return Ok(ToDto(policy));
    }

    [HttpPut]
    public async Task<IActionResult> Update([FromBody] PolicyDto input, CancellationToken ct)
    {
        if (!await CallerIsAdminAsync(ct)) return Forbid();
        if (input is null) return BadRequest(new { error = "Body manquant." });

        if (!TimeRegex.IsMatch(input.WindowStartTime ?? ""))
            return BadRequest(new { error = "Heure de début invalide (format HH:MM attendu)." });
        if (!TimeRegex.IsMatch(input.WindowEndTime ?? ""))
            return BadRequest(new { error = "Heure de fin invalide (format HH:MM attendu)." });
        var days = (input.AllowedDays ?? "").Trim();
        if (string.IsNullOrEmpty(days) || !DaysRegex.IsMatch(days))
            return BadRequest(new { error = "Jours autorisés invalides (caractères '1' à '7' attendus)." });
        // On retire les doublons et trie pour normaliser ("21" → "12").
        days = new string(days.Distinct().OrderBy(c => c).ToArray());

        var policy = await GetOrSeedAsync(ct);
        policy.EnabledForClockIn = input.EnabledForClockIn;
        policy.EnabledForMissions = input.EnabledForMissions;
        policy.WindowStartTime = input.WindowStartTime;
        policy.WindowEndTime = input.WindowEndTime;
        policy.AllowedDays = days;
        policy.UpdatedAt = DateTime.UtcNow;
        policy.UpdatedBy = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        await _db.SaveChangesAsync(ct);
        return Ok(ToDto(policy));
    }

    private async Task<GeolocationPolicy> GetOrSeedAsync(CancellationToken ct)
    {
        var existing = await _db.GeolocationPolicies.FirstOrDefaultAsync(ct);
        if (existing != null) return existing;
        var seed = new GeolocationPolicy { Id = 1 };
        _db.GeolocationPolicies.Add(seed);
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

    private static PolicyDto ToDto(GeolocationPolicy p) => new()
    {
        EnabledForClockIn = p.EnabledForClockIn,
        EnabledForMissions = p.EnabledForMissions,
        WindowStartTime = p.WindowStartTime,
        WindowEndTime = p.WindowEndTime,
        AllowedDays = p.AllowedDays,
        UpdatedAt = p.UpdatedAt,
        UpdatedBy = p.UpdatedBy,
    };
}
