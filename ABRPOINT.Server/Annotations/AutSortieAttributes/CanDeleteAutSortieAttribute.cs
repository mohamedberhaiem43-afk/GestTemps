using ABRPOINT.Server.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using System.Security.Claims;

namespace ABRPOINT.Server.Annotations.AutSortieAttributes
{
    public class CanDeleteAutSortieAttribute : TypeFilterAttribute
    {
        public CanDeleteAutSortieAttribute() : base(typeof(CanDeleteAutorisationsFilter))
        {
        }
        public class CanDeleteAutorisationsFilter : IAuthorizationFilter
        {
            private readonly ApplicationDbContext _context;
            public CanDeleteAutorisationsFilter(ApplicationDbContext context)
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
                var hasPermission = _context.Modusers.Any(m =>
                    m.Uticod == userUticod &&
                    m.Modcod == "emp_aut" &&   // module code for "aut sortie"
                    m.Modsupp == "1"         // allow delete
                );

                if (!hasPermission)
                {
                    context.Result = new ForbidResult();
                }
            }
        }
    }
}

