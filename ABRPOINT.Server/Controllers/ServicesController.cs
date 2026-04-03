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

    // GET: api/Services
    [HttpGet("get-services/{soccod}")]
    public IEnumerable<Service> Get(string soccod)
    {
        return _servicesRepository.GetAll(soccod);
    }
    [HttpGet("get-servlibs/{soccod}")]
    public async Task<Dictionary<string, string>> GetServLibs(string soccod)
    {
        try
        {
            var services = await _servicesRepository.GetServLibs(soccod);
            return services;
        }
        catch (Exception)
        {
            throw;
        }
    }

    // GET api/Services/5
    [HttpGet("{soccod}/{sercod}")]
    public ActionResult<Service> Get(string sercod,string soccod)
    {
        var service = _servicesRepository.GetBySercod(sercod, soccod);
        if (service == null)
        {
            return NotFound();
        }
        return Ok(service);
    }

    // POST api/Services
    [HttpPost]
    public IActionResult Post([FromBody] Service service)
    {
        try
        {

            _servicesRepository.Add(service);
            return Ok("Service added successfully.");

        }
        catch(Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // PUT api/Services/5
    [HttpPut("{soccod}/{sercod}")]
    public IActionResult Put(string sercod, [FromBody] Service service)
    {
        if (service == null || sercod != service.Sercod)
        {
            return BadRequest();
        }
        
        _servicesRepository.Update(service);
        return NoContent();
    }

    // DELETE api/Services/5
    // DELETE api/Services/{sercod}
    [HttpDelete("{soccod}/{sercod}")]

    public async Task<IActionResult> Delete(string sercod,string soccod)
    {
        var service = await _servicesRepository.GetBySercod(sercod, soccod);
        if (service == null)
        {
            return NotFound();
        }
        _servicesRepository.Delete(service);
        return NoContent();
    }

}
