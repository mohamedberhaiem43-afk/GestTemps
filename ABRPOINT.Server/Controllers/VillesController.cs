using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

// For more information on enabling Web API for empty projects, visit https://go.microsoft.com/fwlink/?LinkID=397860

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class VillesController : ControllerBase
    {
        private readonly IVilleRepository _villeRepository;

        public VillesController(IVilleRepository villeRepository)
        {
            _villeRepository = villeRepository;
        }

        // GET: api/Services
        [HttpGet]
        public IActionResult Get()
        {
            try
            {
                return Ok(_villeRepository.GetAll());
            }
            catch (Exception)
            {

                return StatusCode(500);
            }
            
        }
        [HttpGet("get-villibs")]
        public IActionResult GetVillibs()
        {
            try
            {
                Dictionary<string,string> villes = _villeRepository.GetVillibs();
                return Ok(villes);
            }
            catch (Exception)
            {

                return StatusCode(500);
            }
            
        }

        // GET api/Services/5
        [HttpGet("{vilcod}")]
        public ActionResult<Ville> Get( string vilcod)
        {
            var ville = _villeRepository.GetByVilcod( vilcod);
            if (ville == null)
            {
                return NotFound();
            }
            return Ok(ville);
        }

        // POST api/Services
        [HttpPost]
        public IActionResult Post([FromBody] Ville ville)
        {
            if (ville != null)
            {
                _villeRepository.Add(ville);
                return CreatedAtAction(nameof(Get), new { vilcod = ville.Vilcod }, ville);
            }
            return BadRequest();
        }

        // PUT api/Services/5
        [HttpPut("{vilcod}")]
        public IActionResult Put(string vilcod, [FromBody] Ville ville)
        {
            if (ville == null || vilcod != ville.Vilcod)
            {
                return BadRequest();
            }

            _villeRepository.Update(ville);
            return NoContent();
        }

        // DELETE api/Services/{seccod}
        [HttpDelete("{vilcod}")]

        public IActionResult Delete(string vilcod)
        {
            Ville ville = _villeRepository.GetByVilcod(vilcod);
            if (ville == null)
            {
                return NotFound();
            }
            _villeRepository.Delete(ville);
            return NoContent();
        }

    }
}
