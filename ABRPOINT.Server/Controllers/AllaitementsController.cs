using ABRPOINT.Server.Annotations.AllaitementAttributes;
using ABRPOINT.Server.Authorization;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    // SEC AI : ValidateSoccod manquait — rapport allaitement (donnée médicale) accessible
    // cross-soccod via énumération empcod.
    [ValidateSoccod]
    public class AllaitementsController : ControllerBase
    {
        private readonly IAllaitementRepository _allaitementRepository;
        public AllaitementsController(IAllaitementRepository allaitementRepository)
        {
            _allaitementRepository = allaitementRepository;
        }

        // GET: api/Allaitements/get-allaitements/SOC01/admin
        [HttpGet("get-allaitements/{soccod}/{uticod}")]
        [CanGetAllaitement]
        public async Task<ActionResult<IEnumerable<AllaitementDto>>> GetAllaitements(string soccod, string uticod)
        {
            try
            {
                var allaitements = await _allaitementRepository.GetAllAsync(soccod, uticod);
                return Ok(allaitements);
            }
            catch (Exception ex)
            {
                return StatusCode(500, "Erreur interne. Consultez les logs serveur pour le détail.");
            }
        }

        [HttpGet("get-next-concod/{soccod}")]
        public async Task<ActionResult> GetNextConcod(string soccod)
        {
            var concod = await _allaitementRepository.GetNextConcodAsync(soccod);
            return Ok(new { concod });
        }

        [HttpGet("{soccod}/{concod}")]
        [CanGetAllaitement]
        public async Task<ActionResult<Allaitement>> Get(string soccod, string concod)
        {
            var allaitement = await _allaitementRepository.GetAsync(soccod, concod);
            if (allaitement == null) return NotFound();
            return Ok(allaitement);
        }

        [HttpPost]
        [CanAddAllaitement]
        public async Task<IActionResult> Post([FromBody] Allaitement allaitement)
        {
            try
            {
                if (allaitement == null) return BadRequest();
                await _allaitementRepository.AddAsync(allaitement);
                return Ok(new { message = "Allaitement ajouté avec succès" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de l'ajout d'allaitement ", details = "Erreur interne. Consultez les logs serveur pour le détail." });
            }
        }

        [HttpPut]
        [CanUpdateAllaitement]
        public async Task<IActionResult> Put([FromBody] Allaitement allaitement)
        {
            try
            {
                if (allaitement == null) return BadRequest();
                await _allaitementRepository.UpdateAsync(allaitement);
                return Ok(new { message = "Allaitement modifié avec succès" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de modification d'allaitement ", details = "Erreur interne. Consultez les logs serveur pour le détail." });
            }
        }

        [HttpDelete("{soccod}/{concod}")]
        [CanDeleteAllaitement]
        public async Task<IActionResult> Delete(string soccod, string concod)
        {
            if (string.IsNullOrWhiteSpace(soccod) || string.IsNullOrWhiteSpace(concod))
                return BadRequest("Veuillez remplir les champs obligatoires");
            try
            {
                var allaitement = await _allaitementRepository.GetByEmpcodAsync(soccod, concod);
                if (allaitement == null)
                    return NotFound("Allaitement non trouvé");

                await _allaitementRepository.DeleteAsync(allaitement);
                return Ok("Allaitement supprimé avec succès");
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        [HttpGet("get-report/{soccod}/{empcod}/{concod}")]
        public IActionResult GetReport(string soccod, string empcod, string concod)
        {
            try
            {
                var repo = HttpContext.RequestServices.GetRequiredService<IReportsGenerationService>();
                var pdf = repo.GenerateAllaitementReport(soccod, empcod, concod);
                return File(pdf, "application/pdf", $"Allaitement_{empcod}.pdf");
            }
            catch (Exception ex)
            {
                return StatusCode(500, "Erreur interne. Consultez les logs serveur pour le détail.");
            }
        }
    }
}
