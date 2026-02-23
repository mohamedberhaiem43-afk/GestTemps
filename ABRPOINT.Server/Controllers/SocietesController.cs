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
        public IEnumerable<Societe> Get()
        {
            return _societeRepository.GetAll();
        }
        [HttpGet("get-soclibs")]
        public async Task<IActionResult> GetSoclibs()
        {
            try
            {
                return Ok(await _societeRepository.GetSoclibs());
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
                SocHeures socHeures = await _societeRepository.GetSocHeures(soccod);
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
            return await _societeRepository.UpdateSocHeures(
                soccod,
                dto.Socpresence,
                dto.Sochsup
            );
        }


        // GET api/Services/5
        [HttpGet("{soccod}")]
        public ActionResult<Societe> Get(string soccod)
        {
            var service = _societeRepository.GetBySoccod(soccod);
            if (service == null)
            {
                return NotFound();
            }
            return Ok(service);
        }

        // POST api/Services
        [Authorize]
        [HttpPost]
        public IActionResult Post([FromBody] Societe societe)
        {
            if (societe == null)
            {
                return BadRequest();
            }

            try
            {
                _societeRepository.Add(societe);
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

            bool result = await _societeRepository.UpdateAsync(societe);

            if (!result)
                return NotFound($"Société avec le code '{societe.Soccod}' introuvable.");

            return NoContent();
        }

        // DELETE api/Services/{seccod}
        [Authorize]
        [HttpDelete("{soccod}")]
        public IActionResult Delete(string soccod)
        {
            var section = _societeRepository.GetBySoccod(soccod);
            if (section == null)
            {
                return NotFound();
            }
            _societeRepository.Delete(section);
            return NoContent();
        }
    }
}
