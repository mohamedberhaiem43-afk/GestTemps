using ABRPOINT.Server.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using System.Security.Claims;

namespace ABRPOINT.Server.Authorization;

/// <summary>
/// Garde-fou multi-tenant : refuse l'accès si la valeur de <c>soccod</c> dans l'URL ne fait
/// pas partie des sociétés auxquelles l'utilisateur connecté est rattaché (table Socuser).
///
/// Sans ce filtre, un utilisateur authentifié de la société A peut interroger les données
/// de la société B en changeant simplement le paramètre URL (audit S3). Le tenant DB est
/// déjà résolu en amont par <c>TenantResolverMiddleware</c>, mais à l'intérieur d'un même
/// tenant plusieurs <c>soccod</c> peuvent coexister.
///
/// Usage :
/// <code>
///   [HttpGet("{soccod}/{empcod}")]
///   [ValidateSoccod]
///   public Task&lt;IActionResult&gt; Get(string soccod, string empcod) { ... }
/// </code>
///
/// Performance : la liste des soccod autorisés pour l'utilisateur courant est mise en
/// cache 60 s par (slug, uticod). Aligné sur la TTL de RequirePermissionAttribute.
/// </summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = false)]
public class ValidateSoccodAttribute : TypeFilterAttribute
{
    /// <param name="paramName">Nom du paramètre route/query qui porte le code société. Par défaut "soccod".</param>
    public ValidateSoccodAttribute(string paramName = "soccod")
        : base(typeof(ValidateSoccodFilter))
    {
        Arguments = new object[] { paramName };
    }

    public sealed class ValidateSoccodFilter : IAsyncAuthorizationFilter
    {
        private static readonly TimeSpan CacheTtl = TimeSpan.FromSeconds(60);

        private readonly string _paramName;
        private readonly ApplicationDbContext _db;
        private readonly IMemoryCache _cache;

        public ValidateSoccodFilter(string paramName, ApplicationDbContext db, IMemoryCache cache)
        {
            _paramName = paramName;
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

            // Résolution permissive du soccod : on tente d'abord la route, puis la query string.
            // Cela évite à l'appelant de devoir préciser la source quand le param vit côté query.
            var requested = ResolveParam(ctx, _paramName);
            if (string.IsNullOrWhiteSpace(requested))
            {
                // Si l'attribut est posé mais qu'aucun soccod n'arrive — laisser passer plutôt
                // que de bloquer une route mal câblée. La validation n'a de sens que sur un
                // soccod explicite ; sinon le tenant resolver et [Authorize] suffisent.
                return;
            }

            var slugClaim = ctx.HttpContext.User.FindFirst("tenant_slug")?.Value ?? "_";
            var cacheKey = $"socuser:{slugClaim}:{uticod}";
            var allowed = await _cache.GetOrCreateAsync(cacheKey, async entry =>
            {
                entry.AbsoluteExpirationRelativeToNow = CacheTtl;
                return await LoadAllowedAsync(uticod);
            }) ?? new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            if (!allowed.Contains(requested))
            {
                ctx.Result = new ObjectResult(new
                {
                    error = "Accès refusé : vous n'êtes pas rattaché à cette société.",
                    code = "soccod_forbidden",
                })
                {
                    StatusCode = StatusCodes.Status403Forbidden,
                };
            }
        }

        private static string? ResolveParam(AuthorizationFilterContext ctx, string name)
        {
            if (ctx.RouteData.Values.TryGetValue(name, out var routeVal) && routeVal != null)
            {
                var s = routeVal.ToString();
                if (!string.IsNullOrWhiteSpace(s)) return s;
            }
            if (ctx.HttpContext.Request.Query.TryGetValue(name, out var queryVal))
            {
                var s = queryVal.ToString();
                if (!string.IsNullOrWhiteSpace(s)) return s;
            }
            return null;
        }

        private async Task<HashSet<string>> LoadAllowedAsync(string uticod)
        {
            // Bypass admin : un Administrator a accès à toutes les sociétés du tenant. Sans ce
            // bypass, les écrans d'administration (création de société, switching) seraient cassés.
            var user = await _db.Utilisateurs
                .AsNoTracking()
                .Where(u => u.Uticod == uticod)
                .Select(u => new { u.Utiadm, u.Utirole })
                .FirstOrDefaultAsync();

            if (user != null && (user.Utiadm == "1" || PermissionCatalog.IsAdminRole(user.Utirole)))
            {
                var allSoccods = await _db.Societes
                    .AsNoTracking()
                    .Select(s => s.Soccod)
                    .ToListAsync();
                return new HashSet<string>(allSoccods.Where(s => !string.IsNullOrEmpty(s))!,
                                           StringComparer.OrdinalIgnoreCase);
            }

            var soccods = await _db.Socusers
                .AsNoTracking()
                .Where(s => s.Uticod == uticod && s.Soccod != null)
                .Select(s => s.Soccod!)
                .Distinct()
                .ToListAsync();
            return new HashSet<string>(soccods, StringComparer.OrdinalIgnoreCase);
        }
    }
}
