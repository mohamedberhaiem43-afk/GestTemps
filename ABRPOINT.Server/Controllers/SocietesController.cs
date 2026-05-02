using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using ABRPOINT.Server.Tenancy;
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
        private readonly ICurrentTenant _currentTenant;

        public SocietesController(ISocieteRepository societeRepository, ICurrentTenant currentTenant)
        {
            _societeRepository = societeRepository;
            _currentTenant = currentTenant;
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

            // Quota plan : essai gratuit, Essentiel et Standard sont mono-société. Premium = illimité.
            var limits = TrialPolicy.GetLimits(_currentTenant.Current);
            if (limits.MaxSocietes.HasValue)
            {
                var existing = (await _societeRepository.GetAllAsync()).Count();
                if (existing >= limits.MaxSocietes.Value)
                {
                    var planLabel = TrialPolicy.IsTrialing(_currentTenant.Current)
                        ? "l'essai gratuit"
                        : $"votre plan {_currentTenant.Current?.PlanCode}";
                    return StatusCode(402, new
                    {
                        code = "plan_limit_societes",
                        message = $"Limite de {planLabel} atteinte ({limits.MaxSocietes.Value} société maximum). Passez au plan Premium pour gérer plusieurs sociétés."
                    });
                }
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
