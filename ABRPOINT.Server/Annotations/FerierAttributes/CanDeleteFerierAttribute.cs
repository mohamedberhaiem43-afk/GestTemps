using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using System.Security.Claims;
using ABRPOINT.Server.Data;

namespace ABRPOINT.Server.Annotations.FerierAttributes
{
    public class CanDeleteFerierAttribute : TypeFilterAttribute
    {
        public CanDeleteFerierAttribute() : base(typeof(CanDeleteFerieFilter))
        {
        }
        public class CanDeleteFerieFilter : IAuthorizationFilter
        {
            private readonly ApplicationDbContext _context;

            public CanDeleteFerieFilter(ApplicationDbContext context)
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
                    m.Modcod == "frm_ferie" &&   // module code for "Ferie"
                    m.Modsupp == "1"         // allow Add (saisie)
                );

                if (!hasPermission)
                {
                    context.Result = new ForbidResult();
                }
            }
        }
    }
}
