using ABRPOINT.Server.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using System.Security.Claims;

namespace ABRPOINT.Server.Annotations.CongesAttributes.DemCongeAttributes
{
    public class CanUpdateDemCongeAttribute : TypeFilterAttribute
    {
        public CanUpdateDemCongeAttribute() : base(typeof(CanUpdateDemCongeFilter))
        {
        }
        public class CanUpdateDemCongeFilter : IAuthorizationFilter
        {
            private readonly ApplicationDbContext _context;
            public CanUpdateDemCongeFilter(ApplicationDbContext context)
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
                    m.Modcod == "dem_conge" &&   // module code for "employe"
                    m.Modupd == "1"         // allow add (saisie)
                );

                if (!hasPermission)
                {
                    context.Result = new ForbidResult();
                }
            }
        }
    }

}
