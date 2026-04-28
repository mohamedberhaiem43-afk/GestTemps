using ABRPOINT.Server.Authorization;
using ABRPOINT.Server.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using System.Security.Claims;

namespace ABRPOINT.Server.Annotations.AdminAttributes
{
    /// <summary>
    /// Restreint un endpoint aux administrateurs du tenant.
    /// Source de vérité : l'utilisateur a Utiadm="1" OU Utirole = "Administrator".
    /// Les deux sont supposés alignés (sync à l'écriture), mais on accepte l'un ou l'autre
    /// pour rester robuste si l'écriture a sauté un côté.
    /// </summary>
    public class AdminAttribute : TypeFilterAttribute
    {
        public AdminAttribute() : base(typeof(AdminFilter))
        {
        }
        public class AdminFilter : IAuthorizationFilter
        {
            private readonly ApplicationDbContext _context;
            public AdminFilter(ApplicationDbContext context)
            {
                _context = context;
            }
            public void OnAuthorization(AuthorizationFilterContext context)
            {
                var userUticod = context.HttpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

                if (string.IsNullOrEmpty(userUticod))
                {
                    context.Result = new ForbidResult();
                    return;
                }

                var adminRoleName = PermissionCatalog.Roles.Administrator;
                var hasPermission = _context.Utilisateurs.Any(m =>
                    m.Uticod == userUticod &&
                    (m.Utiadm == "1" || m.Utirole == adminRoleName)
                );

                if (!hasPermission)
                {
                    context.Result = new ForbidResult();
                }
            }
        }
    }
}
