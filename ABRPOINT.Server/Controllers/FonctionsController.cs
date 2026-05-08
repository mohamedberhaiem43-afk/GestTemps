using ABRPOINT.Server.Authorization;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Helpers;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    // SEC AI : ValidateSoccod manquait — fonctions/postes éditables cross-soccod.
    [ValidateSoccod]
    public class FonctionsController : ControllerBase
    {
        private readonly IFonctionRepository _fonctionRepository;
        private readonly ApplicationDbContext _db;
        public FonctionsController(IFonctionRepository fonctionRepository, ApplicationDbContext db)
        {
            _fonctionRepository = fonctionRepository;
            _db = db;
        }

        // GET api/Fonctions/next-code/SOC01 — code séquentiel auto-généré pour ce soccod.
        [HttpGet("next-code/{soccod}")]
        public async Task<IActionResult> NextCode(string soccod)
        {
            var code = await SequentialCodeGenerator.NextFonctionCodeAsync(_db, soccod);
            return Ok(new { code });
        }

        // GET: api/Fonctions/SOC01
        [HttpGet("{soccod}")]
        public async Task<ActionResult<IEnumerable<Fonction>>> Get(string soccod)
        {
            try
            {
                var fonctions = await _fonctionRepository.GetAllAsync(soccod);
                return Ok(fonctions);
            }
            catch (Exception)
            {
                return StatusCode(500, "Internal server error");
            }
        }

        [HttpGet("get-fonlibs")]
        public async Task<Dictionary<string, string>> GetFonlibs()
        {
            return await _fonctionRepository.GetFonLibsAsync();
        }

        [HttpGet("get-fonlibs/{soccod}")]
        public async Task<Dictionary<string, string>> GetFonlibsBySoccod(string soccod)
        {
            return await _fonctionRepository.GetFonLibsBySoccodAsync(soccod);
        }

        // POST api/Fonctions
        [HttpPost]
        public async Task<IActionResult> Post([FromBody] Fonction fonction)
        {
            try
            {
                if (fonction == null) return BadRequest();
                if (string.IsNullOrWhiteSpace(fonction.Foncod) && !string.IsNullOrWhiteSpace(fonction.Soccod))
                {
                    fonction.Foncod = await SequentialCodeGenerator.NextFonctionCodeAsync(_db, fonction.Soccod);
                }
                await _fonctionRepository.AddAsync(fonction);
                return Ok(fonction);
            }
            catch (Exception)
            {
                return StatusCode(500, "Error adding function");
            }
        }

        // PUT api/Fonctions/SOC01/F01
        [HttpPut("{soccod}/{foncod}")]
        public async Task<IActionResult> Put(string soccod, string foncod, [FromBody] Fonction fonction)
        {
            if (fonction == null || foncod != fonction.Foncod)
            {
                return BadRequest();
            }

            await _fonctionRepository.UpdateAsync(fonction);
            return NoContent();
        }

        // DELETE api/Fonctions/SOC01/F01
        [HttpDelete("{soccod}/{foncod}")]
        public async Task<IActionResult> Delete(string soccod, string foncod)
        {
            var fonction = await _fonctionRepository.GetByFonccodAsync(soccod, foncod);
            if (fonction == null)
            {
                return NotFound();
            }
            await _fonctionRepository.DeleteAsync(fonction);
            return NoContent();
        }
    }
}
