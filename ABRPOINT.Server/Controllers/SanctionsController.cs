using ABRPOINT.Server.Annotations.AbsenceAttributes;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class SanctionsController : ControllerBase
    {
        private readonly ISanctionRepository _sanctionRepository;
        public SanctionsController(ISanctionRepository sanctionRepository)
        {
            _sanctionRepository = sanctionRepository;
        }
        // GET: api/<DirectionsController>
        [HttpGet("get-sanctions/{soccod}/{uticod}")]
        [CanGetSanction]
        public async Task<IActionResult> GetSanctions(string soccod, string uticod)
        {
            try
            {
                var sanction = await _sanctionRepository.GetSanctionWithAbsenceAsync(soccod,uticod);
                return Ok(new { message = "sanctions recupéré avec sucées", data = sanction });
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }
        [HttpGet("get-sanction/{soccod}/{concod}")]
        [CanGetSanction]
        public async Task<IActionResult> Get(string soccod,string concod)
        {
            try
            {
                var sanction = await _sanctionRepository.GetSanction(soccod,concod);
                return Ok(sanction);
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }


        // POST api/<DirectionsController>
        [HttpPost]
        [CanAddSanction]
        public IActionResult Post([FromBody] Sanction sanction)
        {
            if (string.IsNullOrEmpty(sanction.Concod))
                return BadRequest("Veuillez saisie les champs obligatoires");
            try
            {
                _sanctionRepository.Add(sanction);
                return Ok("ajout sanction avec succées");
            }
            catch (Exception)
            {

                return StatusCode(500);
            }
            
        }

        // PUT api/<DirectionsController>/5
        [HttpPut]
        [CanUpdateSanction]
        public IActionResult Put([FromBody] Sanction sanction)
        {
            if (sanction == null)
                return BadRequest("Veuillez saisie les champs obligatoires");
            try
            {
                _sanctionRepository.Update(sanction);
                return Ok("sanction modifiée avec sucées");
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
            
        }

        // DELETE api/<DirectionsController>/5
        [HttpDelete("{soccod}/{concod}")]
        [CanDeleteSanction]
        public async Task<IActionResult> Delete(string soccod, string concod)
        {
            if (string.IsNullOrWhiteSpace(concod))
                return BadRequest("Veuillez saisie les champs obligatoires");
            try
            {
                Sanction sanction = await _sanctionRepository.GetSanction(soccod, concod);
                if (sanction == null)
                {
                    return NotFound($"sanction avec cod {concod} non trouvée");
                }
                _sanctionRepository.Delete(sanction);
                return Ok("sanction supprimée avec succées");
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
           
        }
    }
}
