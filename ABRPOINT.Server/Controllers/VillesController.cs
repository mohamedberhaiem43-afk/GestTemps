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

        // GET: api/Villes
        [HttpGet]
        public async Task<IActionResult> Get()
        {
            try
            {
                var villes = await _villeRepository.GetAllAsync();
                return Ok(villes);
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        [HttpGet("get-villibs")]
        public async Task<IActionResult> GetVillibs()
        {
            try
            {
                var villes = await _villeRepository.GetVillibsAsync();
                return Ok(villes);
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        // GET api/Villes/01
        [HttpGet("{vilcod}")]
        public async Task<ActionResult<Ville>> Get(string vilcod)
        {
            var ville = await _villeRepository.GetByVilcodAsync(vilcod);
            if (ville == null)
            {
                return NotFound();
            }
            return Ok(ville);
        }

        // POST api/Villes
        [HttpPost]
        public async Task<IActionResult> Post([FromBody] Ville ville)
        {
            if (ville != null)
            {
                await _villeRepository.AddAsync(ville);
                return CreatedAtAction(nameof(Get), new { vilcod = ville.Vilcod }, ville);
            }
            return BadRequest();
        }

        // PUT api/Villes/01
        [HttpPut("{vilcod}")]
        public async Task<IActionResult> Put(string vilcod, [FromBody] Ville ville)
        {
            if (ville == null || vilcod != ville.Vilcod)
            {
                return BadRequest();
            }

            await _villeRepository.UpdateAsync(ville);
            return NoContent();
        }

        // DELETE api/Villes/01
        [HttpDelete("{vilcod}")]
        public async Task<IActionResult> Delete(string vilcod)
        {
            var ville = await _villeRepository.GetByVilcodAsync(vilcod);
            if (ville == null)
            {
                return NotFound();
            }
            await _villeRepository.DeleteAsync(ville);
            return NoContent();
        }
    }
}
