using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class CalendriersController : ControllerBase
    {
        private readonly ICalendrierRepository _IcalendrierRepository;
        public CalendriersController(ICalendrierRepository IcalendrierRepository)
        {
            _IcalendrierRepository = IcalendrierRepository;
        }
        // GET: api/<DirectionsController>
        [HttpGet]
        public IEnumerable<Calendsoc> Get()
        {
            return _IcalendrierRepository.GetAll();
        }
        [HttpGet("get-callibs")]
        public Dictionary<string, string> GetCalLibs()
        {
            return _IcalendrierRepository.GetCalLibs();
        }

        // GET api/<DirectionsController>/5
        [HttpGet("{id}")]
        public string Get(int id)
        {
            return "value";
        }

        // POST api/<DirectionsController>
        [HttpPost]
        public void Post([FromBody] Calendsoc calendrier)
        {
            _IcalendrierRepository.Add(calendrier);
        }
        [HttpPost("clone/{soccod}/{annee}")]
        public async Task CloneCalendrier(string soccod,int annee)
        {
            try
            {
                await _IcalendrierRepository.CloneCalendrier(soccod, annee);
                await _IcalendrierRepository.CloneLCalendrier(soccod, annee);
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

            _IcalendrierRepository.Update(calendrier);
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
