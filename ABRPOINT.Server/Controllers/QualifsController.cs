using ABRPOINT.Server.Data;
using ABRPOINT.Server.Helpers;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

// For more information on enabling Web API for empty projects, visit https://go.microsoft.com/fwlink/?LinkID=397860

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class QualifsController : ControllerBase
    {
        private readonly IQualifRepository _qualifRepository;
        private readonly ApplicationDbContext _db;

        public QualifsController(IQualifRepository qualifRepository, ApplicationDbContext db)
        {
            _qualifRepository = qualifRepository;
            _db = db;
        }

        // GET api/Qualifs/next-code/SOC01 — code séquentiel auto-généré pour ce soccod.
        [HttpGet("next-code/{soccod}")]
        public async Task<ActionResult<string>> NextCode(string soccod)
        {
            if (string.IsNullOrWhiteSpace(soccod))
                return BadRequest(new { message = "soccod requis." });
            var code = await SequentialCodeGenerator.NextQualifCodeAsync(_db, soccod);
            return Ok(new { code });
        }

        // GET: api/Qualifs/SOC01
        [HttpGet("{soccod}")]
        public async Task<IEnumerable<Qualif>> GetAll(string soccod)
        {
            return await _qualifRepository.GetAllAsync(soccod);
        }

        [HttpGet("get-qualibs/{soccod}")]
        public async Task<IActionResult> GetQualibs(string soccod)
        {
            try
            {
                if (string.IsNullOrEmpty(soccod))
                {
                    return BadRequest(new { message = "Le code société (soccod) est obligatoire" });
                }

                var qualibs = await _qualifRepository.GetQuaLibsAsync(soccod);
                return Ok(qualibs);
            }
            catch (InvalidOperationException ex)
            {
                return StatusCode(500, new { message = ex.Message, details = ex.InnerException?.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de la récupération des qualifications", details = ex.Message });
            }
        }

        // GET api/Qualifs/SOC01/Q01
        [HttpGet("{soccod}/{quacod}")]
        public async Task<ActionResult<Qualif>> Get(string soccod, string quacod)
        {
            var qualif = await _qualifRepository.GetByQuafcodAsync(soccod, quacod);
            if (qualif == null)
            {
                return NotFound(new { message = "Qualification introuvable" });
            }
            return Ok(qualif);
        }

        // POST api/Qualifs
        [HttpPost]
        public async Task<IActionResult> Post([FromBody] Qualif qualif)
        {
            try
            {
                if (qualif == null)
                    return BadRequest(new { message = "Données invalides" });

                // Auto-génération du code si non fourni — le frontend peut se contenter du libellé.
                if (string.IsNullOrWhiteSpace(qualif.Quacod) && !string.IsNullOrWhiteSpace(qualif.Soccod))
                {
                    qualif.Quacod = await SequentialCodeGenerator.NextQualifCodeAsync(_db, qualif.Soccod);
                }

                await _qualifRepository.AddAsync(qualif);
                return CreatedAtAction(nameof(Get), new { soccod = qualif.Soccod, quacod = qualif.Quacod }, qualif);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de l'ajout de la qualification", details = ex.Message });
            }
        }

        // PUT api/Qualifs/SOC01/Q01
        [HttpPut("{soccod}/{quacod}")]
        public async Task<IActionResult> Put(string soccod, string quacod, [FromBody] Qualif qualif)
        {
            if (qualif == null || quacod != qualif.Quacod)
            {
                return BadRequest();
            }

            await _qualifRepository.UpdateAsync(qualif);
            return NoContent();
        }

        // DELETE api/Qualifs/SOC01/Q01
        [HttpDelete("{soccod}/{quacod}")]
        public async Task<IActionResult> Delete(string soccod, string quacod)
        {
            try
            {
                var qualif = await _qualifRepository.GetByQuafcodAsync(soccod, quacod);
                if (qualif == null)
                {
                    return NotFound(new { message = "Qualification introuvable" });
                }
                await _qualifRepository.DeleteAsync(qualif);
                return Ok(new { message = "Qualification supprimée avec succès" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de la suppression de la qualification", details = ex.Message });
            }
        }
    }
}
