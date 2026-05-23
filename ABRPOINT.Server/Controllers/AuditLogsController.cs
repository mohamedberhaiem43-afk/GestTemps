using ABRPOINT.Server.Authorization;
using ABRPOINT.Server.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace ABRPOINT.Server.Controllers;

/// <summary>
/// Consultation des journaux d'audit (table AuditLog) pour les admins du tenant et
/// les managers. RGPD Art. 32 : traçabilité des actions sur les données. La purge
/// automatique est gérée par <see cref="Services.AuditLogRetentionHostedService"/>
/// (rétention paramétrable via <c>Security:AuditLogRetentionDays</c>).
///
/// Sécurité : l'endpoint exige soit <c>Utiadm == "1"</c> soit le rôle Manager
/// (PermissionCatalog.Roles.Manager). Tout autre utilisateur reçoit un 403 sans
/// fuite d'information sur l'existence ou non de logs.
/// </summary>
[ApiController]
[Route("api/admin/audit-logs")]
[Authorize]
public class AuditLogsController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public AuditLogsController(ApplicationDbContext db)
    {
        _db = db;
    }

    public sealed record AuditLogRow(
        int Id,
        DateTime DateAction,
        string? Uticod,
        string? UserDisplay,
        string? Action,
        string? TableName,
        string? IpAddress);

    public sealed record AuditLogPage(
        int Total,
        IReadOnlyList<AuditLogRow> Items);

    /// <summary>
    /// Liste paginée. Filtres optionnels : plage de dates, uticod, action, table,
    /// IP, recherche libre. La pagination est bornée côté serveur pour ne pas
    /// générer des réponses énormes (max 200 lignes / page).
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] string? uticod,
        [FromQuery] string? action,
        [FromQuery] string? table,
        [FromQuery] string? ip,
        [FromQuery] string? search,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 25,
        CancellationToken ct = default)
    {
        var caller = await ResolveCallerAsync(ct);
        if (caller is null) return Forbid();

        if (skip < 0) skip = 0;
        if (take <= 0 || take > 200) take = 25;

        var query = _db.AuditLogs.AsNoTracking().AsQueryable();

        if (from.HasValue) query = query.Where(a => a.DateAction >= from.Value);
        if (to.HasValue) query = query.Where(a => a.DateAction <= to.Value);
        if (!string.IsNullOrWhiteSpace(uticod))
        {
            var u = uticod.Trim();
            query = query.Where(a => a.Uticod == u);
        }
        if (!string.IsNullOrWhiteSpace(action))
        {
            var a = action.Trim();
            query = query.Where(x => x.Action != null && EF.Functions.ILike(x.Action, $"%{a}%"));
        }
        if (!string.IsNullOrWhiteSpace(table))
        {
            var t = table.Trim();
            query = query.Where(x => x.TableName != null && EF.Functions.ILike(x.TableName, $"%{t}%"));
        }
        if (!string.IsNullOrWhiteSpace(ip))
        {
            var i = ip.Trim();
            query = query.Where(x => x.IpAddress != null && EF.Functions.ILike(x.IpAddress, $"%{i}%"));
        }
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            query = query.Where(x =>
                (x.Uticod != null && EF.Functions.ILike(x.Uticod, $"%{s}%")) ||
                (x.Action != null && EF.Functions.ILike(x.Action, $"%{s}%")) ||
                (x.TableName != null && EF.Functions.ILike(x.TableName, $"%{s}%")) ||
                (x.IpAddress != null && EF.Functions.ILike(x.IpAddress, $"%{s}%")));
        }

        var total = await query.CountAsync(ct);

        var page = await query
            .OrderByDescending(a => a.DateAction)
            .ThenByDescending(a => a.Id)
            .Skip(skip)
            .Take(take)
            .Select(a => new { a.Id, a.DateAction, a.Uticod, a.Action, a.TableName, a.IpAddress })
            .ToListAsync(ct);

        // Hydratation des libellés utilisateur (prénom + nom). On ne fait qu'un seul
        // round-trip avec WHERE uticod IN (...) pour éviter le N+1.
        var uticods = page.Where(p => !string.IsNullOrEmpty(p.Uticod))
            .Select(p => p.Uticod!)
            .Distinct()
            .ToList();
        var users = uticods.Count == 0
            ? new Dictionary<string, string?>()
            : await _db.Utilisateurs.AsNoTracking()
                .Where(u => uticods.Contains(u.Uticod!))
                .Select(u => new { u.Uticod, u.Utiprn, u.Utinom })
                .ToDictionaryAsync(
                    u => u.Uticod!,
                    u => string.Join(' ', new[] { u.Utiprn, u.Utinom }.Where(x => !string.IsNullOrWhiteSpace(x))).Trim(),
                    ct);

        var items = page.Select(p => new AuditLogRow(
            p.Id,
            p.DateAction,
            p.Uticod,
            !string.IsNullOrEmpty(p.Uticod) && users.TryGetValue(p.Uticod, out var label) && !string.IsNullOrWhiteSpace(label)
                ? label
                : p.Uticod,
            p.Action,
            p.TableName,
            p.IpAddress)).ToList();

        return Ok(new AuditLogPage(total, items));
    }

    /// <summary>
    /// Valeurs distinctes utilisées par les filtres de l'UI (actions et tables).
    /// Renvoie au plus 100 lignes pour rester léger.
    /// </summary>
    [HttpGet("facets")]
    public async Task<IActionResult> GetFacets(CancellationToken ct)
    {
        var caller = await ResolveCallerAsync(ct);
        if (caller is null) return Forbid();

        var actions = await _db.AuditLogs.AsNoTracking()
            .Where(a => a.Action != null)
            .Select(a => a.Action!)
            .Distinct()
            .OrderBy(a => a)
            .Take(100)
            .ToListAsync(ct);

        var tables = await _db.AuditLogs.AsNoTracking()
            .Where(a => a.TableName != null)
            .Select(a => a.TableName!)
            .Distinct()
            .OrderBy(t => t)
            .Take(100)
            .ToListAsync(ct);

        return Ok(new { actions, tables });
    }

    /// <summary>
    /// Retourne (uticod, isAdmin, isManager) si l'appelant a le droit de consulter
    /// les audit logs, sinon null. On lit Utiadm et Utirole en une seule requête
    /// pour ne pas multiplier les round-trips.
    /// </summary>
    private async Task<(string Uticod, bool IsAdmin, bool IsManager)?> ResolveCallerAsync(CancellationToken ct)
    {
        var caller = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(caller)) return null;

        var info = await _db.Utilisateurs.AsNoTracking()
            .Where(u => u.Uticod == caller)
            .Select(u => new { u.Utiadm, u.Utirole })
            .FirstOrDefaultAsync(ct);
        if (info is null) return null;

        var isAdmin = info.Utiadm == "1" || PermissionCatalog.IsAdminRole(info.Utirole);
        var isManager = string.Equals(info.Utirole, PermissionCatalog.Roles.Manager, StringComparison.OrdinalIgnoreCase);
        if (!isAdmin && !isManager) return null;
        return (caller, isAdmin, isManager);
    }
}
