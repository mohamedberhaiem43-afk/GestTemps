using ABRPOINT.Server.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using System.Security.Claims;

namespace ABRPOINT.Server.Annotations.AbsenceAttributes
{
    public class CanUpdateSanctionAttribute : TypeFilterAttribute
    {
        public CanUpdateSanctionAttribute() : base(typeof(CanUpdateSanctionFilter))
        {
        }
        public class CanUpdateSanctionFilter : IAuthorizationFilter
        {
            private readonly ApplicationDbContext _context;

            public CanUpdateSanctionFilter(ApplicationDbContext context)
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
                    m.Modcod == "emp_abs" &&   // module code for "sanction"
                    m.Modupd == "1"         // allow update
                );

                if (!hasPermission)
                {
                    context.Result = new ForbidResult();
                }
            }
        }
    }

}
