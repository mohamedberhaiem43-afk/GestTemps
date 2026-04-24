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
        public async Task<IActionResult> Get(string soccod)
        {
            if (string.IsNullOrWhiteSpace(soccod))
                return BadRequest(new {Message = "code sociÃ©tÃ© est obligatoire"});
            try
            {   
                IEnumerable<Absence> absence = await _absenceRepository.GetAllAsync(soccod);

                if(absence == null ||  !absence.Any())
                    return NotFound(new {Message = $"Aucun absenec trouvÃ©e avec code : {soccod}" });

                return Ok(absence);
            }
            catch (Exception ex)
            {
                return StatusCode(500,"ProblÃ©me de recuperation des absences ") ;
            }
        }
        [HttpGet("get-absence-report/{soccod}/{empcod}/{concod}")]
        [CanGetAbsence]
        public IActionResult GetAbsenceReport(string soccod,string empcod,string concod)
        {
            if (string.IsNullOrWhiteSpace(soccod))
                return BadRequest(new {Message = "code sociÃ©tÃ© est obligatoire"});
            try
            {

                byte[] pdfBytes = _reportsGenerationService.GenerateAbsenceReport(soccod, empcod, concod);
                return File(pdfBytes, "application/pdf", "Absence.pdf");
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de rÃ©cupÃ©rer des contrats", details = ex.Message });
            }
        }
        [HttpGet("get-libs/{soccod}")]
        public async Task<IActionResult> GetAbsLibs(string soccod)
        {
            if(string.IsNullOrEmpty(soccod))
                return BadRequest(new { Message = "Veuillez saisie le soccod des absences." });
            try
            {
                Dictionary<string,string> absence = await _absenceRepository.GetAbsLibsAsync(soccod);
                return Ok(absence);
            }
            catch (Exception)
            {

                return StatusCode(500, "problÃ©me de rÃ©cupÃ©ration d'absences");
            }
        }

        [HttpGet("get-etat-absence/{soccod}/{datedebut}/{datefin}/{absaut}/{absret}/{presNonOpt}/{sansPointageInvalide}/{radioValue}")]
        [CanGetAbsence]
        public async Task<IActionResult> GetEtatAbsence(string soccod, DateTime datedebut, DateTime datefin, bool absaut, bool absret,
            bool presNonOpt, bool sansPointageInvalide, string radioValue, [FromQuery] List<string>? empcods)
                    {
            if(string.IsNullOrEmpty(soccod))
                return BadRequest(new { Message = "Veuillez saisie le soccod des absences." });
            if(empcods == null || empcods.Count == 0)
                return BadRequest(new { Message = "Veuillez saisie les employÃ© des absences." });
            try
            {
                List<EtatAbsence> etatAbsences = await _absenceRepository.GetEtatAbsenceAsync(soccod, datedebut, datefin, absaut, absret,
                    presNonOpt, sansPointageInvalide, radioValue, empcods);
                return Ok(etatAbsences);
            }
            catch (Exception)
            {
                return StatusCode(500, "problÃ©me de rÃ©cupÃ©ration d'absences");
            }
        }
        [HttpPost("get-etat-absence-report")]
        [CanGetAbsence]
        public IActionResult GetEtatAbsenceReport([FromBody] EtatAbsenceReport etatAbsence)
        {
            try
            {
                var pdfBytes = _reportsGenerationService.GetEtatAbsenceReport(etatAbsence);

                return File(pdfBytes, "application/pdf", "etat-absence.pdf");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error generating report: {ex.Message}");
                return StatusCode(500, new { message = "Problème génération état d'absences", error = ex.Message });
            }
        }

        [HttpGet("get-etat-absences-report/{soccod}/{datedebut}/{datefin}")]
        [CanGetAbsence]
        public async Task<IActionResult> GetEtatAbsencesReport(string soccod, string datedebut, string datefin, [FromQuery] string empcods)
        {
            try
            {
                var codes = (empcods ?? "").Split(',').ToList();
                var reportData = new EtatAbsenceReport
                {
                    //Soccod = soccod,
                    Date = datedebut, // Or specific format
                    DateFin = datefin,
                    Data = codes.Select(c => new EtatAbsenceData { Empcod = c }).ToList() // Placeholder, service should handle data fetch or use these
                };

                // NOTE: The GetEtatAbsenceReport service method expects already populated data.
                // We might need to fetch the data here first or update the service.
                // For now, let's call the repository to get the data as the frontend does.
                
                // Fetching data first to populate the report
                var dataTask = await _absenceRepository.GetEtatAbsenceAsync(soccod, DateTime.Parse(datedebut), DateTime.Parse(datefin), 
                    true, true, true, true, "tous", codes);
                
                var results = dataTask;
                reportData.Data = results.Select(r => new EtatAbsenceData {
                    Empcod = r.Empcod,
                    Empmat = r.Empmat,
                    Emplib = r.Emplib,
                    Date = r.Date ?? DateTime.MinValue,
                    Abscod = r.Abscod,
                    Motif = r.Motif,
                    Absence = (byte?)r.Absence,
                    Absjust = (byte?)r.Absjust,
                    Absnj = (byte?)r.Absnj,
                    Congepaye = (byte?)r.Congepaye,
                    Acctrav = (byte?)r.Acctrav,
                    CSF = (byte?)r.CSF,
                    FM = (byte?)r.FM,
                    Arrtech = (byte?)r.Arrtech,
                    Absmal = (byte?)r.Absmal,
                    MAP = (byte?)r.MAP,
                    Autsp = (byte?)r.Autsp,
                    CSS = (byte?)r.CSS,
                    Absjourretard = r.Absjourretard
                }).ToList();

                var pdfBytes = _reportsGenerationService.GetEtatAbsenceReport(reportData);
                return File(pdfBytes, "application/pdf", "etat-absences.pdf");
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de la génération du rapport : " + ex.Message });
            }
        }
        // POST api/<DirectionsController>
        [HttpPost]
        [CanAddAbsence]
        public async Task<IActionResult> Post([FromBody] Absence absence)
        {
            if(absence == null)
                return BadRequest(new { Message = "Veuillez saisie les champs obligatoires de cet absence." });

            if(string.IsNullOrEmpty(absence.Abscod) || string.IsNullOrEmpty(absence.Soccod))
                return BadRequest(new { Message = "Veuillez saisie les champs obligatoires de cet absence." });
            try
            {
                await _absenceRepository.AddAsync(absence);
                return Ok(new { Message = "absence ajoutÃ©e avec succÃ©es." });
            }
            catch (Exception ex)
            {

                return StatusCode(500, "problÃ©me d'ajout d'absence");
            }
            
        }

        // PUT api/<DirectionsController>/5
        [HttpPut]
        [CanUpdateAbsence]
        public async Task<IActionResult> Put([FromBody] Absence absence)
        { 
            try
            {
                await _absenceRepository.UpdateAsync(absence);
                return Ok("absence modifiÃ©e avec sucÃ©es");
            }
            catch (Exception)
            {
                return StatusCode(500, "problÃ©me de modification d'absence");
            }
           
        }

        // DELETE api/<DirectionsController>/5
        [HttpDelete("{soccod}/{abscod}")]
        [CanDeleteSanction]
        public async Task<IActionResult> Delete(string soccod, string abscod)
        {
            if(string.IsNullOrEmpty(abscod) || string.IsNullOrEmpty(soccod))
                return BadRequest(new { Message = "code sociÃ©tÃ© et code absence sont obligatoires." });

            try
            {
                Absence? absence = await _absenceRepository.GetByAbscodAsync(soccod, abscod);
                if (absence == null)
                    return NotFound(new {Message = "absence avec non trouvÃ©e."});
                
                await _absenceRepository.DeleteAsync(absence);
                return NoContent();
            }
            catch (Exception ex)
            {

                return StatusCode(500, "problÃ©me de suppression d'absence");
            }
            
        }
    }
}

