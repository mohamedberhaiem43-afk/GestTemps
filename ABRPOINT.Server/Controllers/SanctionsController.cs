using ABRPOINT.Server.Annotations.AbsenceAttributes;
using ABRPOINT.Server.Dtaos;
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
                var sanction = await _sanctionRepository.GetSanctionAsync(soccod,concod);
                return Ok(sanction);
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }
        [HttpGet("get-date-sanction/{soccod}/{date}/{empcod}")]
        [CanGetSanction]
        public async Task<Sanction?> GetSanctionDate(string soccod,DateTime? date,string empcod)
        {
            try
            {
                Sanction? sanction = await _sanctionRepository.GetSanctionDateAsync(soccod,date,empcod);
                return sanction;
            }
            catch (Exception)
            {
                return null;
            }
        }


        // POST api/<DirectionsController>
        [HttpPost]
        [CanAddSanction]
        public async Task<IActionResult> Post([FromBody] Sanction sanction)
        {
            if (string.IsNullOrEmpty(sanction.Concod) || string.IsNullOrEmpty(sanction.Consanc))
                return BadRequest("Veuillez saisie les champs obligatoires");
            try
            {
                await _sanctionRepository.AddAsync(sanction);
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
        public async Task<IActionResult> Put([FromBody] Sanction sanction)
        {
            if (sanction == null)
                return BadRequest("Veuillez saisie les champs obligatoires");
            try
            {
                await _sanctionRepository.UpdateAsync(sanction);
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
                Sanction? sanction = await _sanctionRepository.GetSanctionAsync(soccod, concod);
                if (sanction == null)
                {
                    return NotFound($"sanction avec cod {concod} non enregistrée");
                }
                await _sanctionRepository.DeleteAsync(sanction);
                return Ok("sanction supprimée avec succées");
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
           
        }
    }
}
