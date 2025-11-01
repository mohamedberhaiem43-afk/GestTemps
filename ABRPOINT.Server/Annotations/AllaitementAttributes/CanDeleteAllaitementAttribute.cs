using ABRPOINT.Server.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using System.Security.Claims;

namespace ABRPOINT.Server.Annotations.AllaitementAttributes
{
    public class CanDeleteAllaitementAttribute : TypeFilterAttribute
    {
        public CanDeleteAllaitementAttribute() : base(typeof(CanDeleteAllaitementFilter))
        {
        }
        public class CanDeleteAllaitementFilter : IAuthorizationFilter
        {
            private readonly ApplicationDbContext _context;
            public CanDeleteAllaitementFilter(ApplicationDbContext context)
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
                    m.Modcod == "emp_allait" &&   // module code for "allaitement"
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
