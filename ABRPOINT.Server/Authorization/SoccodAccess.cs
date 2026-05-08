using ABRPOINT.Server.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using System.Security.Claims;

namespace ABRPOINT.Server.Authorization;

/// <summary>
/// Helper réutilisable pour valider qu'un <c>soccod</c> est accessible à l'utilisateur courant.
///
/// Sert deux cas :
///   1. <see cref="ValidateSoccodAttribute"/> pour les endpoints où soccod arrive en route/query.
///   2. Endpoints où soccod arrive dans le body JSON (DashboardController, etc.) — l'attribut ne
///      peut pas y accéder sans consommer le stream de requête, donc on appelle ce helper inline
///      depuis le controller.
///
/// Cache 60 s par (slug, uticod) — TTL alignée sur RequirePermission/ValidateSoccod.
/// Bypass admin (Utiadm=1 ou rôle admin) intégré.
/// </summary>
public static class SoccodAccess
{
    private static readonly TimeSpan CacheTtl = TimeSpan.FromSeconds(60);

    /// <summary>
    /// Vérifie qu'un <paramref name="soccod"/> donné est accessible à <paramref name="uticod"/>.
    /// </summary>
    public static async Task<bool> IsAllowedAsync(
        ApplicationDbContext db,
        IMemoryCache cache,
        string tenantSlug,
        string uticod,
        string soccod,
        CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(soccod) || string.IsNullOrEmpty(uticod)) return false;

        var cacheKey = $"socuser:{tenantSlug}:{uticod}";
        var allowed = await cache.GetOrCreateAsync(cacheKey, async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = CacheTtl;
            return await LoadAllowedAsync(db, uticod, ct);
        }) ?? new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        return allowed.Contains(soccod);
    }

    /// <summary>
    /// Variante qui lit l'identité depuis le HttpContext (uticod via NameIdentifier, slug via claim).
    /// </summary>
    public static async Task<bool> IsAllowedAsync(
        HttpContext httpCtx,
        ApplicationDbContext db,
        IMemoryCache cache,
        string soccod,
        CancellationToken ct = default)
    {
        var uticod = httpCtx.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(uticod)) return false;
        var slug = httpCtx.User.FindFirst("tenant_slug")?.Value ?? "_";
        return await IsAllowedAsync(db, cache, slug, uticod, soccod, ct);
    }

    private static async Task<HashSet<string>> LoadAllowedAsync(ApplicationDbContext db, string uticod, CancellationToken ct)
    {
        var user = await db.Utilisateurs
            .AsNoTracking()
            .Where(u => u.Uticod == uticod)
            .Select(u => new { u.Utiadm, u.Utirole })
            .FirstOrDefaultAsync(ct);

        // Bypass admin : un Administrator a accès à toutes les sociétés du tenant.
        if (user != null && (user.Utiadm == "1" || PermissionCatalog.IsAdminRole(user.Utirole)))
        {
            var allSoccods = await db.Societes
                .AsNoTracking()
                .Select(s => s.Soccod)
                .ToListAsync(ct);
            return new HashSet<string>(
                allSoccods.Where(s => !string.IsNullOrEmpty(s))!,
                StringComparer.OrdinalIgnoreCase);
        }

        var soccods = await db.Socusers
            .AsNoTracking()
            .Where(s => s.Uticod == uticod && s.Soccod != null)
            .Select(s => s.Soccod!)
            .Distinct()
            .ToListAsync(ct);
        return new HashSet<string>(soccods, StringComparer.OrdinalIgnoreCase);
    }
}
