using ABRPOINT.Server.Authorization;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Helpers;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    // SEC AI : aucun [Authorize] → CRUD complet sur les rubriques de paie ouvert sans
    // authentification. Hardening : auth + soccod scopé (route ET body via SoccodAccess pour
    // les opérations Add/Update qui prennent Soccod dans la rubrique).
    [Authorize]
    [ValidateSoccod]
    public class RubriquesController : ControllerBase
    {
        private readonly IRubriqueService _rubriqueService;
        private readonly ApplicationDbContext _db;
        private readonly IMemoryCache _cache;
        public RubriquesController(IRubriqueService rubriqueService, ApplicationDbContext db, IMemoryCache cache)
        {
            _rubriqueService = rubriqueService;
            _db = db;
            _cache = cache;
        }

        // Soccod arrive dans le body sur Add/Update — ValidateSoccod ne peut pas l'attraper, donc check inline.
        private async Task<bool> CanAccessSoccodAsync(string? soccod) =>
            !string.IsNullOrEmpty(soccod) && await SoccodAccess.IsAllowedAsync(HttpContext, _db, _cache, soccod);

        // GET api/Rubriques/next-code/SOC01 — code séquentiel auto-généré pour ce soccod.
        [HttpGet("next-code/{soccod}")]
        public async Task<ActionResult<string>> NextCode(string soccod)
        {
            if (string.IsNullOrWhiteSpace(soccod))
                return BadRequest(new { message = "soccod requis." });
            var code = await SequentialCodeGenerator.NextRubcodAsync(_db, soccod);
            return Ok(new { code });
        }

        [HttpGet("{soccod}")]
        public async Task<IEnumerable<RubriqueDto>> Get(string soccod)
        {
            try
            {
                return await _rubriqueService.GetAllAsync(soccod);
            }
            catch (Exception)
            {

                throw;
            }
        }
        [HttpGet("get-paires/{soccod}")]
        public async Task<IEnumerable<RubriquePaireDto>> GetPaires(string soccod)
        {
            try
            {
                return await _rubriqueService.GetPairesAsync(soccod);
            }
            catch (Exception)
            {

                throw;
            }
        }
        [HttpGet("get-rubrique/{soccod}/{rubcod}")]
        public async Task<Rubrique> GetRubrique(string soccod,string rubcod)
        {
            try
            {
                return await _rubriqueService.GetRubriqueAsync(soccod, rubcod);
            }
            catch (Exception)
            {
                throw;
            }
        }
        [HttpDelete("{soccod}/{rubocd}")]
        public async Task<string> DeleteRubrique(string soccod,string rubocd)
        {
            try
            {
                await _rubriqueService.DeleteAsync(soccod,rubocd);
                return "rubrique supprimée avec succées";
            }
            catch (Exception)
            {

                throw;
            }
        }
        [HttpPost]
        public async Task<IActionResult> AddRubrique(Rubrique rubrique)
        {
            if (rubrique == null || string.IsNullOrWhiteSpace(rubrique.Soccod))
                return BadRequest(new { message = "Soccod requis." });
            if (!await CanAccessSoccodAsync(rubrique.Soccod)) return Forbid();
            try
            {
                // Auto-génération du code si non fourni — le frontend peut se contenter du libellé.
                if (string.IsNullOrWhiteSpace(rubrique.Rubcod))
                {
                    rubrique.Rubcod = await SequentialCodeGenerator.NextRubcodAsync(_db, rubrique.Soccod);
                }
                var ok = await _rubriqueService.AddRubriqueAsync(rubrique);
                return Ok(ok);
            }
            catch (Exception)
            {
                throw;
            }
        }

        [HttpPut]
        public async Task<IActionResult> UpdatRubrique(Rubrique rubrique)
        {
            if (rubrique == null || string.IsNullOrWhiteSpace(rubrique.Soccod))
                return BadRequest(new { message = "Soccod requis." });
            if (!await CanAccessSoccodAsync(rubrique.Soccod)) return Forbid();
            try
            {
                var ok = await _rubriqueService.UpdateRubriqueAsync(rubrique);
                return Ok(ok);
            }
            catch (Exception)
            {
                throw;
            }
        }
    
    }
}
