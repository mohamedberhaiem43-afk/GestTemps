using ABRPOINT.Server.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Controllers;

/// <summary>
/// Controller pilote pour valider l'isolation multi-tenant.
/// Pour chaque requête entrante, le `TenantResolverMiddleware` a résolu un Tenant à partir
/// du sous-domaine (ou du header `X-Tenant-Slug`). Ce controller utilise ITenantDbContextFactory
/// pour ouvrir un DbContext sur la base SQL de ce tenant et lire des données à isoler.
///
/// Endpoints :
///   GET /api/tenant-pilot/whoami   → renvoie infos sur le tenant courant (master DB).
///   GET /api/tenant-pilot/employees → renvoie les 10 premiers employés DEPUIS la base du tenant.
/// </summary>
[ApiController]
[Route("api/tenant-pilot")]
[AllowAnonymous] // pour test : pas de JWT requis. À durcir en prod.
public class TenantPilotController : ControllerBase
{
    private readonly ICurrentTenant _current;
    private readonly ITenantDbContextFactory _factory;

    public TenantPilotController(ICurrentTenant current, ITenantDbContextFactory factory)
    {
        _current = current;
        _factory = factory;
    }

    [HttpGet("whoami")]
    public IActionResult WhoAmI()
    {
        var t = _current.Current;
        if (t is null)
            return NotFound(new { error = "Aucun tenant résolu pour cette requête (header X-Tenant-Slug ou sous-domaine attendu)." });

        return Ok(new
        {
            tenantId = t.Id,
            slug = t.Slug,
            companyName = t.CompanyName,
            dbName = t.DbName,
            status = t.Status,
            legacySoccod = t.LegacySoccod,
            trialEndsAt = t.TrialEndsAt,
        });
    }

    [HttpGet("employees")]
    public async Task<IActionResult> Employees()
    {
        var t = _current.Current;
        if (t is null)
            return NotFound(new { error = "Aucun tenant en scope." });

        await using var db = _factory.Create();
        // On utilise une projection minimale pour prouver que la connexion pointe bien sur la base du tenant.
        var rows = await db.Employes
            .AsNoTracking()
            .OrderBy(e => e.Empcod)
            .Take(10)
            .Select(e => new { e.Empcod, e.Empmat, e.Emplib, e.Soccod, e.Sercod })
            .ToListAsync();

        return Ok(new
        {
            tenant = t.Slug,
            db = t.DbName,
            count = rows.Count,
            sample = rows,
        });
    }
}
