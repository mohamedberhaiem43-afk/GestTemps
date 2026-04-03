using ABRPOINT.Server.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using System.Security.Claims;

namespace ABRPOINT.Server.Annotations.AbsenceAttributes
{
    public class CanAddSanctionAttribute : TypeFilterAttribute
    {
            public CanAddSanctionAttribute() : base(typeof(CanAddSanctionFilter))
            {
            }
            public class CanAddSanctionFilter : IAuthorizationFilter
            {
                private readonly ApplicationDbContext _context;

                public CanAddSanctionFilter(ApplicationDbContext context)
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
                        m.Modsais == "1"         // allow Add (saisie)
                    );

                    if (!hasPermission)
                    {
                        context.Result = new ForbidResult();
                    }
                }
            }
        }

}
