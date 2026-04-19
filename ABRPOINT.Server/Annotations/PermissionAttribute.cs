using ABRPOINT.Server.Data;
using ABRPOINT.Server.Helpers;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using System.Security.Claims;

namespace ABRPOINT.Server.Annotations
{
    public class PermissionAttribute : TypeFilterAttribute
    {
        public PermissionAttribute(string module, string action) : base(typeof(PermissionFilter))
        {
            Arguments = new object[] { module, action };
        }
    }

    public class PermissionFilter : IAsyncAuthorizationFilter
    {
        private readonly ApplicationDbContext _context;
        private readonly string _module;
        private readonly string _action;

        public PermissionFilter(ApplicationDbContext context, string module, string action)
        {
            _context = context;
            _module = module;
            _action = action;
        }

        public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
        {
            var userUticod = context.HttpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            if (string.IsNullOrEmpty(userUticod))
            {
                context.Result = new ForbidResult();
                return;
            }

            // Check permission using the centralized helper (which now checks RolePermissions)
            if (!await PermissionChecker.HasPermissionAsync(_context, userUticod, _module, _action))
            {
                context.Result = new ForbidResult();
            }
        }
    }
}
