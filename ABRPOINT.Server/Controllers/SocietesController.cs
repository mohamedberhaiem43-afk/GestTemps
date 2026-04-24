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
    public class SocietesController : ControllerBase
    {
        private readonly ISocieteRepository _societeRepository;

        public SocietesController(ISocieteRepository societeRepository)
        {
            _societeRepository = societeRepository;
        }

        // GET: api/Services
        [HttpGet]
        public async Task<IEnumerable<Societe>> Get()
        {
            return await _societeRepository.GetAllAsync();
        }
        [HttpGet("get-soclibs")]
        public async Task<IActionResult> GetSoclibs()
        {
            try
            {
                var societes = await _societeRepository.GetSoclibsAsync();
                return Ok(societes);
            }
            catch (Exception ex)
            {
                return StatusCode(500, "probléme de récuperation sociétés" + ex);
            }
        }
        
        [HttpGet("get-socheures/{soccod}")]
        public async Task<SocHeures> GetSocHeures(string soccod)
        {
            try
            {
                SocHeures socHeures = await _societeRepository.GetSocHeuresAsync(soccod);
                return socHeures;
            }
            catch (Exception ex)
            {
                return null;
            }
        }
        [HttpPut("update-socheures/{soccod}")]
        public async Task<bool> UpdateSocHeures(
          string soccod,
          [FromBody] SocHeures dto)
        {
            return await _societeRepository.UpdateSocHeuresAsync(
                soccod,
                dto.Socpresence,
                dto.Sochsup
            );
        }


        // GET api/Services/5
        [HttpGet("{soccod}")]
        public async Task<ActionResult<Societe>> Get(string soccod)
        {
            var service = await _societeRepository.GetBySoccodAsync(soccod);
            if (service == null)
            {
                return NotFound();
            }
            return Ok(service);
        }

        // POST api/Services
        [Authorize]
        [HttpPost]
        public async Task<IActionResult> Post([FromBody] Societe societe)
        {
            if (societe == null)
            {
                return BadRequest();
            }

            try
            {
                await _societeRepository.AddAsync(societe);
                return CreatedAtAction(nameof(Get), new { id = societe.Soccod }, societe);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }


        // PUT api/Services/5
        [Authorize]
        [HttpPut]
        public async Task<IActionResult> Put([FromBody] Societe societe)
        {
            if (societe == null)
                return BadRequest("Données invalides.");

            await _societeRepository.UpdateAsync(societe);

            
            return Ok($"Société avec le code '{societe.Soccod}' mise à jour avec succée.");
        }

        // DELETE api/Services/{seccod}
        [Authorize]
        [HttpDelete("{soccod}")]
        public async Task<IActionResult> Delete(string soccod)
        {
            var section = await _societeRepository.GetBySoccodAsync(soccod);
            if (section == null)
            {
                return NotFound();
            }
            await _societeRepository.DeleteAsync(section);
            return NoContent();
        }
    }
}
