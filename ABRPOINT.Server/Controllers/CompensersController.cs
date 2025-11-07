using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class CompensersController : ControllerBase
    {
        private readonly IcompenserRepository _compenserRepository;
        public CompensersController(IcompenserRepository compenserRepository)
        {
            _compenserRepository = compenserRepository;
        }
        // GET: api/<DirectionsController>
        [HttpGet("{soccod}")]
        public async Task<IActionResult> Get(string soccod)
        {
            if (string.IsNullOrEmpty(soccod))
                return BadRequest("Veuillez donner le code société");
            try
            {
                var result = await _compenserRepository.GetCompenserWithAbsenceAsync(soccod);
                return Ok(result);
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
            
        }


        // POST api/<DirectionsController>
        [HttpPost]
        public IActionResult Post([FromBody] Compenser compenser)
        {
            if (compenser == null)
                return BadRequest("Veuillez saisie les champs obligatoires");
            try
            {
                _compenserRepository.Add(compenser);
                return Ok("ajout avec sucées");
            }
            catch (Exception)
            {

                return StatusCode(500);
            }
            
        }

        // PUT api/<DirectionsController>/5
        [HttpPut]
        public IActionResult Put([FromBody] Compenser compenser)
        {
            if (compenser == null || string.IsNullOrEmpty(compenser.Concod))
                return BadRequest("Veuillez saisir les champs obligatoires");
            try
            {
                _compenserRepository.Update(compenser);
                return Ok("Compensation modifiée avec succées");
            }
            catch (Exception ex)
            {
                return StatusCode(500);
            }

            
        }

        // DELETE api/<DirectionsController>/5
        [HttpDelete("{soccod}/{concod}")]
        public IActionResult Delete(string soccod,string concod)
        {
            Compenser compenser = _compenserRepository.GetByNumOrdre(soccod,concod);
            if (compenser == null)
            {
                return NotFound();
            }
            _compenserRepository.Delete(compenser);
            return NoContent();
        }
    }
}
