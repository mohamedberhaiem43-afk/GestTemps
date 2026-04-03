using ABRPOINT.Server.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using System.Security.Claims;

namespace ABRPOINT.Server.Annotations.CongesAttributes.CongeAttributes
{
    public class CanDeleteCongeAttribute : TypeFilterAttribute
    {
        public CanDeleteCongeAttribute() : base(typeof(CanDeleteCongeFilter))
        {
        }
        public class CanDeleteCongeFilter : IAuthorizationFilter
        {
            private readonly ApplicationDbContext _context;
            public CanDeleteCongeFilter(ApplicationDbContext context)
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
                    m.Modcod == "frm_conge" &&   // module code for "employe"
                    m.Modsupp == "1"         // allow add (saisie)
                );

                if (!hasPermission)
                {
                    context.Result = new ForbidResult();
                }
            }
        }
    }
}
