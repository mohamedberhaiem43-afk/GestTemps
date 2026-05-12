using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Mvc;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Data;
using Microsoft.AspNetCore.Authorization;
using ABRPOINT.Server.Annotations.CongesAttributes.CongeAttributes;
using ABRPOINT.Server.Annotations.CongesAttributes.CahierCongeAttributes;
using ABRPOINT.Server.Annotations.CongesAttributes.DemCongeAttributes;
using Microsoft.EntityFrameworkCore;
using System.Threading.Tasks;

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class CongesController : ControllerBase
    {
        private readonly ICongeRepository _congeRepository;
        private readonly IReportsGenerationService _reportsGenerationRepository;
        private readonly ApplicationDbContext _context;
        public CongesController(ICongeRepository congeRepository,IReportsGenerationService reportsGenerationService, ApplicationDbContext context)
        {
            _congeRepository = congeRepository;
            _reportsGenerationRepository = reportsGenerationService;
            _context = context;
        }

        // GET: api/Conges/get-next-concod/{soccod}
        // A16 — Permission requise pour empêcher l'énumération depuis un compte employé.
        [HttpGet("get-next-concod/{soccod}")]
        [CanAddConge]
        public async Task<IActionResult> GetNextConcod(string soccod)
        {
            try
            {
                var now = DateTime.Now;
                var prefix = now.ToString("yyMM");
                var pattern = prefix + "%";

                var maxConcod = await _context.Conges
                    .Where(c => c.Soccod == soccod && c.Concod.StartsWith(prefix))
                    .OrderByDescending(c => c.Concod)
                    .Select(c => c.Concod)
                    .FirstOrDefaultAsync();

                int nextSeq = 1;
                if (!string.IsNullOrEmpty(maxConcod) && maxConcod.Length >= 6)
                {
                    if (int.TryParse(maxConcod.Substring(4), out int lastSeq))
                        nextSeq = lastSeq + 1;
                }

                var nextConcod = prefix + nextSeq.ToString("D2");
                return Ok(new { concod = nextConcod });
            }
            catch (Exception ex)
            {
                return StatusCode(500, "Erreur lors de la génération du numéro: " + ex.Message);
            }
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
        public async Task<Conge> Get(string soccod,string concod)
        {
            try
            {
                return await _congeRepository.GetByConcodAsync(soccod, concod);
            }
            catch (Exception ex)
            {

                throw new Exception("Erreur innatendu: "+ex);
            }
            
        }
        [HttpGet("get-emp-conge-by-date/{soccod}/{empcod}/{date}")]
        [CanGetConge]
        public async Task<Conge> GetEmpCongeByDate(string soccod,string empcod,DateTime date)
        {
            try
            {
                return await _congeRepository.GetEmpCongeByDateAsync(soccod, empcod,date);
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
                List<CahierConge> cahierConge = await _congeRepository.GetCahierCongeAsync(soccod, datedebut, datefin,empcods);
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
        public IActionResult GenerateCahierCongeReport(string soccod,DateTime datedebut,DateTime datefin, 
            [FromQuery]List<string> empcods, [FromQuery] string justified = "", [FromQuery] string absenceType = "")
        {
            try
            {
                var pdfBytes = _reportsGenerationRepository.GenerateCahierCongeReport(soccod, datedebut, datefin, empcods, justified, absenceType);
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
                    var droitConge = await _congeRepository.GetDroitCongeAsync(soccod, empcod, parsedDateDebut, parsedDateFin);
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
        public async Task<IActionResult> Post([FromBody] Conge conge)
        {
            try
            {
                if(conge.Concod != "" && conge.Concod != null)
                {
                    // Normalize Condat to remove time part (set to midnight)
                    conge.Condat = conge.Condat.Value.Date;
                    conge.Condep = conge.Condep.Value.Date;
                    conge.Conret = conge.Conret.Value.Date;
                    await _congeRepository.AddAsync(conge);
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
        public async Task<IActionResult> Put([FromBody] Conge conge)
        {
            if (conge == null)
                return BadRequest("Veuillez remplir les champs obligatoiress");
            try
            {
                await _congeRepository.UpdateAsync(conge);
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
        [Tenancy.RequirePlanFeature(nameof(Tenancy.PlanFeatures.GeneralLeave))]
        public async Task<IActionResult> PostMultipleConges([FromBody] List<Conge> conges)
        {
            if (conges == null || conges.Count == 0)
            {
                return BadRequest("No conge records provided.");
            }

            await _congeRepository.AddMultipleAsync(conges);
            return Ok("Conges added successfully.");
        }

        // DELETE api/<DirectionsController>/5
        [HttpDelete("{soccod}/{concod}")]
        [CanDeleteConge]
        public async Task<IActionResult> Delete(string soccod, string concod)
        {
            Conge? employe = await _congeRepository.GetByConcodAsync(soccod, concod);
            if (employe == null)
            {
                return NotFound();
            }
            await _congeRepository.DeleteAsync(employe);
            return NoContent();
        }
    }
}
