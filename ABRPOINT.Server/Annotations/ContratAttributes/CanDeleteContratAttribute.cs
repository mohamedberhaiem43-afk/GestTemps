using ABRPOINT.Server.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using System.Security.Claims;

namespace ABRPOINT.Server.Annotations.ContratAttributes
{
    public class CanDeleteContratAttribute : TypeFilterAttribute
    {
        public CanDeleteContratAttribute() : base(typeof(CanDeleteContratFilter))
        {
        }
        public class CanDeleteContratFilter : IAuthorizationFilter
        {
            private readonly ApplicationDbContext _context;
            public CanDeleteContratFilter(ApplicationDbContext context)
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
                    m.Modcod == "emp_ctr" &&   // module code for "contrat"
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
