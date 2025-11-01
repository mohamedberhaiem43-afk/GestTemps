using ABRPOINT.Server.Annotations.AutSortieAttributes;
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
    public class AutorisersController : ControllerBase
    {
        private readonly IautoriserRepository _autoriserRepository;
        private readonly IReportsGenerationService _reportsGenerationService;
        public AutorisersController(IautoriserRepository autoriserRepository, IReportsGenerationService reportsGenerationService)
        {
            _autoriserRepository = autoriserRepository;
            _reportsGenerationService = reportsGenerationService;
        }
        // GET: api/<DirectionsController>
        [HttpGet("{soccod}/{uticod}")]
        [CanGetAutSortie]
        public async Task<IActionResult> Get(string soccod, string uticod)
        {
            if (string.IsNullOrWhiteSpace(soccod)|| string.IsNullOrWhiteSpace(uticod))
                return BadRequest("Veuillez remplir les champs obligatoires");
            try
            {
                List<AutoriserEmployeDto> result = await _autoriserRepository.GetAutoriserWithAbsenceAsync(soccod, uticod);

                if (result == null)
                {
                    return NotFound();
                }

                return Ok(result);
            }
            catch (Exception)
            {

                return StatusCode(500);
            }
            
        }

        [HttpGet("get-autorisation/{soccod}/{concod}")]
        [CanGetAutSortie]
        public IActionResult GetAutoriser(string soccod,string concod)
        {
            if (string.IsNullOrWhiteSpace(soccod) || string.IsNullOrWhiteSpace(concod))
                return BadRequest("Veuillez saisie les champs obligatoires");
            try
            {
                Autoriser autoriser = _autoriserRepository.GetByConcod(soccod, concod);
                return Ok(autoriser);
            }
            catch (Exception)
            {

                return StatusCode(500);
            }
        }
        [HttpGet("get-autorisation-report/{soccod}/{concod}")]
        [CanGetAutSortie]
        public IActionResult GetAutoriserReport(string soccod,string concod)
        {
            if (string.IsNullOrWhiteSpace(soccod) || string.IsNullOrWhiteSpace(concod))
                return BadRequest("Veuillez saisie les champs obligatoires");
            try
            {
                byte[] pdfBytes = _reportsGenerationService.GenerateAutorisationSortieReport(soccod, concod);
                return File(pdfBytes, "application/pdf", "AutorisationSortie.pdf");
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de récupérer des contrats", details = ex.Message });
            }
        }


        // POST api/<DirectionsController>
        [HttpPost]
        [CanAddAutSortie]
        public void Post([FromBody] Autoriser autoriser)
        {
            try
            {
                _autoriserRepository.Add(autoriser);
            }
            catch (Exception)
            {
                throw;
            }
        }
        [HttpPost("bulk")]
        [CanAddAutSortieGeneral]
        public async Task BulkPost([FromBody] List<Autoriser> autorisers)
        {
            await _autoriserRepository.AddMultipleAutorisation(autorisers);
        }

        // PUT api/<DirectionsController>/5
        [HttpPut]
        [CanUpdateAutSortie]
        public IActionResult Put([FromBody] Autoriser autoriser)
        {
            if (autoriser == null)
                return BadRequest("Veuillez saisie les champs obligatoires");
            try
            {
                _autoriserRepository.Update(autoriser);
                return Ok("Autorisation de sortie modifiée avec succées");
            }
            catch (Exception)
            {

                return StatusCode(500);
            }
            
        }

        // DELETE api/<DirectionsController>/5
        [HttpDelete("{soccod}/{concod}")]
        [CanDeleteAutSortie]
        public IActionResult Delete(string soccod,string concod)
        {
            Autoriser autoriser = _autoriserRepository.GetByConcod(soccod,concod);
            if (autoriser == null)
            {
                return NotFound();
            }
            _autoriserRepository.Delete(autoriser);
            return NoContent();
        }
    }
}
