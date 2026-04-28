using ABRPOINT.Server.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Controllers;

/// <summary>
/// Endpoint public (control plane) : la page de login l'appelle avant /Utilisateurs/connect
/// pour résoudre le tenant à partir de l'email saisi. Évite de demander le code société
/// à l'utilisateur quand l'app est servie depuis le domaine racine (sans wildcard subdomain).
/// </summary>
[ApiController]
[Route("api/auth")]
[AllowAnonymous]
public class AuthLookupController : ControllerBase
{
    private readonly IDbContextFactory<MasterDbContext> _masterFactory;

    public AuthLookupController(IDbContextFactory<MasterDbContext> masterFactory)
    {
        _masterFactory = masterFactory;
    }

    public sealed record LookupTenantRequest(string Email);

    [HttpPost("lookup-tenant")]
    public async Task<IActionResult> LookupTenant([FromBody] LookupTenantRequest req, CancellationToken ct)
    {
        var email = (req?.Email ?? string.Empty).Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(email) || !email.Contains('@'))
            return BadRequest(new { error = "Email invalide." });

        await using var master = await _masterFactory.CreateDbContextAsync(ct);
        var entry = await master.TenantEmailIndex.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Email == email, ct);
        if (entry is null)
            return NotFound(new { error = "Aucun compte trouvé pour cet email." });

        return Ok(new { slug = entry.Slug });
    }
}
