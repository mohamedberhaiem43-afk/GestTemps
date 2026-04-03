using ABRPOINT.Server.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using System.Security.Claims;

namespace ABRPOINT.Server.Annotations.AllaitementAttributes
{
    public class CanAddAllaitementAttribute : TypeFilterAttribute
    {
        public CanAddAllaitementAttribute() : base(typeof(CanAddAllaitementFilter))
        {
        }
        public class CanAddAllaitementFilter : IAuthorizationFilter
        {
            private readonly ApplicationDbContext _context;
            public CanAddAllaitementFilter(ApplicationDbContext context)
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
                    m.Modsais == "1"         // allow add
                );

                if (!hasPermission)
                {
                    context.Result = new ForbidResult();
                }
            }

        }
    }
}
