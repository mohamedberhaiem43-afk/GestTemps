using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Annotations.EmployeAttributes;
using ABRPOINT.Server.Services;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Helpers;
using ABRPOINT.Server.Tenancy;
using Microsoft.EntityFrameworkCore;

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
        private readonly ApplicationDbContext _db;
        private readonly IDbContextFactory<MasterDbContext> _masterFactory;
        private readonly ICurrentTenant _currentTenant;
        private readonly IEmailService _emailService;
        private readonly IConfiguration _configuration;
        private readonly ILogger<EmployesController> _log;
        public EmployesController(
            IEmployeRepository employeRepository,
            IReportsGenerationService reportsGenerationService,
            IUtilisateurRepository utilisateurRepository,
            EncryptionService encryptionService,
            ApplicationDbContext db,
            IDbContextFactory<MasterDbContext> masterFactory,
            ICurrentTenant currentTenant,
            IEmailService emailService,
            IConfiguration configuration,
            ILogger<EmployesController> log)
        {
            _employeRepository = employeRepository;
            _reportsGenerationService = reportsGenerationService;
            _utilisateurRepository = utilisateurRepository;
            _encryptionService = encryptionService;
            _db = db;
            _masterFactory = masterFactory;
            _currentTenant = currentTenant;
            _emailService = emailService;
            _configuration = configuration;
            _log = log;
        }

        private string BuildLoginUrl()
        {
            var rootDomain = _configuration["Hosting:RootDomain"] ?? "concorde.com";
            var slug = _currentTenant.Current?.Slug;
            return string.IsNullOrWhiteSpace(slug)
                ? $"https://{rootDomain}/login"
                : $"https://{slug}.{rootDomain}/login";
        }

        private async Task SendWelcomeEmailAsync(string toEmail, string fullName, string login, string password)
        {
            if (string.IsNullOrWhiteSpace(toEmail)) return;
            try
            {
                var loginUrl = BuildLoginUrl();
                var safeName = System.Net.WebUtility.HtmlEncode(string.IsNullOrWhiteSpace(fullName) ? login : fullName);
                var safeLogin = System.Net.WebUtility.HtmlEncode(login);
                var safePassword = System.Net.WebUtility.HtmlEncode(password);
                var safeEmail = System.Net.WebUtility.HtmlEncode(toEmail);

                var subject = "Bienvenue sur GestTemps — vos identifiants de connexion";
                var body =
                    $"<p>Bonjour {safeName},</p>" +
                    "<p>Votre compte collaborateur vient d'être créé sur la plateforme <strong>GestTemps</strong>.</p>" +
                    "<p>Voici vos informations de connexion :</p>" +
                    "<ul>" +
                    $"<li><strong>Email :</strong> {safeEmail}</li>" +
                    $"<li><strong>Identifiant :</strong> {safeLogin}</li>" +
                    $"<li><strong>Mot de passe provisoire :</strong> {safePassword}</li>" +
                    "</ul>" +
                    $"<p>Connectez-vous via le lien suivant : <a href=\"{loginUrl}\">{loginUrl}</a></p>" +
                    "<p>Pour des raisons de sécurité, nous vous recommandons de modifier votre mot de passe dès votre première connexion.</p>" +
                    "<p>Cordialement,<br/>L'équipe GestTemps</p>";

                await _emailService.SendEmailAsync(toEmail, subject, body);
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "Échec de l'envoi de l'email de bienvenue à {Email}", toEmail);
            }
        }

        /// <summary>
        /// Génère le prochain code employé en respectant le paramètre Parametre.Parmodemp.
        /// Si nom est fourni et le mode = "N", le préfixe sera basé sur le nom.
        /// </summary>
        [HttpGet("get-next-empcod/{soccod}")]
        public async Task<IActionResult> GetNextEmpcod(string soccod, [FromQuery] string? sitcod, [FromQuery] string? nom)
        {
            if (string.IsNullOrWhiteSpace(soccod)) return BadRequest(new { message = "soccod requis." });
            var sit = string.IsNullOrWhiteSpace(sitcod) ? "01" : sitcod;
            var next = await SequentialCodeGenerator.NextEmpcodAsync(_db, soccod, sit, nom);
            return Ok(new { empcod = next });
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
                    // Defense in depth : si une chaîne vide arrive sur un champ FK (cas
                    // typique : scan IA qui n'a pas extrait le code → reste ""), on la
                    // remet à null pour ne pas violer la contrainte FK avec une chaîne vide
                    // qui ne correspond à aucune ligne référencée.
                    employe.Foncod  = string.IsNullOrWhiteSpace(employe.Foncod)  ? null : employe.Foncod;
                    employe.Quacod  = string.IsNullOrWhiteSpace(employe.Quacod)  ? null : employe.Quacod;
                    employe.Dircod  = string.IsNullOrWhiteSpace(employe.Dircod)  ? null : employe.Dircod;
                    employe.Sercod  = string.IsNullOrWhiteSpace(employe.Sercod)  ? null : employe.Sercod;
                    employe.Seccod  = string.IsNullOrWhiteSpace(employe.Seccod)  ? null : employe.Seccod;
                    employe.Catcod  = string.IsNullOrWhiteSpace(employe.Catcod)  ? null : employe.Catcod;
                    employe.Natcod  = string.IsNullOrWhiteSpace(employe.Natcod)  ? null : employe.Natcod;
                    employe.Vilcod  = string.IsNullOrWhiteSpace(employe.Vilcod)  ? null : employe.Vilcod;

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

                        // Email de bienvenue avec identifiants — n'échoue jamais la requête.
                        await SendWelcomeEmailAsync(employe.Empemail, employe.Emplib, employe.Empcod, plainCin);

                        // ⚠ Sans cet upsert, l'employé fraîchement créé ne peut PAS se connecter :
                        // /Auth/lookup-tenant interroge la table master TenantEmailIndex pour
                        // résoudre le slug du tenant à partir de l'email saisi sur la page de
                        // login. Si l'email n'y figure pas → 404 "Aucun compte trouvé pour cet
                        // email". On l'ajoute donc en même temps que le compte utilisateur.
                        if (!string.IsNullOrWhiteSpace(employe.Empemail))
                        {
                            try
                            {
                                var slug = _currentTenant.Current?.Slug;
                                if (!string.IsNullOrWhiteSpace(slug))
                                {
                                    var emailLower = employe.Empemail.Trim().ToLowerInvariant();
                                    await using var master = await _masterFactory.CreateDbContextAsync();
                                    var existing = await master.TenantEmailIndex
                                        .FirstOrDefaultAsync(x => x.Email == emailLower);
                                    if (existing == null)
                                    {
                                        master.TenantEmailIndex.Add(new TenantEmailIndex
                                        {
                                            Email = emailLower,
                                            Slug = slug,
                                            CreatedAt = DateTime.UtcNow,
                                        });
                                        await master.SaveChangesAsync();
                                    }
                                    else if (!string.Equals(existing.Slug, slug, StringComparison.OrdinalIgnoreCase))
                                    {
                                        // Email déjà connu pour un autre tenant : on n'écrase pas
                                        // (un email est unique à un tenant) — on log l'incident pour
                                        // que l'admin puisse trancher.
                                        _log.LogWarning(
                                            "Email {Email} déjà mappé sur le tenant {OtherSlug} ; nouvelle création sur {Slug} ignorée pour le routage login.",
                                            emailLower, existing.Slug, slug);
                                    }
                                }
                            }
                            catch (Exception indexEx)
                            {
                                // Ne pas faire échouer la requête : l'employé existe déjà dans
                                // le tenant ; faute d'index, l'admin pourra toujours router le
                                // login à la main via le slug, mais l'utilisateur métier verra
                                // un "compte introuvable" jusqu'à correction.
                                _log.LogError(indexEx, "Échec d'écriture TenantEmailIndex pour {Email}", employe.Empemail);
                            }
                        }
                    }
                    catch (Exception userEx)
                    {
                        // Log the error but don't fail - employee was already saved successfully
                        _log.LogWarning(userEx, "Employé créé mais compte utilisateur échoué pour {Empcod}", employe.Empcod);
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
                            await SendWelcomeEmailAsync(emp.Empemail, emp.Emplib, emp.Empcod, emp._plainCin ?? string.Empty);
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
