using ABRPOINT.Server.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using System.Security.Claims;

namespace ABRPOINT.Server.Annotations.PointeuseAttributes
{
    public class CanUpdatePointeuseAttribute : TypeFilterAttribute
    {
        public CanUpdatePointeuseAttribute() : base(typeof(CanUpdatePointeuseFilter))
        {
        }
        public class CanUpdatePointeuseFilter : IAuthorizationFilter
        {
            private readonly ApplicationDbContext _context;

            public CanUpdatePointeuseFilter(ApplicationDbContext context)
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
                    m.Modcod == "pointeuse" &&   // module code for "Ferie"
                    m.Modupd == "1"         // allow Add (saisie)
                );

                if (!hasPermission)
                {
                    context.Result = new ForbidResult();
                }
            }
        }

    }
}
