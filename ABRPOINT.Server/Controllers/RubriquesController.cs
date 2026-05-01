using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Helpers;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Mvc;

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class RubriquesController : ControllerBase
    {
        private readonly IRubriqueService _rubriqueService;
        private readonly ApplicationDbContext _db;
        public RubriquesController(IRubriqueService rubriqueService, ApplicationDbContext db)
        {
            _rubriqueService = rubriqueService;
            _db = db;
        }

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
        public async Task<bool> AddRubrique(Rubrique rubrique)
        {
            try
            {
                // Auto-génération du code si non fourni — le frontend peut se contenter du libellé.
                if (rubrique != null && string.IsNullOrWhiteSpace(rubrique.Rubcod) && !string.IsNullOrWhiteSpace(rubrique.Soccod))
                {
                    rubrique.Rubcod = await SequentialCodeGenerator.NextRubcodAsync(_db, rubrique.Soccod);
                }
                return await _rubriqueService.AddRubriqueAsync(rubrique);
            }
            catch (Exception)
            {
                throw;
            }
        }
    
        [HttpPut]
        public async Task<bool> UpdatRubrique(Rubrique rubrique)
        {
            try
            {
                return await _rubriqueService.UpdateRubriqueAsync(rubrique);
            }
            catch (Exception)
            {
                throw;
            }
        }
    
    }
}
