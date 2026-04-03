using ABRPOINT.Server.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using System.Security.Claims;

namespace ABRPOINT.Server.Annotations.AbsenceAttributes
{
    public class CanDeleteAbsenceAttribute : TypeFilterAttribute
    {
        public CanDeleteAbsenceAttribute() : base(typeof(CanDeleteAbsenceFilter))
        {
        }
        public class CanDeleteAbsenceFilter : IAuthorizationFilter
        {
            private readonly ApplicationDbContext _context;

            public CanDeleteAbsenceFilter(ApplicationDbContext context)
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
                    m.Modcod == "absence" &&   // module code for "absence"
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
