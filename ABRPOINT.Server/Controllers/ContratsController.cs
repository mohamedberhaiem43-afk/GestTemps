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
        // GET: api/<DirectionsController>
        [HttpGet("{soccod}/{srvcod}/{sitcod}/{echdeb}/{echfin}")]
        [CanGetContrat]
        public IActionResult Get(string soccod, string srvcod, string sitcod,
            DateTime echdeb, DateTime echfin)
        {
            try
            {
                IEnumerable<Contrat>contrats = _contratRepository.GetAll(soccod,srvcod,sitcod,echdeb,echfin);
                return Ok(contrats);

            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de récuperer les contrats", details = ex.Message });
            }
        }
        [HttpGet("{soccod}/{uticod}/{echdeb}/{echfin}")]
        [CanGetContrat]
        public IActionResult Get(string soccod,string uticod,DateTime echdeb,DateTime echfin)
        {
            try
            {
                IEnumerable<Contrat> contrats = _contratRepository.GetAll(soccod, uticod,echdeb,echfin);
                return Ok(contrats);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de récupérer des contrats", details = ex.Message });
            }
        }
        [HttpGet("get-echeance/{soccod}/{echdeb}/{echfin}/{uticod}")]
        [CanGetEcheanceContrat]
        public async Task<IActionResult> GetEcheanceContrat(string soccod, DateTime echdeb, DateTime echfin, string uticod)
        {
            try
            {
                List<EcheanceContrat> contrats = await _contratRepository.GetEcheanceContratsByDate(soccod,echdeb, echfin, uticod);
                return Ok(contrats);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de récupérer des contrats", details = ex.Message });
            }
        }
        [HttpGet("get-echeance-contrat-report/{soccod}/{echdeb}/{echfin}")]
        [CanGetEcheanceContrat]
        public IActionResult GetEcheanceContratReport(string soccod, DateTime echdeb, DateTime echfin)
        {
            try
            {
                byte[] pdfBytes = _reportsGenerationService.GenerateEcheanceContratReport(soccod,echdeb,echfin);
                return File(pdfBytes, "application/pdf", "EcheanceContrat.pdf");
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de récupérer des contrats", details = ex.Message });
            }
        }
        [HttpGet("{soccod}/{uticod}")]
        [CanGetContrat]
        public async Task<IActionResult> Get(string soccod,string uticod)
        {
            try
            {
                IEnumerable<Contrat> contrats = await _contratRepository.GetAll(soccod, uticod);
                return Ok(contrats);
            }
            catch (Exception ex)
            {

                return StatusCode(500, new { message = "Erreur lors de récupérer des contrats", details = ex.Message });
            }
        }
        [HttpGet("get-list-echeance/{soccod}/{uticod}")]
        [CanGetEcheanceContrat]
        public IActionResult GetEcheanceContrats(string soccod,string uticod)
        {
            try
            {
                return Ok(_contratRepository.GetEcheanceContrats(soccod, uticod));
            }
            catch (Exception ex)
            {

                return StatusCode(500, new { message = "Erreur lors de récuprérer les contrats", details = ex.Message });
            }
        }


        [HttpPost]
        [CanAddContrat]
        public IActionResult Add(Contrat contrat)
        {
            try
            {
                _contratRepository.Add(contrat);
                return Ok(new { message = "Contrat ajouté avec succès" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de l'ajout du contrat", details = ex.Message });
            }
        }



        // PUT api/<DirectionsController>/5
        [HttpPut("{soccod}/{concod}")]
        [CanUpdateContrat]
        public IActionResult Put(string foncod, [FromBody] Contrat contrat)
        {
            try
            {
                if (contrat == null || foncod != contrat.Empcod)
                {
                    return BadRequest();
                }

                _contratRepository.Update(contrat);
                return NoContent();
            }
            catch (Exception ex)
            {

                return StatusCode(500, new { message = "Erreur lors de modification du contrat", details = ex.Message });
            }
            
        }

        // DELETE api/<DirectionsController>/5
        [HttpDelete("{soccod}/{concod}")]
        [CanDeleteContrat]
        public IActionResult Delete(string soccod, string concod)
        {
            try
            {
                Contrat contrat = _contratRepository.GetByConcod(soccod, concod);
                if (contrat == null)
                {
                    return NotFound();
                }
                _contratRepository.Delete(contrat);
                return NoContent();
            }
            catch (Exception ex)
            {

                return StatusCode(500, new { message = "Erreur lors de suppression du contrat", details = ex.Message });
            }

        }
    }
}
