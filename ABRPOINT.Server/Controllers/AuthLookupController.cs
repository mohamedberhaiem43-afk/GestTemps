using ABRPOINT.Server.Data;
using ABRPOINT.Server.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

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
    private readonly IConfiguration _cfg;
    private readonly ILogger<AuthLookupController> _log;

    public AuthLookupController(
        IDbContextFactory<MasterDbContext> masterFactory,
        IConfiguration cfg,
        ILogger<AuthLookupController> log)
    {
        _masterFactory = masterFactory;
        _cfg = cfg;
        _log = log;
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
        if (entry is not null)
            return Ok(new { slug = entry.Slug });

        // Fallback : email pas (encore) indexé. Cas typique : employés/admins créés avant que
        // l'upsert TenantEmailIndex ne soit en place, ou dont l'index a échoué silencieusement.
        // On scanne les bases des tenants actifs pour retrouver l'utilisateur via Utilisateurs.Utimail
        // ou Employes.Empemail, et on backfill l'index pour les prochains logins.
        var template = _cfg.GetConnectionString("TenantTemplate");
        if (string.IsNullOrWhiteSpace(template))
            return NotFound(new { error = "Aucun compte trouvé pour cet email." });

        var tenants = await master.Tenants.AsNoTracking()
            .Where(t => t.Status == "Active" || t.Status == "Trialing" || t.Status == "Provisioning")
            .ToListAsync(ct);

        foreach (var t in tenants)
        {
            try
            {
                var connStr = template.Replace("{DbName}", t.DbName);
                var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                    .UseSqlServer(connStr, sql => sql.EnableRetryOnFailure())
                    .Options;
                await using var tdb = new ApplicationDbContext(options);

                var found = await tdb.Utilisateurs.AsNoTracking()
                    .AnyAsync(u => u.Utimail == email, ct);
                if (!found)
                {
                    found = await tdb.Employes.AsNoTracking()
                        .AnyAsync(e => e.Empemail != null && e.Empemail.ToLower() == email, ct);
                }

                if (found)
                {
                    // Backfill l'index pour court-circuiter le scan au prochain login.
                    var existing = await master.TenantEmailIndex
                        .FirstOrDefaultAsync(x => x.Email == email, ct);
                    if (existing == null)
                    {
                        master.TenantEmailIndex.Add(new TenantEmailIndex
                        {
                            Email = email,
                            Slug = t.Slug,
                            CreatedAt = DateTime.UtcNow,
                        });
                        await master.SaveChangesAsync(ct);
                    }
                    return Ok(new { slug = t.Slug });
                }
            }
            catch (Exception ex)
            {
                // Une base tenant indisponible ne doit pas faire échouer le lookup global.
                _log.LogWarning(ex, "Scan tenant {Slug} ({DbName}) échoué pour lookup email", t.Slug, t.DbName);
            }
        }

        return NotFound(new { error = "Aucun compte trouvé pour cet email." });
    }
}
