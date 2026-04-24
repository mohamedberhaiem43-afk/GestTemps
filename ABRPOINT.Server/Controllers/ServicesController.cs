using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

[Route("api/[controller]")]
[ApiController]
[Authorize]
public class ServicesController : ControllerBase
{
    private readonly IServiceRepository _servicesRepository;

    public ServicesController(IServiceRepository serviceRepository)
    {
        _servicesRepository = serviceRepository;
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
            return StatusCode(500, ex.Message);
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
            await _servicesRepository.AddAsync(service);
            return Ok("Service added successfully.");
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
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
