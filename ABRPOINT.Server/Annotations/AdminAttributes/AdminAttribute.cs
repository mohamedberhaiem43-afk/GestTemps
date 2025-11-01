using ABRPOINT.Server.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using System.Security.Claims;

namespace ABRPOINT.Server.Annotations.AdminAttributes
{
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
                // Get logged-in user's uticod from Claims
                var userUticod = context.HttpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

                if (string.IsNullOrEmpty(userUticod))
                {
                    context.Result = new ForbidResult();
                    return;
                }

                // Check in moduser table if this user has permission
                var hasPermission = _context.Utilisateurs.Any(m =>
                    m.Uticod == userUticod &&
                    m.Utiadm == "1"
                );

                if (!hasPermission)
                {
                    context.Result = new ForbidResult();
                }
            }
        }
    }
}
