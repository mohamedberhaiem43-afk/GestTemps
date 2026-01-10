using ABRPOINT.Server.Annotations.AbsenceAttributes;
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
    public class AbsencesController : ControllerBase
    {
        private readonly IAbscenceRepository _absenceRepository;
        private readonly IReportsGenerationService _reportsGenerationService;
        public AbsencesController(IAbscenceRepository absenceRepository,IReportsGenerationService reportsGenerationService)
        {
            _absenceRepository = absenceRepository;
            _reportsGenerationService = reportsGenerationService;
        }


        [HttpGet("get-absence/{soccod}")]
        [CanGetAbsence]
        public IActionResult Get(string soccod)
        {
            if (string.IsNullOrWhiteSpace(soccod))
                return BadRequest(new {Message = "code société est obligatoire"});
            try
            {
                IEnumerable<Absence> absence = _absenceRepository.GetAll(soccod);

                if(absence == null ||  !absence.Any())
                    return NotFound(new {Message = $"Aucun absenec trouvée avec code : {soccod}" });

                return Ok(absence);
            }
            catch (Exception ex)
            {

                return StatusCode(500,"Probléme de recuperation des absences ") ;
            }
        }
        [HttpGet("get-absence-report/{soccod}/{empcod}/{concod}")]
        [CanGetAbsence]
        public IActionResult GetAbsenceReport(string soccod,string empcod,string concod)
        {
            if (string.IsNullOrWhiteSpace(soccod))
                return BadRequest(new {Message = "code société est obligatoire"});
            try
            {

                byte[] pdfBytes = _reportsGenerationService.GenerateAbsenceReport(soccod, empcod, concod);
                return File(pdfBytes, "application/pdf", "Absence.pdf");
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de récupérer des contrats", details = ex.Message });
            }
        }
        [HttpGet("get-libs/{soccod}")]
        [CanGetAbsence]
        public async Task<IActionResult> GetAbsLibs(string soccod)
        {
            if(string.IsNullOrEmpty(soccod))
                return BadRequest(new { Message = "Veuillez saisie le soccod des absences." });
            try
            {
                Dictionary<string,string> absence = await _absenceRepository.GetAbsLibs(soccod);
                return Ok(absence);
            }
            catch (Exception)
            {

                return StatusCode(500, "probléme de récupération d'absences");
            }
        }

        [HttpGet("get-etat-absence/{soccod}/{datedebut}/{datefin}/{absaut}/{absret}/{presNonOpt}/{sansPointageInvalide}/{selectedAbsType}")]
        [CanGetAbsence]
        public async Task<IActionResult> GetEtatAbsence(string soccod, DateTime datedebut, DateTime datefin, bool absaut, bool absret,
            bool presNonOpt, bool sansPointageInvalide, string? selectedAbsType, [FromQuery] List<string>? empcods)
            {
            if(string.IsNullOrEmpty(soccod))
                return BadRequest(new { Message = "Veuillez saisie le soccod des absences." });
            if(empcods.Count() == 0)
                return BadRequest(new { Message = "Veuillez saisie les employé des absences." });
            try
            {
                List<EtatAbsence> etatAbsences = await _absenceRepository.GetEtatAbsence(soccod, datedebut, datefin, absaut, absret,
                    presNonOpt, sansPointageInvalide, selectedAbsType, empcods);
                return Ok(etatAbsences);
            }
            catch (Exception)
            {
                return StatusCode(500, "probléme de récupération d'absences");
            }
        }

        // POST api/<DirectionsController>
        [HttpPost]
        [CanAddAbsence]
        public IActionResult Post([FromBody] Absence absence)
        {
            if(absence == null)
                return BadRequest(new { Message = "Veuillez saisie les champs obligatoires de cet absence." });

            if(string.IsNullOrEmpty(absence.Abscod) || string.IsNullOrEmpty(absence.Soccod))
                return BadRequest(new { Message = "Veuillez saisie les champs obligatoires de cet absence." });
            try
            {
                _absenceRepository.Add(absence);
                return Ok(new { Message = "absence ajoutée avec succées." });
            }
            catch (Exception ex)
            {

                return StatusCode(500, "probléme d'ajout d'absence");
            }
            
        }

        // PUT api/<DirectionsController>/5
        [HttpPut]
        [CanUpdateAbsence]
        public IActionResult Put([FromBody] Absence absence)
        { 
            try
            {
                _absenceRepository.Update(absence);
                return Ok("absence modifiée avec sucées");
            }
            catch (Exception)
            {
                return StatusCode(500, "probléme de modification d'absence");
            }
           
        }

        // DELETE api/<DirectionsController>/5
        [HttpDelete("{soccod}/{abscod}")]
        [CanDeleteSanction]
        public IActionResult Delete(string soccod, string abscod)
        {
            if(string.IsNullOrEmpty(abscod) || string.IsNullOrEmpty(soccod))
                return BadRequest(new { Message = "code société et code absence sont obligatoires." });

            try
            {
                Absence absence = _absenceRepository.GetByAbscod(soccod, abscod);
                if (absence == null)
                    return NotFound(new {Message = "absence avec non trouvée."});
                
                _absenceRepository.Delete(absence);
                return NoContent();
            }
            catch (Exception ex)
            {

                return StatusCode(500, "probléme de suppression d'absence");
            }
            
        }
    }
}
