using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;

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
        public async Task<IActionResult> Post([FromBody] Compenser compenser)
        {
            if (compenser == null)
                return BadRequest("Veuillez saisie les champs obligatoires");
            try
            {
                await _compenserRepository.AddAsync(compenser);
                return Ok("ajout avec sucées");
            }
            catch (Exception)
            {

                return StatusCode(500);
            }
            
        }

        // PUT api/<DirectionsController>/5
        [HttpPut]
        public async Task<IActionResult> Put([FromBody] Compenser compenser)
        {
            if (compenser == null || string.IsNullOrEmpty(compenser.Concod))
                return BadRequest("Veuillez saisir les champs obligatoires");
            try
            {
                await _compenserRepository.UpdateAsync(compenser);
                return Ok("Compensation modifiée avec succées");
            }
            catch (Exception ex)
            {
                return StatusCode(500);
            }

            
        }

        // DELETE api/<DirectionsController>/5
        [HttpDelete("{soccod}/{concod}")]
        public async Task<IActionResult> Delete(string soccod,string concod)
        {
            Compenser compenser = await _compenserRepository.GetByNumOrdreAsync(soccod,concod);
            if (compenser == null)
            {
                return NotFound();
            }
            await _compenserRepository.DeleteAsync(compenser);
            return NoContent();
        }
    }
}
