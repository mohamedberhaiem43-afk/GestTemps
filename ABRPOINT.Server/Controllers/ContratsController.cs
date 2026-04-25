using ABRPOINT.Server.Annotations.ContratAttributes;
using ABRPOINT.Server.Annotations.EtatsAttributes;
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
    public class ContratsController : ControllerBase
    {
        private readonly IContratRepository _contratRepository;
        private readonly IReportsGenerationService _reportsGenerationService;

        public ContratsController(IContratRepository contratRepository, IReportsGenerationService reportsGenerationService)
        {
            _contratRepository = contratRepository;
            _reportsGenerationService = reportsGenerationService;
        }

        [HttpGet("{soccod}/{srvcod}/{sitcod}/{echdeb}/{echfin}")]
        [CanGetContrat]
        public async Task<IActionResult> Get(string soccod, string srvcod, string sitcod, DateTime echdeb, DateTime echfin)
        {
            try
            {
                IEnumerable<Contrat> contrats = await _contratRepository.GetAllSearchAsync(soccod, srvcod, sitcod, echdeb, echfin);
                return Ok(contrats);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de recuperer les contrats", details = ex.Message });
            }
        }

        [HttpGet("{soccod}/{uticod}/{echdeb}/{echfin}")]
        [CanGetContrat]
        public async Task<IActionResult> Get(string soccod, string uticod, DateTime echdeb, DateTime echfin)
        {
            try
            {
                IEnumerable<Contrat> contrats = await _contratRepository.GetAllByUticodPeriodAsync(soccod, uticod, echdeb, echfin);
                return Ok(contrats);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de recuperer des contrats", details = ex.Message });
            }
        }

        [HttpGet("get-echeance/{soccod}/{echdeb}/{echfin}/{uticod}")]
        [CanGetEcheanceContrat]
        public async Task<IActionResult> GetEcheanceContrat(string soccod, DateTime echdeb, DateTime echfin, string uticod)
        {
            try
            {
                List<EcheanceContrat> contrats = await _contratRepository.GetEcheanceContratsByDate(soccod, echdeb, echfin, uticod);
                return Ok(contrats);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de recuperer des contrats", details = ex.Message });
            }
        }

        [HttpGet("get-echeance-contrat-report/{soccod}/{echdeb}/{echfin}")]
        [CanGetEcheanceContrat]
        public IActionResult GetEcheanceContratReport(string soccod, DateTime echdeb, DateTime echfin)
        {
            try
            {
                byte[] pdfBytes = _reportsGenerationService.GenerateEcheanceContratReport(soccod, echdeb, echfin);
                return File(pdfBytes, "application/pdf", "EcheanceContrat.pdf");
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de recuperer des contrats", details = ex.Message });
            }
        }

        [HttpGet("get-contrat-report/{soccod}/{empcod}")]
        public IActionResult GetContratReport(string soccod, string empcod)
        {
            try
            {
                byte[] pdfBytes = _reportsGenerationService.GenerateContratReport(soccod, empcod);
                return File(pdfBytes, "application/pdf", "Contrat.pdf");
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de recuperer des contrats", details = ex.Message });
            }
        }

        [HttpGet("{soccod}/{uticod}")]
        [CanGetContrat]
        public async Task<IActionResult> Get(string soccod, string uticod)
        {
            try
            {
                IEnumerable<Contrat> contrats = await _contratRepository.GetAllByUticodAsync(soccod, uticod);
                return Ok(contrats);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de recuperer des contrats", details = ex.Message });
            }
        }

        [HttpGet("search")]
        [CanGetContrat]
        public async Task<IActionResult> Search(
            [FromQuery] string soccod,
            [FromQuery] string uticod,
            [FromQuery] string? srvcod,
            [FromQuery] string? sitcod,
            [FromQuery] DateTime? echdeb,
            [FromQuery] DateTime? echfin)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(soccod) || string.IsNullOrWhiteSpace(uticod))
                    return BadRequest(new { message = "Les parametres soccod et uticod sont obligatoires." });

                IEnumerable<Contrat> contrats = await _contratRepository.SearchAsync(soccod, uticod, srvcod, sitcod, echdeb, echfin);
                return Ok(contrats);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de recuperer des contrats", details = ex.Message });
            }
        }
        [HttpGet("get-list-echeance/{soccod}/{uticod}")]
        [CanGetEcheanceContrat]
        public IActionResult GetEcheanceContrats(string soccod, string uticod)
        {
            try
            {
                return Ok(_contratRepository.GetEcheanceContrats(soccod, uticod));
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de recuperer les contrats", details = ex.Message });
            }
        }

        [HttpPost]
        [CanAddContrat]
        public async Task<IActionResult> Add(Contrat contrat)
        {
            try
            {
                Contrat dbcontrat = await _contratRepository.GetByConcod(contrat.Soccod, contrat.Concod);
                if (dbcontrat == null)
                    await _contratRepository.AddAsync(contrat);
                else
                    await Put(contrat);

                return Ok(new { message = "Contrat ajoute avec succes" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de l'ajout du contrat", details = ex.Message });
            }
        }

        [HttpPost("renew")]
        [CanAddContrat]
        public async Task<IActionResult> Renew([FromBody] RenouvellementContratDto renouvellement)
        {
            try
            {
                if (!ModelState.IsValid)
                    return BadRequest(ModelState);

                Contrat renewedContract = await _contratRepository.RenewAsync(renouvellement);
                return Ok(new
                {
                    message = "Contrat renouvele avec succes",
                    contrat = renewedContract
                });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors du renouvellement du contrat", details = ex.Message });
            }
        }

        [HttpPut]
        [CanUpdateContrat]
        public async Task<IActionResult> Put([FromBody] Contrat contrat)
        {
            try
            {
                if (contrat == null)
                    return BadRequest();

                await _contratRepository.UpdateAsync(contrat);
                return NoContent();
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de modification du contrat", details = ex.Message });
            }
        }

        [HttpGet("expiring/{soccod}/{uticod}")]
        public async Task<IActionResult> GetExpiringContracts(string soccod,string uticod)
        {
            try
            {
                var now = DateTime.Now;
                var monthStart = new DateTime(now.Year, now.Month, 1);
                var monthEnd = monthStart.AddMonths(1).AddDays(-1);

                var allContrats = await _contratRepository.GetAllByUticodAsync(soccod,uticod);
                var expiring = allContrats
                    .Where(c => c.Empsort.HasValue && c.Empsort.Value >= monthStart && c.Empsort.Value <= monthEnd)
                    .Select(c => new {
                        c.Soccod, c.Concod, c.Empcod, c.Empsort, c.Contype, c.Empemb,
                        Emplib = c.Empcod
                    })
                    .ToList();

                return Ok(expiring);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de recuperer les contrats qui expirent", details = ex.Message });
            }
        }

        [HttpGet("get-next-concod/{soccod}")]
        public async Task<IActionResult> GetNextConcod(string soccod)
        {
            try
            {
                var nextConcod = await _contratRepository.GetNextConcodAsync(soccod);
                return Ok(new { concod = nextConcod });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de la génération du numéro de contrat", details = ex.Message });
            }
        }

        [HttpDelete("{soccod}/{concod}")]
        [CanDeleteContrat]
        public async Task<IActionResult> Delete(string soccod, string concod)
        {
            try
            {
                Contrat contrat = await _contratRepository.GetByConcod(soccod, concod);
                if (contrat == null)
                    return NotFound();

                await _contratRepository.DeleteAsync(contrat);
                return NoContent();
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de suppression du contrat", details = ex.Message });
            }
        }
    }
}
