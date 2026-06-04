using ABRPOINT.Server.Authorization;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Helpers;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

[Route("api/[controller]")]
[ApiController]
[Authorize]
// SEC AI : ValidateSoccod manquait — n'importe quel user authentifié pouvait CRUD les services
// de n'importe quelle société du tenant.
[ValidateSoccod]
public class ServicesController : ControllerBase
{
    private readonly IServiceRepository _servicesRepository;
    private readonly ApplicationDbContext _db;
    private readonly IEmployeRepository _employes;

    public ServicesController(IServiceRepository serviceRepository, ApplicationDbContext db, IEmployeRepository employes)
    {
        _servicesRepository = serviceRepository;
        _db = db;
        _employes = employes;
    }

    // Service (Sercod) du manager appelant ; null pour admin/RH (= pas de scoping).
    private async Task<string?> CallerManagerServiceAsync(string? soccod)
    {
        var caller = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(caller) || string.IsNullOrEmpty(soccod)) return null;
        return await _employes.GetManagerServiceCodeAsync(soccod, caller);
    }

    // GET api/Services/next-code/SOC01 — code séquentiel auto-généré pour ce soccod.
    [HttpGet("next-code/{soccod}")]
    public async Task<IActionResult> NextCode(string soccod)
    {
        var code = await SequentialCodeGenerator.NextServiceCodeAsync(_db, soccod);
        return Ok(new { code });
    }

    // GET: api/Services/get-services/SOC01
    [HttpGet("get-services/{soccod}")]
    public async Task<ActionResult<IEnumerable<Service>>> Get(string soccod)
    {
        var services = await _servicesRepository.GetAllAsync(soccod);
        return Ok(services);
    }

    [HttpGet("get-servlibs/{soccod}")]
    public async Task<ActionResult<Dictionary<string, string>>> GetServLibs(string soccod)
    {
        try
        {
            var services = await _servicesRepository.GetServLibsAsync(soccod);
            // Scoping manager : un manager (non admin/RH) ne voit QUE son propre service
            // dans les listes (défense en profondeur, en plus de la restriction UI).
            var managerService = await CallerManagerServiceAsync(soccod);
            if (!string.IsNullOrEmpty(managerService))
            {
                services = services
                    .Where(kv => kv.Key == managerService)
                    .ToDictionary(kv => kv.Key, kv => kv.Value);
            }
            return Ok(services);
        }
        catch (Exception ex)
        {
            return StatusCode(500, "Erreur interne. Consultez les logs serveur pour le détail.");
        }
    }

    // GET api/Services/SOC01/SER01
    [HttpGet("{soccod}/{sercod}")]
    public async Task<ActionResult<Service>> Get(string soccod, string sercod)
    {
        var service = await _servicesRepository.GetBySercodAsync(sercod, soccod);
        if (service == null)
        {
            return NotFound();
        }
        return Ok(service);
    }

    // POST api/Services
    [HttpPost]
    [RequirePermission(PermissionCatalog.Modules.DonneesDeBase, PermissionCatalog.Actions.Add)]
    public async Task<IActionResult> Post([FromBody] Service service)
    {
        if (service == null)
            return BadRequest(new { message = "Données du service manquantes." });

        // Le soccod est indispensable : c'est la clé tenant et la base de la génération du code.
        // Sans lui, l'insertion partait avec un code (PK) null → DbUpdateException → 400 opaque.
        if (string.IsNullOrWhiteSpace(service.Soccod))
            return BadRequest(new { message = "La société (soccod) est obligatoire pour créer un service." });

        // Scoping manager : un manager est limité à son service existant → il ne peut pas
        // créer de nouveaux services (réservé admin/RH).
        if (!string.IsNullOrEmpty(await CallerManagerServiceAsync(service.Soccod)))
            return StatusCode(403, new { message = "Un manager ne peut pas créer de nouveau service. Contactez un administrateur." });

        // Auto-génération du code si non fourni.
        if (string.IsNullOrWhiteSpace(service.Sercod))
        {
            service.Sercod = await SequentialCodeGenerator.NextServiceCodeAsync(_db, service.Soccod);
        }

        try
        {
            await _servicesRepository.AddAsync(service);
            return Ok(service);
        }
        catch (Exception ex)
        {
            // Le repository lève une Exception au message explicite pour les cas métier
            // (ex. code déjà existant). On le remonte au client ; le détail technique reste
            // dans les logs serveur.
            return BadRequest(new { message = ex.Message });
        }
    }

    // PUT api/Services/SOC01/SER01
    [HttpPut("{soccod}/{sercod}")]
    [RequirePermission(PermissionCatalog.Modules.DonneesDeBase, PermissionCatalog.Actions.Modify)]
    public async Task<IActionResult> Put(string soccod, string sercod, [FromBody] Service service)
    {
        if (service == null || sercod != service.Sercod)
        {
            return BadRequest();
        }

        await _servicesRepository.UpdateAsync(service);
        return NoContent();
    }

    // DELETE api/Services/SOC01/SER01
    [HttpDelete("{soccod}/{sercod}")]
    [RequirePermission(PermissionCatalog.Modules.DonneesDeBase, PermissionCatalog.Actions.Delete)]
    public async Task<IActionResult> Delete(string soccod, string sercod)
    {
        var service = await _servicesRepository.GetBySercodAsync(sercod, soccod);
        if (service == null)
        {
            return NotFound();
        }
        await _servicesRepository.DeleteAsync(service);
        return NoContent();
    }
}
