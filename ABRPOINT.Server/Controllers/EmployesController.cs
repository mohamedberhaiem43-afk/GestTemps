using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Annotations.EmployeAttributes;
using ABRPOINT.Server.Billing;
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
        private readonly IBillingService _billing;
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
            IBillingService billing,
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
            _billing = billing;
            _log = log;
        }

        /// <summary>
        /// A9 — Empêche l'élévation de privilège via le champ <c>Empresp</c>.
        ///
        /// Auparavant, n'importe quel user avec CanAddEmploye/CanUpdateEmploye pouvait
        /// créer une fiche employé avec <c>Empresp = SON_PROPRE_UTICOD</c> et se voyait
        /// auto-promu Administrator par <c>PromoteToAdminAsync</c>. C'est une faille
        /// d'élévation classique : l'opération RH (créer un collaborateur) débloque un
        /// privilège système (admin), alors que les deux n'ont aucun rapport.
        ///
        /// On limite désormais l'auto-promotion à un appelant lui-même Administrator. Sans
        /// ce filtre, on bloque silencieusement la promotion (la fiche employé est créée
        /// normalement) — on log l'incident pour audit.
        /// </summary>
        private async Task<bool> CanAutoPromoteRespAsync()
        {
            var caller = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(caller)) return false;
            var u = await _db.Utilisateurs.AsNoTracking()
                .Where(x => x.Uticod == caller)
                .Select(x => new { x.Utiadm, x.Utirole })
                .FirstOrDefaultAsync();
            if (u == null) return false;
            return u.Utiadm == "1" || ABRPOINT.Server.Authorization.PermissionCatalog.IsAdminRole(u.Utirole);
        }

        private string BuildLoginUrl()
        {
            // On vise toujours le domaine racine : la page de login retrouve le tenant
            // à partir de l'email saisi (TenantEmailIndex). Le déploiement actuel n'a pas
            // de wildcard DNS pour les sous-domaines tenant.
            var rootDomain = _configuration["Hosting:RootDomain"] ?? "concorde.com";
            return $"https://{rootDomain}/login";
        }

        /// <summary>
        /// URL de la page publique de téléchargement de l'app mobile. La page propose
        /// iOS, Android et APK direct avec auto-détection de l'OS. À terme, le domaine
        /// canonique concordeworkly.com (redirection OVH) pointe ici aussi — mais on
        /// génère le lien sur RootDomain pour ne pas dépendre d'une redirection externe
        /// qui pourrait ne pas être active dans tous les environnements (staging, dev).
        /// </summary>
        private string BuildDownloadUrl()
        {
            var rootDomain = _configuration["Hosting:RootDomain"] ?? "concorde.com";
            return $"https://{rootDomain}/download";
        }

        /// <summary>
        /// Construit l'URL de définition de mot de passe à usage unique pour un nouvel
        /// employé. La page Login détecte le triplet ?setup=1&amp;email=…&amp;code=… et
        /// bascule directement sur l'étape « Définir mon mot de passe » avec email +
        /// code pré-remplis et verrouillés (cf. Login.tsx).
        /// </summary>
        private string BuildSetupPasswordUrl(string email, string token)
        {
            var rootDomain = _configuration["Hosting:RootDomain"] ?? "concorde.com";
            var encodedEmail = Uri.EscapeDataString(email ?? string.Empty);
            var encodedToken = Uri.EscapeDataString(token ?? string.Empty);
            return $"https://{rootDomain}/login?setup=1&email={encodedEmail}&code={encodedToken}";
        }

        /// <summary>
        /// Génère un token URL-safe de 32 octets (≈43 caractères en base64-url).
        /// Suffisamment long pour résister au brute-force pendant la fenêtre d'expiration
        /// de 7 jours, et stocké tel quel dans <c>Utilisateur.UtiResetCode</c> — le même
        /// champ que le code de réinitialisation classique, ce qui permet de réutiliser
        /// l'endpoint <c>/auth/reset-password</c> sans schéma additionnel.
        /// </summary>
        private static string GenerateSetupToken()
        {
            var bytes = new byte[32];
            System.Security.Cryptography.RandomNumberGenerator.Fill(bytes);
            return Convert.ToBase64String(bytes)
                .Replace('+', '-').Replace('/', '_').TrimEnd('=');
        }

        /// <summary>
        /// Mot de passe « placeholder » : valeur aléatoire stockée dans Utimps (qui sera
        /// hashée par <see cref="IUtilisateurRepository.AddAsync"/>) quand on ne dispose
        /// pas de CIN à utiliser comme MDP provisoire. L'employé ne le connaît jamais —
        /// il définira son vrai MDP via le lien de mise en place envoyé par email.
        /// </summary>
        private static string GenerateRandomPlaceholderPassword()
        {
            return Guid.NewGuid().ToString("N") + Guid.NewGuid().ToString("N");
        }

        private async Task SendWelcomeEmailAsync(string toEmail, string fullName, string login, string password)
        {
            if (string.IsNullOrWhiteSpace(toEmail)) return;
            try
            {
                var loginUrl = BuildLoginUrl();
                var displayName = string.IsNullOrWhiteSpace(fullName) ? login : fullName;
                var safeName = System.Net.WebUtility.HtmlEncode(displayName);
                var safeLogin = System.Net.WebUtility.HtmlEncode(login);
                var safePassword = System.Net.WebUtility.HtmlEncode(password);
                var safeEmail = System.Net.WebUtility.HtmlEncode(toEmail);

                var infoCard = Services.EmailTemplates.InfoCard(new Dictionary<string, string>
                {
                    ["Email"] = safeEmail,
                    ["Identifiant"] = safeLogin,
                    ["Mot de passe provisoire"] = $"<code style=\"background:#eef2ff;color:#1e3a8a;padding:2px 8px;border-radius:6px;font-size:13px;\">{safePassword}</code>",
                });

                var inner =
                    $"<p>Bonjour <strong>{safeName}</strong>,</p>" +
                    $"<p>Votre compte collaborateur vient d'être créé sur la plateforme <strong>{Services.EmailTemplates.BrandName}</strong>. Vous pouvez dès maintenant vous connecter pour consulter vos pointages, déposer vos demandes de congés et accéder à votre coffre-fort numérique.</p>" +
                    "<p style=\"margin-top:18px;font-size:13px;color:#475569;\">Vos informations de connexion :</p>" +
                    infoCard +
                    Services.EmailTemplates.Button("Accéder à mon espace", loginUrl) +
                    Services.EmailTemplates.StatusBanner(
                        "Conseil sécurité : changez votre mot de passe provisoire dès votre première connexion.",
                        Services.EmailTemplates.StatusKind.Warning) +
                    Services.EmailTemplates.MobileAppCard(BuildDownloadUrl()) +
                    "<p style=\"margin-top:24px;\">À très vite,<br/><strong>L'équipe Concorde Workforce</strong></p>";

                var subject = "Bienvenue sur Concorde Workforce — vos identifiants";
                var body = Services.EmailTemplates.Wrap(
                    title: $"Bienvenue, {displayName}",
                    preview: "Vos identifiants de connexion à Concorde Workforce",
                    innerHtml: inner);

                await _emailService.SendEmailAsync(toEmail, subject, body);
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "Échec de l'envoi de l'email de bienvenue à {Email}", toEmail);
            }
        }

        /// <summary>
        /// Vérifie qu'un email n'est pas déjà utilisé ailleurs dans le système.
        /// Double contrôle : (1) au sein du tenant courant via la table Employes, pour
        /// attraper les cas non encore propagés à TenantEmailIndex (notamment AddMultipleEmploye) ;
        /// (2) à travers tous les tenants via TenantEmailIndex, pour préserver l'invariant
        /// « 1 email = 1 compte » sur lequel s'appuie le routage du login.
        /// </summary>
        private async Task<bool> IsEmailUniqueAsync(string? email, string? excludeEmpcod = null)
        {
            if (string.IsNullOrWhiteSpace(email)) return true;
            var emailLower = email.Trim().ToLowerInvariant();

            var localTaken = await _db.Employes.AsNoTracking()
                .AnyAsync(e => e.Empemail != null
                    && e.Empemail.ToLower() == emailLower
                    && (excludeEmpcod == null || e.Empcod != excludeEmpcod));
            if (localTaken) return false;

            var slug = _currentTenant.Current?.Slug;
            await using var master = await _masterFactory.CreateDbContextAsync();
            var crossTenant = await master.TenantEmailIndex.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Email == emailLower);
            if (crossTenant != null && !string.Equals(crossTenant.Slug, slug, StringComparison.OrdinalIgnoreCase))
                return false;

            return true;
        }

        /// <summary>
        /// Upsert / suppression dans la table master TenantEmailIndex (mapping email → slug).
        /// Cette table sert au routing du login : l'email saisi sur la page de connexion racine
        /// est utilisé pour retrouver le slug du tenant. Sans cette synchro, un changement
        /// d'email côté employé casse le login pour ce collaborateur.
        /// </summary>
        private async Task UpsertTenantEmailIndexAsync(string? newEmail, string? oldEmail = null)
        {
            try
            {
                var slug = _currentTenant.Current?.Slug;
                if (string.IsNullOrWhiteSpace(slug)) return;

                await using var master = await _masterFactory.CreateDbContextAsync();
                var newLower = string.IsNullOrWhiteSpace(newEmail) ? null : newEmail.Trim().ToLowerInvariant();
                var oldLower = string.IsNullOrWhiteSpace(oldEmail) ? null : oldEmail.Trim().ToLowerInvariant();

                // Si l'email a changé, on retire l'ancien mapping (sauf s'il pointe sur un autre tenant).
                if (oldLower != null && oldLower != newLower)
                {
                    var oldRow = await master.TenantEmailIndex.FirstOrDefaultAsync(x => x.Email == oldLower);
                    if (oldRow != null && string.Equals(oldRow.Slug, slug, StringComparison.OrdinalIgnoreCase))
                    {
                        master.TenantEmailIndex.Remove(oldRow);
                    }
                }

                if (newLower != null)
                {
                    var existing = await master.TenantEmailIndex.FirstOrDefaultAsync(x => x.Email == newLower);
                    if (existing == null)
                    {
                        master.TenantEmailIndex.Add(new TenantEmailIndex
                        {
                            Email = newLower,
                            Slug = slug,
                            CreatedAt = DateTime.UtcNow,
                        });
                    }
                    else if (!string.Equals(existing.Slug, slug, StringComparison.OrdinalIgnoreCase))
                    {
                        // Email déjà mappé sur un autre tenant : on ne l'écrase pas.
                        _log.LogWarning(
                            "Email {Email} déjà mappé sur le tenant {OtherSlug} ; mise à jour sur {Slug} ignorée.",
                            newLower, existing.Slug, slug);
                    }
                }

                await master.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Échec d'écriture TenantEmailIndex pour {Email}", newEmail);
            }
        }

        /// <summary>
        /// Email de bienvenue alternatif quand aucun CIN n'a été saisi : l'employé ne
        /// reçoit pas un MDP provisoire (qui serait vide), mais un lien sécurisé pour
        /// définir lui-même son mot de passe. Token unique, expirant à 7 jours.
        /// </summary>
        private async Task SendSetupPasswordEmailAsync(string toEmail, string? fullName, string login, string setupUrl)
        {
            if (string.IsNullOrWhiteSpace(toEmail)) return;
            try
            {
                var displayName = string.IsNullOrWhiteSpace(fullName) ? login : fullName;
                var safeName = System.Net.WebUtility.HtmlEncode(displayName);
                var safeLogin = System.Net.WebUtility.HtmlEncode(login);
                var safeEmail = System.Net.WebUtility.HtmlEncode(toEmail);

                var infoCard = Services.EmailTemplates.InfoCard(new Dictionary<string, string>
                {
                    ["Email"] = safeEmail,
                    ["Identifiant"] = safeLogin,
                });

                var inner =
                    $"<p>Bonjour <strong>{safeName}</strong>,</p>" +
                    $"<p>Votre compte collaborateur vient d'être créé sur la plateforme <strong>{Services.EmailTemplates.BrandName}</strong>. Pour finaliser votre accès, choisissez votre propre mot de passe en cliquant sur le bouton ci-dessous.</p>" +
                    infoCard +
                    Services.EmailTemplates.Button("Définir mon mot de passe", setupUrl) +
                    Services.EmailTemplates.StatusBanner(
                        "Ce lien est personnel et expire dans 7 jours. Si vous n'êtes pas à l'origine de cette création, ignorez simplement cet email.",
                        Services.EmailTemplates.StatusKind.Warning) +
                    Services.EmailTemplates.MobileAppCard(BuildDownloadUrl()) +
                    "<p style=\"margin-top:24px;\">À très vite,<br/><strong>L'équipe Concorde Workforce</strong></p>";

                var subject = "Bienvenue sur Concorde Workforce — définissez votre mot de passe";
                var body = Services.EmailTemplates.Wrap(
                    title: $"Bienvenue, {displayName}",
                    preview: "Choisissez votre mot de passe pour accéder à Concorde Workforce",
                    innerHtml: inner);

                await _emailService.SendEmailAsync(toEmail, subject, body);
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "Échec de l'envoi de l'email de mise en place de mot de passe à {Email}", toEmail);
            }
        }

        private async Task SendEmailChangedNotificationAsync(string newEmail, string? oldEmail, string? fullName, string login)
        {
            if (string.IsNullOrWhiteSpace(newEmail)) return;
            try
            {
                var loginUrl = BuildLoginUrl();
                var displayName = string.IsNullOrWhiteSpace(fullName) ? login : fullName;
                var safeName = System.Net.WebUtility.HtmlEncode(displayName);
                var safeNew = System.Net.WebUtility.HtmlEncode(newEmail);
                var safeOld = System.Net.WebUtility.HtmlEncode(oldEmail ?? "(non renseignée)");
                var safeLogin = System.Net.WebUtility.HtmlEncode(login);

                var infoCard = Services.EmailTemplates.InfoCard(new Dictionary<string, string>
                {
                    ["Ancienne adresse"] = safeOld,
                    ["Nouvelle adresse"] = $"<strong>{safeNew}</strong>",
                    ["Identifiant"] = safeLogin,
                });

                var inner =
                    $"<p>Bonjour <strong>{safeName}</strong>,</p>" +
                    $"<p>L'adresse email associée à votre compte sur <strong>{Services.EmailTemplates.BrandName}</strong> vient d'être modifiée par votre administrateur.</p>" +
                    infoCard +
                    "<p>Vous devrez désormais utiliser cette nouvelle adresse pour vous connecter à votre espace.</p>" +
                    Services.EmailTemplates.Button("Se connecter", loginUrl) +
                    Services.EmailTemplates.StatusBanner(
                        "Si vous n'êtes pas à l'origine de cette modification, contactez immédiatement votre administrateur.",
                        Services.EmailTemplates.StatusKind.Error) +
                    "<p style=\"margin-top:24px;\">Cordialement,<br/><strong>L'équipe Concorde Workforce</strong></p>";

                var subject = "Concorde Workforce — Mise à jour de votre adresse email";
                var body = Services.EmailTemplates.Wrap(
                    title: "Adresse email modifiée",
                    preview: $"Votre nouvelle adresse de connexion : {newEmail}",
                    innerHtml: inner);

                await _emailService.SendEmailAsync(newEmail, subject, body);
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "Échec de l'envoi de l'email de changement d'adresse à {Email}", newEmail);
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
                // Déchiffrement des champs sensibles avant retour à l'UI. Avant : la liste
                // renvoyait Empcin/Emptel en Base64 chiffré tel que stocké en base, ce qui
                // s'affichait dans la fiche collaborateur comme une chaîne illisible
                // (« BASE64+/=… »). Aligné sur get-employe/{empcod} (vue détail).
                // Le DTO de liste n'expose pas les salaires (Empsbase/Empsbrut/Empsnet) —
                // ils ne sont décryptés que dans la vue détail où ils sont effectivement
                // affichés.
                if (employees != null)
                {
                    foreach (var emp in employees)
                    {
                        if (emp == null) continue;
                        emp.Empcin = _encryptionService.Decrypt(emp.Empcin);
                        emp.Emptel = _encryptionService.Decrypt(emp.Emptel);
                    }
                }
                return Ok(employees);
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Employes.Get — échec récupération liste pour Soccod={Soccod} Uticod={Uticod}", soccod, uticod);
                return StatusCode(500, new { message = "Erreur lors de la récupération des employés", details = "Erreur interne. Consultez les logs serveur pour le détail." });
            }
        }
        // A11 — `get-my-kpis` est un endpoint self-service. Avant : l'`uticod` venait
        // de l'URL et n'était pas comparé au JWT, donc n'importe quel user pouvait
        // consulter les KPI d'un autre. On force désormais l'alignement (sauf admin/manager).
        [HttpGet("get-my-kpis/{soccod}/{uticod}")]
        public async Task<IActionResult> GetMyKPIs(string soccod, string uticod)
        {
            try
            {
                var caller = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(caller)) return Unauthorized();
                if (!string.Equals(caller, uticod, StringComparison.OrdinalIgnoreCase))
                {
                    var isPrivileged = await _db.Utilisateurs.AsNoTracking()
                        .Where(u => u.Uticod == caller)
                        .Select(u => u.Utiadm == "1" || ABRPOINT.Server.Authorization.PermissionCatalog.IsAdminRole(u.Utirole))
                        .FirstOrDefaultAsync();
                    if (!isPrivileged) return Forbid();
                }

                var employees = await _employeRepository.GetMyKPIs(soccod, uticod);
                return Ok(employees);
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Échec GetMyKPIs soccod={Soccod} uticod={Uticod}", soccod, uticod);
                return StatusCode(500, new { message = "Erreur lors de la récupération des KPIs." });
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

        // Variante self-service : un employé peut consulter SES propres horaires sans
        // l'attribut [CanGetEmploye] (qui exige le droit "Gestion Employés"). Le JWT
        // mobile stocke l'uticod (= empcod côté employé) dans NameIdentifier, donc on
        // compare l'empcod de la route avec ce claim pour bloquer la consultation
        // d'horaires d'un autre collaborateur.
        [HttpGet("get-my-horaires/{soccod}/{empcod}")]
        public async Task<IActionResult> GetMyHoraires(string soccod, string empcod)
        {
            try
            {
                var callerUticod = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(callerUticod) || !string.Equals(callerUticod, empcod, StringComparison.OrdinalIgnoreCase))
                {
                    return Forbid();
                }
                var empHoraires = await _employeRepository.GetEmployesHoraire(soccod, empcod);
                return Ok(empHoraires);
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

                    // Champs joints pour la fiche collaborateur (vue lecture seule) :
                    //   - Utiimg  : avatar du compte lié (Empcod == Uticod)
                    //   - Villib  : libellé ville résolu depuis le code Vilcod
                    // Volontairement deux sous-requêtes simples plutôt qu'un Include() :
                    // les tables `utilisateur` et `ville` n'ont pas de FK formelle vers
                    // Employe (clé composite legacy), donc EF Core ne peut pas générer
                    // un join automatique propre.
                    employe.Utiimg = await _db.Utilisateurs
                        .AsNoTracking()
                        .Where(u => u.Uticod == empcod)
                        .Select(u => u.Utiimg)
                        .FirstOrDefaultAsync();
                    if (!string.IsNullOrEmpty(employe.Vilcod))
                    {
                        employe.Villib = await _db.Villes
                            .AsNoTracking()
                            .Where(v => v.Vilcod == employe.Vilcod)
                            .Select(v => v.Villib)
                            .FirstOrDefaultAsync();
                    }

                    // Fonction : Empfonc est un libellé libre saisi à la création. Si Foncod
                    // (FK vers la table Fonction) est renseigné, on résout le Fonlib pour que
                    // la fiche puisse afficher "Chargée marketing" plutôt que "MKT01".
                    //
                    // ⚠ On expose le libellé via la propriété [NotMapped] `Fonlib` ; on NE
                    // touche PAS à `Empfonc` (varchar(40)). Précédemment on écrasait Empfonc
                    // avec ce libellé, mais Fonction.Fonlib peut atteindre 100 caractères :
                    // le formulaire d'édition renvoyait ensuite cette longue chaîne dans le
                    // PUT, qui échouait avec un 400 StringLength sur Empfonc — l'utilisateur
                    // ne pouvait plus rien sauvegarder sur la fiche.
                    if (!string.IsNullOrWhiteSpace(employe.Foncod))
                    {
                        employe.Fonlib = await _db.Fonctions
                            .AsNoTracking()
                            .Where(f => f.Soccod == soccod && f.Foncod == employe.Foncod)
                            .Select(f => f.Fonlib)
                            .FirstOrDefaultAsync();
                    }

                    // Manager : Empresp stocke l'Empcod du responsable, pas son nom. On
                    // expose le nom dans `Resplib` ([NotMapped]) pour que la fiche affiche
                    // "Jean Dupont" tout en gardant `Empresp` égal à l'Empcod brut.
                    //
                    // ⚠ Même raison que pour Fonlib : Empresp est varchar(12), Emplib est
                    // varchar(100). Écraser Empresp avec le nom du manager faisait sauter la
                    // validation côté PUT (StringLength) et bloquait toute modification de la
                    // fiche dès qu'un manager était assigné avec un nom > 12 caractères.
                    if (!string.IsNullOrWhiteSpace(employe.Empresp))
                    {
                        employe.Resplib = await _db.Employes
                            .AsNoTracking()
                            .Where(e => e.Soccod == soccod && e.Empcod == employe.Empresp)
                            .Select(e => e.Emplib)
                            .FirstOrDefaultAsync();
                    }
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
            return BuildDocumentResponse(
                () => _reportsGenerationService.GenerateAttestationTravailReport(soccod, empcod),
                fileName: $"Attestation_Travail_{empcod}.pdf",
                docLabel: "AttestationTravail",
                soccod: soccod, empcod: empcod);
        }

        [HttpGet("get-certificat-travail/{soccod}/{empcod}")]
        [CanGetEmploye]
        public IActionResult GenerateCertificatTravailReport(string soccod, string empcod)
        {
            return BuildDocumentResponse(
                () => _reportsGenerationService.GenerateCertificatTravailReport(soccod, empcod),
                fileName: $"Certificat_Travail_{empcod}.pdf",
                docLabel: "CertificatTravail",
                soccod: soccod, empcod: empcod);
        }

        [HttpGet("get-attestation-salaire/{soccod}/{empcod}")]
        [CanGetEmploye]
        public IActionResult GenerateAttestationSalaireReport(string soccod, string empcod)
        {
            return BuildDocumentResponse(
                () => _reportsGenerationService.GenerateAttestationSalaireReport(soccod, empcod),
                fileName: $"Attestation_Salaire_{empcod}.pdf",
                docLabel: "AttestationSalaire",
                soccod: soccod, empcod: empcod);
        }

        /// <summary>
        /// Pipeline commun de génération d'un document RH (attestation, certificat).
        /// Centralise le try/catch pour éviter trois copies identiques et — surtout —
        /// pour LOGGER l'exception au lieu de la swallow comme avant (les 500
        /// observés en prod ne laissaient aucune trace côté logs, impossible à
        /// diagnostiquer). Distingue deux cas :
        ///   - « Modèle introuvable… » (FileNotFoundException déguisée par le service
        ///     en Exception standard) → 404 explicite, c'est un défaut de déploiement
        ///     (template HTML/FRX manquant dans VaultTemplates ou Reports), pas un
        ///     bug runtime. Le front affiche un message exploitable au lieu d'un 500
        ///     opaque qui pousse l'utilisateur à re-cliquer en boucle.
        ///   - Toute autre exception → 500 avec le message racine (Empty/null deref
        ///     sur un champ employé manquant, échec de rendu FastReport, etc.).
        /// </summary>
        private IActionResult BuildDocumentResponse(Func<byte[]> generate, string fileName, string docLabel, string soccod, string empcod)
        {
            try
            {
                byte[] pdfBytes = generate();
                return File(pdfBytes, "application/pdf", fileName);
            }
            catch (Exception ex)
            {
                // ReportsGenerationService re-emballe systématiquement l'exception interne :
                // on remonte la chaîne pour récupérer le message racine (sinon on lit
                // « Erreur lors de la génération de X : Modèle introuvable… »).
                var root = ex;
                while (root.InnerException != null) root = root.InnerException;
                var rootMsg = root.Message ?? string.Empty;

                _log.LogError(ex, "Échec génération document {DocLabel} pour Soccod={Soccod} Empcod={Empcod} : {RootMessage}",
                    docLabel, soccod, empcod, rootMsg);

                // Template absent du déploiement (cas observé : CertificatTravail.html
                // et AttestationSalaire.html non livrés) → 404 avec message clair.
                if (rootMsg.Contains("Modèle introuvable", StringComparison.OrdinalIgnoreCase)
                    || root is FileNotFoundException)
                {
                    return NotFound(new { message = $"Le modèle « {docLabel} » n'est pas configuré pour cette société. Contactez l'administrateur." });
                }

                return StatusCode(500, new { message = $"Erreur lors de la génération du document : {rootMsg}" });
            }
        }

        // POST api/employes
        // Paramètre confirmOverage : opt-in explicite côté admin pour facturer un
        // collaborateur supplémentaire au-delà du seuil inclus dans le pack. La fiche
        // collaborateur côté front intercepte le 402 "employee_quota_exceeded" et
        // re-soumet avec ?confirmOverage=true après confirmation par l'utilisateur.
        [HttpPost]
        [CanAddEmploye]
        public async Task<IActionResult> Post([FromBody] Employe employe, [FromQuery] bool confirmOverage = false)
        {
            try
            {
                // Quota collaborateurs : cap au seuil inclus du pack courant.
                // Trial → cap dur, pas d'overage possible (admin doit d'abord passer payant).
                // Plan payant → opt-in via confirmOverage qui débloque la facturation
                //              automatique du supplément via l'item Stripe user_supp.
                var tenant = _currentTenant.Current;
                var plan = PlanCatalog.GetPlan(tenant?.PlanCode) ?? PlanCatalog.Starter;
                var activeCount = await _db.Employes.CountAsync(e => e.Actif == "A");

                // Plafond ABSOLU du pack (Starter 30 / Standard 100 / Premium 200) :
                // au-delà, l'admin doit upgrader. Pas d'opt-in possible : l'overage
                // tolérable s'arrête au cap commercial du pack courant.
                if (PlanCatalog.WouldExceedPlanMax(plan, activeCount))
                {
                    return StatusCode(402, new
                    {
                        code = "plan_max_employees_reached",
                        message = $"Vous avez atteint le plafond du pack {plan.DisplayName} ({plan.MaxEmployees} collaborateurs maximum). " +
                                  $"Pour ajouter d'autres collaborateurs, passez au pack supérieur ou contactez-nous pour une offre Enterprise.",
                        currentCount = activeCount,
                        planMax = plan.MaxEmployees,
                        planCode = plan.Code,
                        planName = plan.DisplayName,
                        requiresUpgrade = true,
                    });
                }

                if (PlanCatalog.IsOverIncludedCapacity(plan, activeCount))
                {
                    var isTrialing = ABRPOINT.Server.Tenancy.TrialPolicy.IsTrialing(tenant);
                    if (isTrialing)
                    {
                        return StatusCode(402, new
                        {
                            code = "trial_employee_limit_reached",
                            message = $"Limite de l'essai gratuit atteinte ({plan.IncludedEmployees} collaborateurs maximum). Souscrivez à un plan payant pour ajouter des collaborateurs supplémentaires.",
                            currentCount = activeCount,
                            includedMax = plan.IncludedEmployees,
                            planCode = plan.Code,
                        });
                    }
                    if (!confirmOverage)
                    {
                        return StatusCode(402, new
                        {
                            code = "employee_quota_exceeded",
                            message = $"Vous avez atteint le quota de {plan.IncludedEmployees} collaborateurs inclus dans le pack {plan.DisplayName}. " +
                                      $"Ajouter ce collaborateur facturera {plan.OverageRatePerEmployeeEur:0.00} €/mois en supplément (proration appliquée sur la prochaine facture).",
                            currentCount = activeCount,
                            includedMax = plan.IncludedEmployees,
                            planCode = plan.Code,
                            planName = plan.DisplayName,
                            overageRateEur = plan.OverageRatePerEmployeeEur,
                            requiresConfirmation = true,
                        });
                    }
                }

                if(employe != null && !string.IsNullOrEmpty(employe.Empcod))
                {
                    // Unicité de l'email : tous tenants confondus. Refusé même au sein
                    // du tenant courant, car le couple (Uticod, email) doit rester 1-1.
                    if (!await IsEmailUniqueAsync(employe.Empemail))
                    {
                        return Conflict(new { message = "Cet email est déjà utilisé par un autre compte." });
                    }

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
                    // Si l'admin n'a pas saisi de CIN, on bascule en mode « setup link » :
                    // pas de MDP provisoire dans l'email (qui serait vide), à la place un
                    // lien unique pour que l'employé définisse lui-même son mot de passe.
                    var hasCin = !string.IsNullOrWhiteSpace(plainCin);
                    string? setupToken = null;
                    string passwordToHash;
                    if (hasCin)
                    {
                        passwordToHash = plainCin;
                    }
                    else
                    {
                        setupToken = GenerateSetupToken();
                        // Placeholder : la valeur n'est jamais communiquée à l'employé,
                        // elle sert juste à ce que le hash BCrypt soit non trivial.
                        passwordToHash = GenerateRandomPlaceholderPassword();
                    }
                    // Encrypt sensitive fields before saving
                    employe.Empcin = _encryptionService.Encrypt(employe.Empcin);
                    employe.Emptel = _encryptionService.Encrypt(employe.Emptel);
                    employe.Empsbase = _encryptionService.Encrypt(employe.Empsbase);
                    employe.Empsbrut = _encryptionService.Encrypt(employe.Empsbrut);
                    employe.Empsnet = _encryptionService.Encrypt(employe.Empsnet);
                    await _employeRepository.AddAsync(employe);

                    // Auto-promotion : même règle que dans Put (cf. commentaire là-bas) —
                    // l'utilisateur désigné comme Empresp passe automatiquement à Administrator.
                    // A9 — Limite la promotion à un appelant lui-même admin (cf. CanAutoPromoteRespAsync).
                    if (!string.IsNullOrWhiteSpace(employe.Empresp))
                    {
                        if (await CanAutoPromoteRespAsync())
                        {
                            await _utilisateurRepository.PromoteToAdminAsync(employe.Empresp);
                        }
                        else
                        {
                            _log.LogWarning("Auto-promotion Empresp ignorée : appelant non-admin. soccod={Soccod} empresp={Empresp}", employe.Soccod, employe.Empresp);
                        }
                    }
                    
                    // Try to create user account - don't fail the whole request if user creation fails
                    try
                    {
                        Utilisateur utilisateur = new Utilisateur()
                        {
                            Utiactif = "1",
                            Utiadm = "0",
                            Uticod = employe.Empcod,
                            Utinom = employe.Emplib,
                            Utimps = passwordToHash,
                            Utimail = employe.Empemail,
                            // Si aucun rôle n'a été choisi par l'utilisateur RH lors de la création
                            // du collaborateur, on retombe sur le rôle système "Employee" (= rôle
                            // employé : consultation de son propre dossier uniquement).
                            Utirole = string.IsNullOrWhiteSpace(employe.Utirole)
                                ? Authorization.PermissionCatalog.Roles.Employee
                                : employe.Utirole
                        };
                        Socuser socuser = new Socuser()
                        {
                            Soccod = employe.Soccod,
                            Sitcod = employe.Sitcod,
                            Uticod = employe.Empcod,
                        };
                        await _utilisateurRepository.AddAsync(utilisateur, socuser);

                        // Mode « setup link » : on persiste le token sur la ligne juste créée.
                        // Réutilise UtiResetCode/UtiResetCodeExpiry, ce qui permet à
                        // /auth/reset-password de valider le token sans schéma additionnel.
                        if (setupToken != null)
                        {
                            try
                            {
                                var freshUser = await _db.Utilisateurs.FirstOrDefaultAsync(u => u.Uticod == employe.Empcod);
                                if (freshUser != null)
                                {
                                    freshUser.UtiResetCode = setupToken;
                                    freshUser.UtiResetCodeExpiry = DateTime.UtcNow.AddDays(7);
                                    await _db.SaveChangesAsync();
                                }
                            }
                            catch (Exception tokEx)
                            {
                                _log.LogWarning(tokEx, "Échec de la persistance du token de mise en place pour {Empcod}", employe.Empcod);
                                setupToken = null; // on retombe sur l'email classique en cas d'échec
                            }
                        }

                        // Email de bienvenue : version « setup link » si pas de CIN, sinon
                        // version classique avec MDP provisoire.
                        if (setupToken != null && !string.IsNullOrWhiteSpace(employe.Empemail))
                        {
                            var setupUrl = BuildSetupPasswordUrl(employe.Empemail, setupToken);
                            await SendSetupPasswordEmailAsync(employe.Empemail, employe.Emplib, employe.Empcod, setupUrl);
                        }
                        else
                        {
                            await SendWelcomeEmailAsync(employe.Empemail, employe.Emplib, employe.Empcod, plainCin);
                        }

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

                    // Sync Stripe user_supp quantity sur la subscription du tenant. Idempotent
                    // côté StripeBillingService : ne push que si la quantité change. Best-effort —
                    // un échec Stripe (price non configuré, réseau, etc.) ne fait pas échouer
                    // la création du collab (qui est déjà commit en DB), le job journalier
                    // EmployeeBillingSyncService rattrapera. On capture activeCount+1 car le
                    // nouveau collab vient d'être ajouté (.Actif="A" par défaut côté repo).
                    if (_currentTenant.Current is { } currentTenant)
                    {
                        try
                        {
                            var freshCount = await _db.Employes.CountAsync(e => e.Actif == "A");
                            await _billing.SyncSupplementaryEmployeesAsync(currentTenant, freshCount, HttpContext.RequestAborted);
                        }
                        catch (Exception billEx)
                        {
                            _log.LogWarning(billEx,
                                "Sync user_supp Stripe échoué pour tenant {Slug} après création de {Empcod} ; le job journalier rattrapera.",
                                currentTenant.Slug, employe.Empcod);
                        }
                    }

                    return Ok(new { message = "Employé ajouté avec succès" });
                }
                    return BadRequest(new { message = "Veuillez remplir les champs obligatoires" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de l'ajout d'employé", details = "Erreur interne. Consultez les logs serveur pour le détail." });
            }
        }
        [HttpPut]
        [CanUpdatetEmploye]
        public async Task<IActionResult> AddMultipleEmploye([FromBody] List<Employe> employe)
        {
            try
            {
                // Détection des doublons intra-lot : un import qui contient deux fois le même
                // email passerait la vérification cross-tenant (un seul est encore en base au
                // moment du check) puis violerait l'unicité au commit.
                var intraDup = (employe ?? new List<Employe>())
                    .Where(e => !string.IsNullOrWhiteSpace(e?.Empemail))
                    .GroupBy(e => e!.Empemail!.Trim().ToLowerInvariant())
                    .FirstOrDefault(g => g.Count() > 1);
                if (intraDup != null)
                {
                    return Conflict(new { message = $"L'email '{intraDup.Key}' apparaît plusieurs fois dans l'import." });
                }

                // Unicité globale pour chaque ligne. On s'arrête au premier conflit pour
                // remonter un message exploitable côté UI plutôt qu'un commit partiel.
                foreach (var emp in employe ?? new List<Employe>())
                {
                    if (emp != null && !await IsEmailUniqueAsync(emp.Empemail, excludeEmpcod: emp.Empcod))
                    {
                        return Conflict(new { message = $"L'email '{emp.Empemail}' est déjà utilisé par un autre compte." });
                    }
                }

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

                // Auto-promotion : pour chaque collaborateur importé qui désigne un
                // Empresp, on promeut le user correspondant en Administrator.
                // On dédoublonne pour ne pas faire 50 updates si tous pointent vers
                // le même responsable.
                var responsableUticods = employe
                    .Where(e => !string.IsNullOrWhiteSpace(e?.Empresp))
                    .Select(e => e!.Empresp!)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();
                // A9 — bulk auto-promotion uniquement si l'appelant est admin.
                if (responsableUticods.Count > 0 && await CanAutoPromoteRespAsync())
                {
                    foreach (var respUticod in responsableUticods)
                    {
                        await _utilisateurRepository.PromoteToAdminAsync(respUticod);
                    }
                }
                else if (responsableUticods.Count > 0)
                {
                    _log.LogWarning("Bulk auto-promotion Empresp ignorée : appelant non-admin. count={Count}", responsableUticods.Count);
                }

                // Créer les comptes utilisateurs pour chaque employé
                foreach (var emp in employe)
                {
                    if (emp != null && !string.IsNullOrEmpty(emp.Empcod))
                    {
                        // Mode setup-link si pas de CIN — cf. POST single pour le détail.
                        var hasCin = !string.IsNullOrWhiteSpace(emp._plainCin);
                        string? setupToken = null;
                        string passwordToHash;
                        if (hasCin)
                        {
                            passwordToHash = emp._plainCin!;
                        }
                        else
                        {
                            setupToken = GenerateSetupToken();
                            passwordToHash = GenerateRandomPlaceholderPassword();
                        }

                        Utilisateur utilisateur = new Utilisateur()
                        {
                            Utiactif = "1",
                            Utiadm = "0",
                            Uticod = emp.Empcod,
                            Utinom = emp.Emplib,
                            Utimps = passwordToHash,
                            Utimail = emp.Empemail,
                            // Rôle système "Employee" par défaut (cf. POST single ci-dessus).
                            Utirole = string.IsNullOrWhiteSpace(emp.Utirole)
                                ? Authorization.PermissionCatalog.Roles.Employee
                                : emp.Utirole
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
                            if (setupToken != null)
                            {
                                try
                                {
                                    var freshUser = await _db.Utilisateurs.FirstOrDefaultAsync(u => u.Uticod == emp.Empcod);
                                    if (freshUser != null)
                                    {
                                        freshUser.UtiResetCode = setupToken;
                                        freshUser.UtiResetCodeExpiry = DateTime.UtcNow.AddDays(7);
                                        await _db.SaveChangesAsync();
                                    }
                                }
                                catch (Exception tokEx)
                                {
                                    _log.LogWarning(tokEx, "Échec persistance token setup pour {Empcod}", emp.Empcod);
                                    setupToken = null;
                                }
                            }
                            if (setupToken != null && !string.IsNullOrWhiteSpace(emp.Empemail))
                            {
                                var setupUrl = BuildSetupPasswordUrl(emp.Empemail, setupToken);
                                await SendSetupPasswordEmailAsync(emp.Empemail, emp.Emplib, emp.Empcod, setupUrl);
                            }
                            else
                            {
                                await SendWelcomeEmailAsync(emp.Empemail, emp.Emplib, emp.Empcod, emp._plainCin ?? string.Empty);
                            }
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
                return StatusCode(500, new { message = "Erreur lors de l'ajout d'employé", details = "Erreur interne. Consultez les logs serveur pour le détail." });
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

                // Unicité de l'email : on exclut l'employé courant pour autoriser un PUT
                // qui ne change pas l'email (ou autre champ) sans déclencher un faux positif.
                if (!await IsEmailUniqueAsync(employe.Empemail, excludeEmpcod: employe.Empcod))
                {
                    return Conflict(new { message = "Cet email est déjà utilisé par un autre compte." });
                }

                // Sync role to utilisateur table if provided
                if (!string.IsNullOrEmpty(employe.Utirole))
                {
                    await _utilisateurRepository.UpdateRoleAsync(employe.Empcod, employe.Utirole);
                }

                // Auto-promotion : dès qu'un utilisateur est désigné comme Empresp
                // d'un employé, il prend en charge la responsabilité RH d'au moins
                // un collaborateur — on bascule donc son rôle de "Responsable RH"
                // (rôle par défaut au signup) vers "Administrator" pour qu'il dispose
                // des droits d'administration système. Idempotent si déjà admin.
                // A9 — Restreint au cas où l'appelant est lui-même admin.
                if (!string.IsNullOrWhiteSpace(employe.Empresp))
                {
                    if (await CanAutoPromoteRespAsync())
                    {
                        await _utilisateurRepository.PromoteToAdminAsync(employe.Empresp);
                    }
                    else
                    {
                        _log.LogWarning("Auto-promotion Empresp ignorée (Put) : appelant non-admin. soccod={Soccod} empresp={Empresp}", employe.Soccod, employe.Empresp);
                    }
                }

                // Lit l'email avant update pour détecter un changement et notifier le collaborateur.
                var oldEmail = await _db.Employes
                    .Where(e => e.Empcod == employe.Empcod
                        && e.Soccod == employe.Soccod
                        && e.Sitcod == employe.Sitcod)
                    .Select(e => e.Empemail)
                    .FirstOrDefaultAsync();

                // Encrypt sensitive fields before updating
                employe.Empcin = _encryptionService.Encrypt(employe.Empcin);
                employe.Emptel = _encryptionService.Encrypt(employe.Emptel);
                employe.Empsbase = _encryptionService.Encrypt(employe.Empsbase);
                employe.Empsbrut = _encryptionService.Encrypt(employe.Empsbrut);
                employe.Empsnet = _encryptionService.Encrypt(employe.Empsnet);
                Employe addEmp = await _employeRepository.UpdateEmployeAsync(employe);

                // Notification email + sync TenantEmailIndex si l'adresse a changé.
                // N'échoue jamais la requête.
                var newEmail = employe.Empemail?.Trim();
                if (!string.Equals(newEmail, oldEmail?.Trim(), StringComparison.OrdinalIgnoreCase))
                {
                    await UpsertTenantEmailIndexAsync(newEmail, oldEmail);
                    if (!string.IsNullOrWhiteSpace(newEmail))
                    {
                        await SendEmailChangedNotificationAsync(newEmail, oldEmail, employe.Emplib, employe.Empcod);
                    }
                }

                // Decrypt for response
                addEmp.Empcin = _encryptionService.Decrypt(addEmp.Empcin);
                addEmp.Emptel = _encryptionService.Decrypt(addEmp.Emptel);
                addEmp.Empsbase = _encryptionService.Decrypt(addEmp.Empsbase);
                addEmp.Empsbrut = _encryptionService.Decrypt(addEmp.Empsbrut);
                addEmp.Empsnet = _encryptionService.Decrypt(addEmp.Empsnet);
                return Ok(new { message = "employé modifié avec succès", addEmp });
            }
            catch (KeyNotFoundException ex)
            {
                // La ligne (Soccod, Sitcod, Empcod) n'existe pas : 404 explicite plutôt que
                // 500, pour que le frontend affiche un message clair au lieu d'un faux succès.
                return NotFound(new { message = "Erreur interne. Consultez les logs serveur pour le détail." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de la modification de l'employé", details = "Erreur interne. Consultez les logs serveur pour le détail." });
            }
        }

        /// <summary>
        /// Self-service : permet à un employé de mettre à jour SES propres
        /// coordonnées (téléphone, mobile, adresse, email) depuis le mobile,
        /// sans passer par les RH. Whitelist explicite pour empêcher toute
        /// modification de Empfonc/Sercod/Sitcod/salaires/Empemb/etc.
        /// </summary>
        [HttpPut("update-my-contact")]
        public async Task<IActionResult> UpdateMyContact([FromBody] UpdateMyContactDto dto)
        {
            try
            {
                if (dto == null || string.IsNullOrWhiteSpace(dto.Soccod) || string.IsNullOrWhiteSpace(dto.Empcod))
                    return BadRequest(new { message = "Soccod et empcod requis" });

                // Le JWT mobile stocke l'uticod (= empcod côté employé) dans NameIdentifier.
                // On exige une correspondance stricte pour bloquer toute modification d'un autre profil.
                var callerUticod = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(callerUticod) || !string.Equals(callerUticod, dto.Empcod, StringComparison.OrdinalIgnoreCase))
                {
                    return Forbid();
                }

                var employe = await _db.Employes
                    .FirstOrDefaultAsync(e => e.Soccod == dto.Soccod && e.Empcod == dto.Empcod);
                if (employe == null) return NotFound(new { message = "Employé introuvable." });

                // Unicité de l'email (en excluant l'employé courant) — si changement.
                var newEmail = dto.Empemail?.Trim();
                var oldEmail = employe.Empemail?.Trim();
                if (!string.IsNullOrWhiteSpace(newEmail)
                    && !string.Equals(newEmail, oldEmail, StringComparison.OrdinalIgnoreCase)
                    && !await IsEmailUniqueAsync(newEmail, excludeEmpcod: employe.Empcod))
                {
                    return Conflict(new { message = "Cet email est déjà utilisé par un autre compte." });
                }

                // Whitelist : coordonnées + état civil + identité (arabe). Le téléphone
                // est chiffré en BD (cf. update-employe), on conserve la même politique.
                // VOLONTAIREMENT exclus : Foncod, Empfonc, Sercod, Sitcod, Soccod, Empemb,
                // Empsbase, Empsbrut, Empsnet, Empcin (sensible — réservé RH).
                if (dto.Emptel != null) employe.Emptel = _encryptionService.Encrypt(dto.Emptel);
                if (dto.Empmob != null) employe.Empmob = dto.Empmob;
                if (dto.Empadr != null) employe.Empadr = dto.Empadr;
                if (dto.Vilcod != null) employe.Vilcod = dto.Vilcod;
                if (newEmail != null) employe.Empemail = newEmail;

                // État civil — validation légère ; les codes inconnus passent (les
                // dropdowns mobiles imposent déjà des valeurs valides).
                if (dto.Empsexe != null)
                {
                    var sexe = dto.Empsexe.Trim().ToUpperInvariant();
                    if (sexe == "M" || sexe == "F" || sexe == "") employe.Empsexe = sexe;
                }
                if (dto.Empsitfam != null)
                {
                    var sf = dto.Empsitfam.Trim().ToUpperInvariant();
                    if (sf == "C" || sf == "M" || sf == "D" || sf == "V" || sf == "") employe.Empsitfam = sf;
                }
                if (dto.Empnbp.HasValue && dto.Empnbp.Value >= 0 && dto.Empnbp.Value <= 30)
                    employe.Empnbp = dto.Empnbp.Value;
                if (dto.Empdnais != null) employe.Empdnais = dto.Empdnais.Trim();
                if (dto.Emplnais != null) employe.Emplnais = dto.Emplnais.Trim();
                if (dto.Natcod != null) employe.Natcod = dto.Natcod.Trim();

                // Identité arabe
                if (dto.Emplibar != null) employe.Emplibar = dto.Emplibar;
                if (dto.Empadrar != null) employe.Empadrar = dto.Empadrar;

                await _db.SaveChangesAsync();

                // Sync TenantEmailIndex + notification email si l'adresse a changé.
                if (newEmail != null && !string.Equals(newEmail, oldEmail, StringComparison.OrdinalIgnoreCase))
                {
                    await UpsertTenantEmailIndexAsync(newEmail, oldEmail);
                    if (!string.IsNullOrWhiteSpace(newEmail))
                    {
                        await SendEmailChangedNotificationAsync(newEmail, oldEmail, employe.Emplib, employe.Empcod);
                    }
                }

                return Ok(new { message = "Coordonnées mises à jour" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de la mise à jour des coordonnées", details = "Erreur interne. Consultez les logs serveur pour le détail." });
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

                // On capture l'email avant suppression pour nettoyer le master TenantEmailIndex.
                var oldEmail = employe.Empemail;

                // Nettoyage des dépendances : sans ça, l'Empcod est libéré dans la table Employes
                // mais Utilisateur(Uticod=Empcod) / Socuser / Modusers restent orphelins. Le prochain
                // employé créé par le séquentiel réutilise le même code et collisionne avec ces orphelins.
                var modusers = await _db.Modusers.Where(m => m.Uticod == empcod).ToListAsync();
                if (modusers.Count > 0) _db.Modusers.RemoveRange(modusers);

                var socusers = await _db.Socusers
                    .Where(s => s.Uticod == empcod && s.Soccod == soccod)
                    .ToListAsync();
                if (socusers.Count > 0) _db.Socusers.RemoveRange(socusers);

                var utilisateur = await _db.Utilisateurs.FirstOrDefaultAsync(u => u.Uticod == empcod);
                if (utilisateur != null) _db.Utilisateurs.Remove(utilisateur);

                await _db.SaveChangesAsync();

                await _employeRepository.DeleteAsync(employe);

                // Retire le mapping email→tenant dans la base master (s'il pointe bien sur ce tenant).
                await UpsertTenantEmailIndexAsync(newEmail: null, oldEmail: oldEmail);

                return Ok(new { message="Employé supprimé avec succès" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = $"Erreur serveur : erreur interne" });
            }
        }
    }

    /// <summary>
    /// Payload self-service utilisé par UpdateMyContact. Volontairement
    /// minimal : seuls les champs de contact sont éditables par l'employé.
    /// Tout autre champ (Empfonc, Sercod, salaires, dates) reste sous le
    /// contrôle exclusif des RH via update-employe.
    /// </summary>
    public class UpdateMyContactDto
    {
        public string Soccod { get; set; } = null!;
        public string Empcod { get; set; } = null!;

        // ── Coordonnées (originaux) ──
        public string? Emptel { get; set; }
        public string? Empmob { get; set; }
        public string? Empadr { get; set; }
        public string? Vilcod { get; set; }
        public string? Empemail { get; set; }

        // ── État civil (extension self-service) ──
        // L'employé peut corriger ses propres informations personnelles depuis
        // l'application mobile sans solliciter les RH. Volontairement EXCLUS :
        // Foncod / Empfonc / Sercod / Sitcod / Soccod / Empemb / salaires —
        // ces champs restent sous contrôle RH.
        public string? Empsexe { get; set; }       // "M" | "F"
        public string? Empsitfam { get; set; }     // "C" | "M" | "D" | "V"
        public int? Empnbp { get; set; }           // Nombre de personnes à charge
        public string? Empdnais { get; set; }      // Date de naissance (string legacy)
        public string? Emplnais { get; set; }      // Lieu de naissance
        public string? Natcod { get; set; }        // Code nationalité

        // ── Identité (arabe) ──
        public string? Emplibar { get; set; }      // Nom en arabe
        public string? Empadrar { get; set; }      // Adresse en arabe
    }
}
