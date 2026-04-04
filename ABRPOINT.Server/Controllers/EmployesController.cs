using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Annotations.EmployeAttributes;

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class EmployesController : ControllerBase
    {
        private readonly IEmployeRepository _employeRepository;
        private readonly IUtilisateurRepository _utilisateurRepository;
        private readonly IReportsGenerationService _reportsGenerationService;
        public EmployesController(IEmployeRepository employeRepository,IReportsGenerationService reportsGenerationService, IUtilisateurRepository utilisateurRepository)
        {
            _employeRepository = employeRepository;
            _reportsGenerationService = reportsGenerationService;
            _utilisateurRepository = utilisateurRepository;
        }

        // GET: api/employes
        [HttpGet("{soccod}/{uticod}")]
        [CanGetEmploye]
        public async Task<IActionResult> Get(string soccod, string uticod)
        {
            try
            {
                var employees = await _employeRepository.GetAllAsync(soccod, uticod);
                return Ok(employees);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de la récupération des employés", details = ex.Message });
            }
        }
       

        [HttpGet("get-emp-etat-conge/{soccod}/{empcod}/{moisdeb}/{moisfin}/{annee}")]
        [CanGetEmploye]
        public async Task<IActionResult> GetEmpEtatConge(string soccod,string empcod,string moisdeb,string moisfin,string annee)
        {
            try
            {
                EmpEtatConge empEtatConge = await _employeRepository.GetEmpEtatConge(soccod,empcod,moisdeb,moisfin,annee);
                return Ok(empEtatConge);
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }
        [HttpGet("get-emp-horaires/{soccod}/{empcod}")]
        [CanGetEmploye]
        public async Task<IEnumerable<EmpHoraireDto>> GetEmployesHoraire(string soccod, string empcod)
        {
            try
            {
                var empHoraires = await _employeRepository.GetEmployesHoraire(soccod, empcod);
                return empHoraires;
            }
            catch (Exception)
            {

                throw;
            }
        }

        [HttpGet("get-emp-depass-max/{soccod}/{uticod}")]
        [CanGetEmploye]
        public async Task<List<EmpDepassMxHre>> GetEmpDepassMxHres(string soccod, string uticod)
        {
            try
            {
                var employes = await _employeRepository.GetEmployesDepassantMaxHeure(soccod, uticod);
                return employes;
            }
            catch (Exception)
            {
                throw;
            }
        }

        [HttpGet("get-stats/{soccod}")]
        [CanGetEmploye]
        public async Task<Dictionary<string?, EmployeStat>> GetStatistics(string soccod)
        {
            var x = await _employeRepository.GetStatistics(soccod);
            return x;
        }
        [HttpGet("get-sexe-stats/{soccod}")]
        [CanGetEmploye]
        public async Task<Dictionary<string, int>> GetEmployeeCountBySexAsync(string soccod)
        {
            try
            {
                return await _employeRepository.GetEmployeeCountBySexAsync(soccod);
            }
            catch (Exception)
            {
                throw;
            }
        }


        [HttpGet("get-emps/{soccod}/{site}/{uticod}")]
        [CanGetEmploye]
        public async Task<ActionResult<IList<EmployeePresenceDto>>> GetEmployes(string soccod, string uticod, string site, [FromQuery] List<string>? empcods, string? empreg = null, string? service = null,DateTime? debut = null,DateTime? fin = null)
        {
            try
            {
                IList<EmployeePresenceDto> emps = await _employeRepository.GetBySitcodAndDircod(soccod, uticod, site,empcods, empreg, service,debut,fin);
                if (emps != null && emps.Count > 0)
                    return Ok(emps);

                return NoContent();
            }
            catch (Exception)
            {
                throw;
            }
        }

            
        // GET api/employes/5
        [HttpGet("get-employe/{soccod}/{empcod}")]
        [CanGetEmploye]
        public async Task<ActionResult<Employe>> GetEmploye(string soccod, string empcod)
        {
            try
            {
                Employe employe = new Employe();
                if (empcod != null && empcod != "null")
                {
                    employe = await _employeRepository.GetByEmpcod(soccod, empcod);
                    if (employe == null)
                        return NotFound();
                }
                return Ok(employe);
            }
            catch (Exception ex)
            {

                throw;
            }
        }

        [HttpGet("get-libs/{soccod}/{uticod}")]
        [CanGetEmploye]
        public async Task<Dictionary<string, string>> GetEmpLibs(string soccod, string uticod)
        {
            try
            {
                var emps = await _employeRepository.GetEmpLibs(soccod,uticod);
                return emps;
            }
            catch (Exception)
            {
                throw;
            }
        }

        [HttpGet("get-femme-libs/{soccod}/{uticod}")]
        [CanGetEmploye]
        public async Task<Dictionary<string, string>> GetFemmeLibs(string soccod, string uticod)
        {
            try
            {
                var employees = await _employeRepository.GetFemmeLibs(soccod,uticod);
                return employees;
            }
            catch (Exception)
            {
                throw;
            }
        }


        [HttpGet("get-report/{soccod}/{empcod}")]
        [CanGetEmploye]
        public IActionResult GenerateVisiteMedicalReport(string soccod,string empcod)
        {
            try
            {
                byte[] pdfBytes = _reportsGenerationService.GenerateVisiteMedicalReport(soccod, empcod);
                return File(pdfBytes, "application/pdf", "Visite Medicale.pdf");
            }
            catch (Exception ex)
            {
                throw new Exception("Error generating the report", ex);
            }
        }
        // POST api/employes
        [HttpPost]
        [CanAddEmploye]
        public async Task<IActionResult> Post([FromBody] Employe employe)
        {
            try
            {
                if(employe != null && !string.IsNullOrEmpty(employe.Empcod))
                {
                    await _employeRepository.AddAsync(employe);
                    Utilisateur utilisateur = new Utilisateur(){ Utiactif = "1", Utiadm = "0",
                        Uticod = employe.Empcod, Utinom = employe.Emplib,Utimps=employe.Empcin,Utimail=employe.Empemail };
                    Socuser socuser = new Socuser()
                    {
                        Soccod = employe.Soccod,
                        Sitcod = employe.Sitcod,
                        Uticod = employe.Empcod,
                    };
                    await _utilisateurRepository.AddAsync(utilisateur, socuser);
                    return Ok(new { message = "Employé ajouté avec succès" });
                }
                    return BadRequest(new { message = "Veuillez remplir les champs obligatoires" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de l'ajout d'employé ", details = ex.Message });
            }
        }
        [HttpPut]
        [CanUpdatetEmploye]
        public async Task<IActionResult> AddMultipleEmploye([FromBody] List<Employe> employe)
        {
            try
            {
                await _employeRepository.AddMultipleEmploye(employe);
                return Ok(new { message = "Employé ajouté avec succès",isValid = true });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de l'ajout d'employé ", details = ex.Message });
            }

        }

        [HttpPut("update-employe")]
        [CanUpdatetEmploye]
        public async Task<IActionResult> Put([FromBody] Employe employe)
        {
            try
            {
                if (employe == null || employe.Empcod == null)
                    return BadRequest(new { message = "Employe object is null or does not match route parameters" });

                Employe addEmp = await _employeRepository.UpdateAsync(employe);
                return Ok(new { message = "employé modifié avec succées", addEmp });
            }
            catch (Exception)
            {
                throw;
            }
        }

        // DELETE api/employes/soccod/empcod
        [HttpDelete("{soccod}/{empcod}")]
        [CanDeleteEmploye]
        public async Task<IActionResult> Delete(string soccod, string empcod)
        {
            try
            {
                var employe = await _employeRepository.GetByEmpcod(soccod, empcod);

                if (employe == null)
                {
                    return BadRequest(new { message = "Employé introuvable." });
                }

                var (success, message) = await _employeRepository.DeleteAsync(employe);

                if (!success)
                {
                    return BadRequest(new { message });
                }
                return Ok(new { message });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = $"Erreur serveur : {ex.Message}" });
            }
        }
    }
}
