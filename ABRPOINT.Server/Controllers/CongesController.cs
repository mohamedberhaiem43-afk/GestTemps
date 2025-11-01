using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Mvc;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Dtaos;
using Microsoft.AspNetCore.Authorization;
using ABRPOINT.Server.Annotations.CongesAttributes.CongeAttributes;
using ABRPOINT.Server.Annotations.CongesAttributes.CahierCongeAttributes;
using ABRPOINT.Server.Annotations.CongesAttributes.DemCongeAttributes;

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class CongesController : ControllerBase
    {
        private readonly ICongeRepository _congeRepository;
        private readonly IReportsGenerationService _reportsGenerationRepository;
        public CongesController(ICongeRepository congeRepository,IReportsGenerationService reportsGenerationService)
        {
            _congeRepository = congeRepository;
            _reportsGenerationRepository = reportsGenerationService;
        }
        // GET: api/<DirectionsController>
        [HttpGet("get-conges/{soccod}/{uticod}")]
        [CanGetConge]
        public async Task<IActionResult> GetCongeWithAbsenceAsync(string soccod, string uticod)
        {
            try
            {
                return Ok( await _congeRepository.GetCongeWithAbsenceAsync(soccod,uticod));
            }
            catch (Exception ex)
            {
                return StatusCode(500,"probléme de récuperation de congés "+ex);
            }
            
        }

        // GET api/<DirectionsController>/5
        [HttpGet("{soccod}/{concod}")]
        [CanGetConge]
        public Conge Get(string soccod,string concod)
        {
            try
            {
                return _congeRepository.GetByConcod(soccod, concod);
            }
            catch (Exception ex)
            {

                throw new Exception("Erreur innatendu: "+ex);
            }
            
        }
        [HttpGet("get-cahier-conge/{soccod}/{datedebut}/{datefin}")]
        [CanGetCahierConge]
        public async Task<List<CahierConge>> GetCahierConge(string soccod,DateTime datedebut,DateTime datefin, [FromQuery]List<string>empcods)
        {
            try
            {
                List<CahierConge> cahierConge = await _congeRepository.GetCahierConge(soccod, datedebut, datefin,empcods);
                return cahierConge;
            }
            catch (Exception ex)
            {

                throw new Exception("Erreur innatendu: "+ex);
            }
            
        }

        [HttpGet("get-report/{concod}")]
        [CanGetConge]
        public IActionResult GenerateReport(string concod)
        {
            try
            {
                var pdfBytes = _reportsGenerationRepository.GenerateCongeReport(concod);
                return File(pdfBytes, "application/pdf", "Conge.pdf");
            }
            catch (Exception ex)
            {
                return StatusCode(500, "An error occurred while generating the report: " + ex.Message);
            }
        }

        [HttpGet("get-cahier-de-conge-report/{soccod}/{datedebut}/{datefin}")]
        [CanGetCahierConge]
        public IActionResult GenerateCahierCongeReport(string soccod,DateTime datedebut,DateTime datefin, [FromQuery]List<string>empcods)
        {
            try
            {
                var pdfBytes = _reportsGenerationRepository.GenerateCahierCongeReport(soccod,datedebut,datefin,empcods);
                return File(pdfBytes, "application/pdf", "CahierDeConge.pdf");
            }
            catch (Exception ex)
            {
                return StatusCode(500, "An error occurred while generating the report: " + ex.Message);
            }
        }
        [HttpGet("get-droit-de-conge-report/{soccod}/{datedebut}/{datefin}")]
        [CanGetDroitConge]
        public async Task<IActionResult> GenerateDroitCongeReport(string soccod, DateTime? datedebut, DateTime? datefin, 
                                                                [FromQuery] List<string> empcods)
        {
            try
            {
                var pdfBytes = _reportsGenerationRepository.GenerateDroitCongeReport(soccod,datedebut,datefin,empcods);
                return File(pdfBytes, "application/pdf", "DroitDeConge.pdf");
            }
            catch (Exception ex)
            {
                return StatusCode(500, "An error occurred while generating the report: " + ex.Message);
            }
        }
        
        
        [HttpGet("get-droit-de-conge/{soccod}/{datedebut}/{datefin}")]
        [CanGetDroitConge]
        public async Task<IActionResult> GetDroitConge(string soccod, string datedebut, string datefin,
                                                        [FromQuery] List<string> empcods)
        {
            try
            {
                // Convert string parameters to DateTime? before passing them to the repository method
                DateTime? parsedDateDebut = DateTime.TryParse(datedebut, out var tempDateDebut) ? tempDateDebut : null;
                DateTime? parsedDateFin = DateTime.TryParse(datefin, out var tempDateFin) ? tempDateFin : null;

                if (parsedDateDebut == null || parsedDateFin == null)
                {
                    return BadRequest("Invalid date format for datedebut or datefin.");
                }
                List<DroitCongeDto> result = new List<DroitCongeDto>();
                foreach (var empcod in empcods)
                {
                    var droitConge = await _congeRepository.GetDroitConge(soccod, empcod, parsedDateDebut, parsedDateFin);
                    result.Add(droitConge);
                }
                    return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, "An error occurred while retrieving the rights: " + ex.Message);
            }
        }


        // POST api/<DirectionsController>
        [HttpPost]
        [CanAddConge]
        public IActionResult Post([FromBody] Conge conge)
        {
            try
            {
                if(conge.Concod != "" && conge.Concod != null)
                {
                    // Normalize Condat to remove time part (set to midnight)
                    conge.Condat = conge.Condat.Value.Date;
                    conge.Condep = conge.Condep.Value.Date;
                    conge.Conret = conge.Conret.Value.Date;
                    _congeRepository.Add(conge);
                    return Ok(conge);
                }
                return BadRequest("numéro d'ordre est obligatoire");
            }
            catch(Exception ex)
            {
                return StatusCode(500,"probléme d'ajout de congé "+ex);
            }
            
        }

        // PUT api/<DirectionsController>/5
        [HttpPut]
        [CanUpdateConge]
        public IActionResult Put([FromBody] Conge conge)
        {
            if (conge == null)
                return BadRequest("Veuillez remplir les champs obligatoiress");
            try
            {
                _congeRepository.Update(conge);
                return Ok("congé modifié avec succées");
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
            
        }
        // POST api/<CongesController>/bulk
        [HttpPost("bulk")]
        [CanAddCongeGeneral]
        public async Task<IActionResult> PostMultipleConges([FromBody] List<Conge> conges)
        {
            if (conges == null || conges.Count == 0)
            {
                return BadRequest("No conge records provided.");
            }

            await _congeRepository.AddMultiple(conges);
            return Ok("Conges added successfully.");
        }

        // DELETE api/<DirectionsController>/5
        [HttpDelete("{soccod}/{concod}")]
        [CanDeleteConge]
        public IActionResult Delete(string soccod, string concod)
        {
            Conge employe = _congeRepository.GetByConcod(soccod, concod);
            if (employe == null)
            {
                return NotFound();
            }
            _congeRepository.Delete(employe);
            return NoContent();
        }
    }
}
