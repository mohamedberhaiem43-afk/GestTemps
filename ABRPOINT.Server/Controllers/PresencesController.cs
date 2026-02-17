using ABRPOINT.Server.Annotations.EtatPriodiqueAttributes;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using ABRPOINT.Server.Repository;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class PresencesController : ControllerBase
    {
        private readonly IPresenceRepository _presenceRepository;
        private readonly IPointageOptimizerService _pointageOptimizerService;
        private readonly IReportsGenerationService _reportGenerationService;
        public PresencesController(IPresenceRepository presenceRepository, IReportsGenerationService reportGenerationService,IUtilisateurRepository utilisateurRepository,IPointageOptimizerService pointageOptimizerService)
        {
            _presenceRepository = presenceRepository;
            _reportGenerationService = reportGenerationService;
            _pointageOptimizerService = pointageOptimizerService;
        }
        [HttpPut("optimiserPointage/{soccod}/{empmat}/{dateDeb}/{dateFin}")]
        public async Task OptimizePointage(string soccod,string empMat,DateTime dateDeb,DateTime dateFin)
        {
            try
            {
                await _pointageOptimizerService.OptimizePointage(soccod, empMat, dateDeb, dateFin);
            }
            catch (Exception)
            {
                throw;
            }
        }
        // GET: api/<DirectionsController>
        [HttpGet("{soccod}/{dateDebut}/{dateFin}/{regime}")]
        public async Task<IActionResult> Get(string soccod,DateTime dateDebut,DateTime dateFin, string regime, [FromQuery] List<string>empcods)
        {
            try
            {
                IEnumerable<EtatEmpPresence> result = await _presenceRepository.GetAllAsync(soccod, dateDebut, dateFin, regime, empcods);
                return Ok(result);
            }
            catch (Exception)
            {
                throw;
            }
        }
        [HttpGet("get-etat-retard-report/{soccod}/{dateDebut}/{dateFin}/{regime}")]
        public async Task<IActionResult> GetEtatRetardReport(string soccod, DateTime? dateDebut, DateTime? dateFin, string regime,[FromQuery] List<string> empcods)
        {
            try
            {
                byte[] pdfBytes = _reportGenerationService.GenerateEtatRetardReport(soccod, dateDebut, dateFin, regime,empcods);
                return File(pdfBytes, "application/pdf", "EtatRetard.pdf");
            }
            catch (Exception)
            {
                throw;
            }
        }
        [HttpGet("get-etat-presence-report/{soccod}/{dateDebut}/{dateFin}/{regime}")]
        public async Task<IActionResult> GetEtatPresenceReport(string soccod, DateTime? dateDebut, DateTime? dateFin, string regime,[FromQuery] List<string> empcods)
        {
            try
            {
                byte[] pdfBytes = _reportGenerationService.GenerateEtatPresenceReport(soccod, dateDebut, dateFin, regime,empcods);
                return File(pdfBytes, "application/pdf", "EtatPresence.pdf");
            }
            catch (Exception)
            {
                throw;
            }
        }
        [HttpPost("etat-global")]
        public IActionResult GenerateEtatGlobal([FromBody] EtatGlobalRequest request)
        {
            var pdf = _reportGenerationService.GenerateEtatGlobalReport(request);

            return File(pdf, "application/pdf", "EtatGlobal.pdf");
        }
        [HttpPost("etat-detaille")]
        public IActionResult GenerateEtatDetaille([FromBody] EtatDetailleRequest request)
        {
            var pdf = _reportGenerationService.GenerateEtatDetailleReport(request);

            return File(pdf, "application/pdf", "EtatGlobal.pdf");
        }


        [HttpGet("emp-point/{soccod}/{empcod}")]
        public async Task<IActionResult> GetEmpEtatPeriodique(string soccod,string empcod)
        {
            IEnumerable<Presence> result = await _presenceRepository.GetEmpEtatPeriodiqueAsync(soccod,empcod);
            return Ok(result);
        }
        [HttpGet("emp-point-filtrer/{soccod}/{empcod}/{dateDebut}/{dateFin}")]
        [CanGetEtatPeriodique]
        public async Task<IActionResult> GetEmpEtatPeriodiqueByDate(string soccod, string empcod, DateTime dateDebut, DateTime dateFin)
        {
            try
            {
                IEnumerable<PresenceDto> result = await _presenceRepository.GetEmpEtatPeriodiqueAsync(soccod, empcod, dateDebut, dateFin);
                return Ok(result);
            }
            catch (Exception)
            {
                throw;
            }
        }


        // POST api/<DirectionsController>
        [HttpPost]
        public void Post([FromBody] Presence presence)
        {
            _presenceRepository.Add(presence);
        }
        

        // PUT api/<DirectionsController>/5
        [HttpPut("{soccod}/{empcod}/{predat}")]
        public async Task<IActionResult> Put(string soccod,string empcod,DateTime predat,[FromBody] EmpEtatPeriodique presence)
        {
            if (string.IsNullOrEmpty(soccod)||string.IsNullOrEmpty(empcod))
                return BadRequest("Veuillez saisir tous les champs obligatoires");
            if (presence == null)
                return BadRequest("Veuillez remplir tous les champs obligatoires");
            try
            {
                PresenceDto dbpresence = _presenceRepository.Get(soccod,empcod,predat);
                if(dbpresence == null)
                    dbpresence = await _presenceRepository.AddPresence(soccod, empcod, predat,"");
                dbpresence.Preentamidiup = presence.preentamidiup;
                dbpresence.Preentsupup = presence.preentsupup;
                dbpresence.Preentmatup = presence.preentmatup;
                dbpresence.Presortamidiup = presence.presortamidiup;
                dbpresence.Presortsupup = presence.presortsupup;
                dbpresence.Presortmatup = presence.presortmatup;
                dbpresence.Prerepos = presence.prerepos.ToString();
                dbpresence.Prerepas = presence.prerepas;
                
                await _presenceRepository.UpdateAsync(dbpresence);

                return Ok("modification effectue avec sucées");
            }
            catch (Exception ex)
            {
                return StatusCode(500,ex);
            }
        }
        [HttpPut("update-compensation/{soccod}/{empcod}/{date}/{totcmp}")]
        public async Task<IActionResult> UpdateComponsation(string soccod,string empcod,DateTime date,float totcmp)
        {
            try
            {
                bool result = await _presenceRepository.UpdateTotcmp(soccod, empcod, date, totcmp);
                if (result)
                    return Ok("componsation ajoutée avec succées");
                return StatusCode(500,"probléme d'ajout de componsation");
            }
            catch (Exception)
            {
                throw;
            }
        }

        // DELETE api/<DirectionsController>/5
        [HttpDelete("{soccod}/{concod}")]
        public IActionResult Delete(string soccod, string concod)
        {
            Presence presence = null;
            if (presence == null)
            {
                return NotFound();
            }
            _presenceRepository.Delete(presence);
            return NoContent();
        }
    }
}
