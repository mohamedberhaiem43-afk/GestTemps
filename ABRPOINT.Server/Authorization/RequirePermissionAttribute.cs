using ABRPOINT.Server.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using System.Security.Claims;

namespace ABRPOINT.Server.Authorization;

/// <summary>
/// Restreint un endpoint à un couple (module, action) explicite via la matrice RolePermission
/// du rôle de l'utilisateur. Utilisable conjointement avec [Authorize].
///
/// Règles :
///   1. Si l'utilisateur est `Administrator` ou a `Utiadm="1"` → accès accordé (god mode).
///   2. Sinon, on cherche RolePermission avec RpModule == module pour le rôle de l'utilisateur,
///      et on vérifie que la colonne correspondante (RpConsult/RpAdd/RpModify/RpDelete) vaut "1".
///
/// Exemples :
///     [Authorize][RequirePermission(PermissionCatalog.Modules.PaieRemuneration, PermissionCatalog.Actions.Add)]
///     [Authorize][RequirePermission("Gestion des Congés", "delete")]
///
/// Cache : 60 s en mémoire pour éviter une lecture DB à chaque requête (ICurrentTenant garantit
/// la séparation par tenant via le DbContext résolu côté DI ; la clé de cache inclut le slug).
/// </summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = true)]
public class RequirePermissionAttribute : TypeFilterAttribute
{
    public RequirePermissionAttribute(string module, string action)
        : base(typeof(RequirePermissionFilter))
    {
        Arguments = new object[] { module, action };
    }

    public sealed class RequirePermissionFilter : IAsyncAuthorizationFilter
    {
        private static readonly TimeSpan CacheTtl = TimeSpan.FromSeconds(60);

        private readonly string _module;
        private readonly string _action;
        private readonly ApplicationDbContext _db;
        private readonly IMemoryCache _cache;

        public RequirePermissionFilter(string module, string action, ApplicationDbContext db, IMemoryCache cache)
        {
            _module = module;
            _action = action;
            _db = db;
            _cache = cache;
        }

        public async Task OnAuthorizationAsync(AuthorizationFilterContext ctx)
        {
            var uticod = ctx.HttpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(uticod))
            {
                ctx.Result = new ForbidResult();
                return;
            }

            // La clé de cache combine uticod + tenant slug (issu du claim JWT) pour garantir
            // l'isolation entre tenants même si plusieurs uticods 'AD' coexistent.
            var slugClaim = ctx.HttpContext.User.FindFirst("tenant_slug")?.Value ?? "_";
            var cacheKey = $"perm:{slugClaim}:{uticod}";

            var snapshot = await _cache.GetOrCreateAsync(cacheKey, async entry =>
            {
                entry.AbsoluteExpirationRelativeToNow = CacheTtl;
                return await LoadSnapshotAsync(uticod);
            }) ?? new UserPermissionSnapshot(false, new Dictionary<string, string>());

            // Bypass admin total.
            if (snapshot.IsAdmin) return;

            // Vérification matrice.
            if (!snapshot.Matrix.TryGetValue(_module, out var matrix) || matrix.Length < 4)
            {
                ctx.Result = new ObjectResult(new { error = $"Permission refusée : module '{_module}' non accordé." }) { StatusCode = 403 };
                return;
            }

            // matrix = "CAMD" — chaque caractère vaut '1' ou '0' dans l'ordre Consult, Add, Modify, Delete.
            var idx = _action.ToLowerInvariant() switch
            {
                "consult" => 0,
                "add" => 1,
                "modify" => 2,
                "delete" => 3,
                _ => -1,
            };
            if (idx < 0 || matrix[idx] != '1')
            {
                ctx.Result = new ObjectResult(new { error = $"Permission refusée : action '{_action}' non autorisée sur '{_module}'." }) { StatusCode = 403 };
            }
        }

        private async Task<UserPermissionSnapshot> LoadSnapshotAsync(string uticod)
        {
            var user = await _db.Utilisateurs
                .AsNoTracking()
                .Where(u => u.Uticod == uticod)
                .Select(u => new { u.Utiadm, u.Utirole })
                .FirstOrDefaultAsync();

            if (user is null)
                return new UserPermissionSnapshot(false, new Dictionary<string, string>());

            var isAdmin = user.Utiadm == "1" || PermissionCatalog.IsAdminRole(user.Utirole);
            if (isAdmin)
                return new UserPermissionSnapshot(true, new Dictionary<string, string>());

            var perms = await _db.RolePermissions
                .AsNoTracking()
                .Where(rp => rp.Role!.RoleName == user.Utirole)
                .Select(rp => new { rp.RpModule, rp.RpConsult, rp.RpAdd, rp.RpModify, rp.RpDelete })
                .ToListAsync();

            var matrix = perms.ToDictionary(
                p => p.RpModule,
                p => $"{p.RpConsult}{p.RpAdd}{p.RpModify}{p.RpDelete}",
                StringComparer.OrdinalIgnoreCase);

            return new UserPermissionSnapshot(false, matrix);
        }
    }

    private sealed record UserPermissionSnapshot(bool IsAdmin, IReadOnlyDictionary<string, string> Matrix);
}
