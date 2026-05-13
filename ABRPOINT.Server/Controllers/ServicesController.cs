using ABRPOINT.Server.Authorization;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Helpers;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

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

    public ServicesController(IServiceRepository serviceRepository, ApplicationDbContext db)
    {
        _servicesRepository = serviceRepository;
        _db = db;
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
    public async Task<IActionResult> Post([FromBody] Service service)
    {
        try
        {
            if (service == null) return BadRequest();
            // Auto-génération du code si non fourni.
            if (string.IsNullOrWhiteSpace(service.Sercod) && !string.IsNullOrWhiteSpace(service.Soccod))
            {
                service.Sercod = await SequentialCodeGenerator.NextServiceCodeAsync(_db, service.Soccod);
            }
            await _servicesRepository.AddAsync(service);
            return Ok(service);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = "Erreur interne. Consultez les logs serveur pour le détail." });
        }
    }

    // PUT api/Services/SOC01/SER01
    [HttpPut("{soccod}/{sercod}")]
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
