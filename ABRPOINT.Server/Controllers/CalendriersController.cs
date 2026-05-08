using ABRPOINT.Server.Authorization;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    // SEC AI : ValidateSoccod manquait — clone calendar cross-soccod possible.
    [ValidateSoccod]
    public class CalendriersController : ControllerBase
    {
        private readonly ICalendrierRepository _IcalendrierRepository;
        public CalendriersController(ICalendrierRepository IcalendrierRepository)
        {
            _IcalendrierRepository = IcalendrierRepository;
        }
        // GET: api/<DirectionsController>
        [HttpGet]
        public async Task<IEnumerable<Calendsoc>> Get()
        {
            return await _IcalendrierRepository.GetAllAsync();
        }
        [HttpGet("get-callibs")]
        public async Task<Dictionary<string, string>> GetCalLibs()
        {
            return await _IcalendrierRepository.GetCalLibsAsync();
        }

        // GET api/<DirectionsController>/5
        [HttpGet("{id}")]
        public string Get(int id)
        {
            return "value";
        }

        // POST api/<DirectionsController>
        [HttpPost]
        public async Task Post([FromBody] Calendsoc calendrier)
        {
            try
            {
                await _IcalendrierRepository.AddAsync(calendrier);
            }
            catch (Exception)
            {
                throw;
            }
        }
        [HttpPost("clone/{soccod}/{annee}")]
        public async Task CloneCalendrier(string soccod,int annee)
        {
            try
            {
                await _IcalendrierRepository.CloneCalendrierAsync(soccod, annee);
                await _IcalendrierRepository.CloneLCalendrierAsync(soccod, annee);
            }
            catch (Exception)
            {
                throw;
            }
        }

        // PUT api/<DirectionsController>/5
        [HttpPut("{soccod}/{ordre}")]
        public IActionResult Put(int ordre, [FromBody] Calendsoc calendrier)
        {
            if (calendrier == null)
            {
                return BadRequest();
            }

            _IcalendrierRepository.UpdateAsync(calendrier);
            return NoContent();
        }

        // DELETE api/<DirectionsController>/5
        [HttpDelete("{ordre}")]
        public IActionResult Delete(int ordre)
        {
            //Lcategorie calendrier = _IcalendrierRepository.GetByNumOrdre(ordre);
            //if (calendrier == null)
            //{
            //    return NotFound();
            //}
            //_IcalendrierRepository.Delete(calendrier);
            return NoContent();
        }

    }
}
