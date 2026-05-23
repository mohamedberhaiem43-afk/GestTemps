using ABRPOINT.Server.Annotations.SocieteAttributes;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using ABRPOINT.Server.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Linq;
using System.Threading.Tasks;

namespace ABRPOINT.Server.Controllers
{
    // SEC-11 — `[Authorize]` au niveau de la classe : avant, les GET étaient ouverts
    // anonymement, ce qui permettait l'énumération des sociétés et de leurs paramètres.
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
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
                // SEC-19 — Pas de fuite ex.Message vers le client.
                Console.Error.WriteLine($"[Societes.GetSoclibs] {ex}");
                return StatusCode(500, new { message = "Erreur lors de la récupération des sociétés." });
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
        [CanAddSociete]
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
                // SEC-19 — Pas de fuite ex.Message vers le client.
                Console.Error.WriteLine($"[Societes.Post] {ex}");
                return StatusCode(500, new { message = "Erreur lors de la création de la société." });
            }
        }


        // PUT api/Services/5
        [Authorize]
        [CanUpdateSociete]
        [HttpPut]
        public async Task<IActionResult> Put([FromBody] Societe societe)
        {
            if (societe == null)
                return BadRequest("Données invalides.");

            // Plan gating « Custom Branding » : seul Business permet de personnaliser
            // le logo (champ Socimg) — cf. PlanFeatures.CustomBranding. On ne bloque
            // PAS l'ensemble du Put pour les autres packs (l'admin doit pouvoir éditer
            // l'adresse, le nom, etc.) : on compare l'image soumise à celle en base et
            // on refuse uniquement si elle CHANGE sur un pack non éligible. NULL → NULL
            // (suppression de logo) reste autorisé pour permettre un rollback propre.
            var planAllowsBranding = PlanCatalog.GetPlan(_currentTenant.Current?.PlanCode)
                ?.Features.CustomBranding ?? false;
            // En essai gratuit, le frontend déverrouille toutes les features pour test —
            // on aligne le comportement back en utilisant TrialPolicy.IsTrialing.
            var inTrial = TrialPolicy.IsTrialing(_currentTenant.Current);
            if (!planAllowsBranding && !inTrial && !string.IsNullOrWhiteSpace(societe.Socimg))
            {
                var existing = await _societeRepository.GetBySoccodAsync(societe.Soccod ?? string.Empty);
                var currentImg = existing?.Socimg;
                var changed = !string.Equals(currentImg ?? string.Empty, societe.Socimg ?? string.Empty, System.StringComparison.Ordinal);
                if (changed)
                {
                    return StatusCode(402, new
                    {
                        code = "plan_feature_locked",
                        feature = "CustomBranding",
                        message = "La personnalisation du logo est réservée au pack Business. Passez au pack supérieur pour utiliser cette fonctionnalité."
                    });
                }
            }

            await _societeRepository.UpdateAsync(societe);


            return Ok($"Société avec le code '{societe.Soccod}' mise à jour avec succée.");
        }

        // DELETE api/Services/{seccod}
        [Authorize]
        [CanDeleteSociete]
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
