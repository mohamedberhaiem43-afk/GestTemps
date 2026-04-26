using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Annotations.EmployeAttributes;
using ABRPOINT.Server.Services;

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
        private readonly EncryptionService _encryptionService;
        public EmployesController(IEmployeRepository employeRepository, IReportsGenerationService reportsGenerationService, IUtilisateurRepository utilisateurRepository, EncryptionService encryptionService)
        {
            _employeRepository = employeRepository;
            _reportsGenerationService = reportsGenerationService;
            _utilisateurRepository = utilisateurRepository;
            _encryptionService = encryptionService;
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
        [HttpGet("get-my-kpis/{soccod}/{uticod}")]
        public async Task<IActionResult> GetMyKPIs(string soccod, string uticod)
        {
            try
            {
                var employees = await _employeRepository.GetMyKPIs(soccod, uticod);
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
                    // Decrypt sensitive fields for display
                    employe.Empcin = _encryptionService.Decrypt(employe.Empcin);
                    employe.Emptel = _encryptionService.Decrypt(employe.Emptel);
                    employe.Empsbase = _encryptionService.Decrypt(employe.Empsbase);
                    employe.Empsbrut = _encryptionService.Decrypt(employe.Empsbrut);
                    employe.Empsnet = _encryptionService.Decrypt(employe.Empsnet);
                    // Populate utirole from utilisateur table
                    employe.Utirole = await _utilisateurRepository.GetRoleByUticodAsync(empcod);
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
        public async Task<Dictionary<string, string>> GetEmpLibs(string soccod, string uticod, [FromQuery] string? sitcod = null, [FromQuery] string? sercod = null, [FromQuery] string? dircod = null, [FromQuery] string? empreg = null)
        {
            try
            {
                var emps = await _employeRepository.GetEmpLibs(soccod, uticod, sitcod, sercod, dircod, empreg);
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

        [HttpGet("get-attestation-travail/{soccod}/{empcod}")]
        [CanGetEmploye]
        public IActionResult GenerateAttestationTravailReport(string soccod, string empcod)
        {
            try
            {
                byte[] pdfBytes = _reportsGenerationService.GenerateAttestationTravailReport(soccod, empcod);
                return File(pdfBytes, "application/pdf", $"Attestation_Travail_{empcod}.pdf");
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }

        [HttpGet("get-certificat-travail/{soccod}/{empcod}")]
        [CanGetEmploye]
        public IActionResult GenerateCertificatTravailReport(string soccod, string empcod)
        {
            try
            {
                byte[] pdfBytes = _reportsGenerationService.GenerateCertificatTravailReport(soccod, empcod);
                return File(pdfBytes, "application/pdf", $"Certificat_Travail_{empcod}.pdf");
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }

        [HttpGet("get-attestation-salaire/{soccod}/{empcod}")]
        [CanGetEmploye]
        public IActionResult GenerateAttestationSalaireReport(string soccod, string empcod)
        {
            try
            {
                byte[] pdfBytes = _reportsGenerationService.GenerateAttestationSalaireReport(soccod, empcod);
                return File(pdfBytes, "application/pdf", $"Attestation_Salaire_{empcod}.pdf");
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
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
                    // Save plain CIN for user password before encrypting
                    var plainCin = employe.Empcin;
                    // Encrypt sensitive fields before saving
                    employe.Empcin = _encryptionService.Encrypt(employe.Empcin);
                    employe.Emptel = _encryptionService.Encrypt(employe.Emptel);
                    employe.Empsbase = _encryptionService.Encrypt(employe.Empsbase);
                    employe.Empsbrut = _encryptionService.Encrypt(employe.Empsbrut);
                    employe.Empsnet = _encryptionService.Encrypt(employe.Empsnet);
                    await _employeRepository.AddAsync(employe);
                    
                    // Try to create user account - don't fail the whole request if user creation fails
                    try
                    {
                        Utilisateur utilisateur = new Utilisateur()
                        {
                            Utiactif = "1",
                            Utiadm = "0",
                            Uticod = employe.Empcod,
                            Utinom = employe.Emplib,
                            Utimps = plainCin,
                            Utimail = employe.Empemail,
                            Utirole = employe.Utirole ?? "Utilisateur Standard"
                        };
                        Socuser socuser = new Socuser()
                        {
                            Soccod = employe.Soccod,
                            Sitcod = employe.Sitcod,
                            Uticod = employe.Empcod,
                        };
                        await _utilisateurRepository.AddAsync(utilisateur, socuser);
                    }
                    catch (Exception userEx)
                    {
                        // Log the error but don't fail - employee was already saved successfully
                        Console.WriteLine($"Avertissement: Employé créé mais compte utilisateur échoué pour {employe.Empcod}: {userEx.Message}");
                    }
                    
                    return Ok(new { message = "Employé ajouté avec succès" });
                }
                    return BadRequest(new { message = "Veuillez remplir les champs obligatoires" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de l'ajout d'employé", details = ex.Message });
            }
        }
        [HttpPut]
        [CanUpdatetEmploye]
        public async Task<IActionResult> AddMultipleEmploye([FromBody] List<Employe> employe)
        {
            try
            {
                // Encrypt sensitive fields before saving
                foreach (var emp in employe)
                {
                    if (emp != null && !string.IsNullOrEmpty(emp.Empcod))
                    {
                        emp._plainCin = emp.Empcin; // Save plain CIN for user creation
                        emp.Empcin = _encryptionService.Encrypt(emp.Empcin);
                        emp.Emptel = _encryptionService.Encrypt(emp.Emptel);
                        emp.Empsbase = _encryptionService.Encrypt(emp.Empsbase);
                        emp.Empsbrut = _encryptionService.Encrypt(emp.Empsbrut);
                        emp.Empsnet = _encryptionService.Encrypt(emp.Empsnet);
                    }
                }
                await _employeRepository.AddMultipleEmploye(employe);
                
                // Créer les comptes utilisateurs pour chaque employé
                foreach (var emp in employe)
                {
                    if (emp != null && !string.IsNullOrEmpty(emp.Empcod))
                    {
                        Utilisateur utilisateur = new Utilisateur()
                        {
                            Utiactif = "1",
                            Utiadm = "0",
                            Uticod = emp.Empcod,
                            Utinom = emp.Emplib,
                            Utimps = emp._plainCin ?? emp.Empcin,
                            Utimail = emp.Empemail,
                            Utirole = emp.Utirole ?? "Utilisateur Standard"
                        };
                        Socuser socuser = new Socuser()
                        {
                            Soccod = emp.Soccod,
                            Sitcod = emp.Sitcod,
                            Uticod = emp.Empcod,
                        };
                        try
                        {
                            await _utilisateurRepository.AddAsync(utilisateur, socuser);
                        }
                        catch
                        {
                            // Continue avec les autres comptes même si un échoue
                        }
                    }
                }
                
                return Ok(new { message = "Employés ajoutés avec succès. Les comptes ont été créés avec les numéros CIN comme mots de passe par défaut.", isValid = true });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de l'ajout d'employé", details = ex.Message });
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

                // Sync role to utilisateur table if provided
                if (!string.IsNullOrEmpty(employe.Utirole))
                {
                    await _utilisateurRepository.UpdateRoleAsync(employe.Empcod, employe.Utirole);
                }

                // Encrypt sensitive fields before updating
                employe.Empcin = _encryptionService.Encrypt(employe.Empcin);
                employe.Emptel = _encryptionService.Encrypt(employe.Emptel);
                employe.Empsbase = _encryptionService.Encrypt(employe.Empsbase);
                employe.Empsbrut = _encryptionService.Encrypt(employe.Empsbrut);
                employe.Empsnet = _encryptionService.Encrypt(employe.Empsnet);
                Employe addEmp = await _employeRepository.UpdateEmployeAsync(employe);
                // Decrypt for response
                addEmp.Empcin = _encryptionService.Decrypt(addEmp.Empcin);
                addEmp.Emptel = _encryptionService.Decrypt(addEmp.Emptel);
                addEmp.Empsbase = _encryptionService.Decrypt(addEmp.Empsbase);
                addEmp.Empsbrut = _encryptionService.Decrypt(addEmp.Empsbrut);
                addEmp.Empsnet = _encryptionService.Decrypt(addEmp.Empsnet);
                return Ok(new { message = "employé modifié avec succès", addEmp });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de la modification de l'employé", details = ex.Message });
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

                await _employeRepository.DeleteAsync(employe);

                return Ok(new { message="Employé supprimé avec succès" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = $"Erreur serveur : {ex.Message}" });
            }
        }
    }
}
