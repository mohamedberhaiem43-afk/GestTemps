using ABRPOINT.Server.Data;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using ABRPOINT.Server.Tenancy;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Services
{
    /// <summary>
    /// Provisionne le compte de connexion d'un collaborateur (Utilisateur + Socuser),
    /// lui envoie l'email d'onboarding (lien « définir mon mot de passe » quand aucun
    /// CIN n'est disponible, sinon identifiants provisoires) et inscrit son email dans
    /// la table master <see cref="TenantEmailIndex"/> pour le routage du login.
    ///
    /// Centralise la logique historiquement dupliquée dans EmployesController (POST
    /// single + PUT AddMultipleEmploye) afin que TOUS les points d'entrée de création
    /// de collaborateur — y compris l'import Excel en masse (BulkImportController) —
    /// déclenchent le même onboarding et le même mail de vérification. Avant, l'import
    /// Excel se contentait d'insérer la fiche <see cref="Employe"/> : aucun compte
    /// n'était créé et aucun email n'était envoyé, donc les collaborateurs importés ne
    /// pouvaient pas se connecter.
    /// </summary>
    public sealed class EmployeeAccountProvisioner
    {
        private readonly ApplicationDbContext _db;
        private readonly IUtilisateurRepository _utilisateurRepository;
        private readonly IDbContextFactory<MasterDbContext> _masterFactory;
        private readonly ICurrentTenant _currentTenant;
        private readonly IEmailService _emailService;
        private readonly IConfiguration _configuration;
        private readonly ILogger<EmployeeAccountProvisioner> _log;

        public EmployeeAccountProvisioner(
            ApplicationDbContext db,
            IUtilisateurRepository utilisateurRepository,
            IDbContextFactory<MasterDbContext> masterFactory,
            ICurrentTenant currentTenant,
            IEmailService emailService,
            IConfiguration configuration,
            ILogger<EmployeeAccountProvisioner> log)
        {
            _db = db;
            _utilisateurRepository = utilisateurRepository;
            _masterFactory = masterFactory;
            _currentTenant = currentTenant;
            _emailService = emailService;
            _configuration = configuration;
            _log = log;
        }

        public enum ProvisionResult
        {
            /// <summary>Compte créé (et email envoyé si une adresse était présente).</summary>
            Created,
            /// <summary>Email déjà rattaché à un autre compte — compte NON créé pour préserver « 1 email = 1 compte ».</summary>
            SkippedDuplicateEmail,
            /// <summary>Pas de code employé exploitable — rien à faire.</summary>
            SkippedNoCode,
            /// <summary>Échec inattendu (le détail est loggé).</summary>
            Failed,
        }

        /// <summary>
        /// Crée le compte de connexion de <paramref name="emp"/> (déjà persisté en base)
        /// et envoie l'email d'onboarding. <paramref name="plainCin"/> est le CIN EN CLAIR
        /// (avant chiffrement) : s'il est fourni, il sert de mot de passe provisoire ;
        /// sinon un lien sécurisé « définir mon mot de passe » (token 7 jours) est envoyé.
        /// Best-effort : un échec d'email n'invalide pas la création du compte.
        /// </summary>
        public async Task<ProvisionResult> ProvisionAndNotifyAsync(Employe emp, string? plainCin)
        {
            if (emp == null || string.IsNullOrWhiteSpace(emp.Empcod)) return ProvisionResult.SkippedNoCode;

            // Garde-fou « 1 email = 1 compte » : si l'email est déjà pris ailleurs, on
            // n'ouvre PAS de compte (sinon le routage du login deviendrait ambigu et la
            // création échouerait au commit). La fiche employé, elle, reste en base.
            if (!string.IsNullOrWhiteSpace(emp.Empemail) && !await IsEmailUniqueAsync(emp.Empemail, emp.Empcod))
            {
                _log.LogWarning("Provisioning ignoré pour {Empcod} : email {Email} déjà utilisé.", emp.Empcod, emp.Empemail);
                return ProvisionResult.SkippedDuplicateEmail;
            }

            // Mode « setup-link » si aucun CIN : l'employé choisira lui-même son mot de
            // passe via un lien à usage unique. Sinon le CIN fait office de MDP provisoire.
            var hasCin = !string.IsNullOrWhiteSpace(plainCin);
            string? setupToken = null;
            string passwordToHash;
            if (hasCin)
            {
                passwordToHash = plainCin!;
            }
            else
            {
                setupToken = GenerateSetupToken();
                passwordToHash = GenerateRandomPlaceholderPassword();
            }

            var utilisateur = new Utilisateur
            {
                Utiactif = "1",
                Utiadm = "0",
                Uticod = emp.Empcod,
                Utinom = emp.Emplib,
                Utimps = passwordToHash,
                Utimail = emp.Empemail,
                Utirole = string.IsNullOrWhiteSpace(emp.Utirole)
                    ? Authorization.PermissionCatalog.Roles.Employee
                    : emp.Utirole,
            };
            var socuser = new Socuser
            {
                Soccod = emp.Soccod,
                Sitcod = emp.Sitcod,
                Uticod = emp.Empcod,
                // Sync service à l'import : le compte hérite du service de la fiche employé.
                Sercod = string.IsNullOrWhiteSpace(emp.Sercod) ? null : emp.Sercod,
            };

            try
            {
                await _utilisateurRepository.AddAsync(utilisateur, socuser);
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "Création du compte utilisateur échouée pour {Empcod}", emp.Empcod);
                return ProvisionResult.Failed;
            }

            // Persiste le token de mise en place (réutilise UtiResetCode, comme le reset
            // de mot de passe classique, ce qui permet de réemployer /auth/reset-password).
            if (setupToken != null)
            {
                try
                {
                    var freshUser = await _db.Utilisateurs.FirstOrDefaultAsync(u => u.Uticod == emp.Empcod);
                    if (freshUser != null)
                    {
                        // SEC (#13) — token de setup hashé (le clair n'est que dans l'URL de l'email).
                        freshUser.UtiResetCode = ABRPOINT.Server.Helpers.ResetSecretHelper.Hash(setupToken);
                        freshUser.UtiResetCodeExpiry = DateTime.UtcNow.AddDays(7);
                        freshUser.UtiResetAttempts = 0;
                        await _db.SaveChangesAsync();
                    }
                }
                catch (Exception tokEx)
                {
                    _log.LogWarning(tokEx, "Échec persistance token setup pour {Empcod}", emp.Empcod);
                    setupToken = null;
                }
            }

            // Email d'onboarding (uniquement si une adresse est renseignée).
            if (!string.IsNullOrWhiteSpace(emp.Empemail))
            {
                try
                {
                    if (setupToken != null)
                    {
                        var setupUrl = BuildSetupPasswordUrl(emp.Empemail, setupToken);
                        await SendSetupPasswordEmailAsync(emp.Empemail, emp.Emplib, emp.Empcod, setupUrl);
                    }
                    else
                    {
                        await SendWelcomeEmailAsync(emp.Empemail, emp.Emplib, emp.Empcod, plainCin ?? string.Empty);
                    }
                }
                catch (Exception mailEx)
                {
                    _log.LogWarning(mailEx, "Échec d'envoi de l'email d'onboarding à {Email}", emp.Empemail);
                }

                // Indispensable pour que /Auth/lookup-tenant retrouve le tenant à partir
                // de l'email saisi sur la page de login racine. Sans ça : « compte
                // introuvable » malgré un compte valide.
                await UpsertTenantEmailIndexAsync(emp.Empemail);
            }

            return ProvisionResult.Created;
        }

        // ─────────────────────────────────────────────────────────────────────────
        //  Helpers (miroir de EmployesController — gardés synchronisés)
        // ─────────────────────────────────────────────────────────────────────────

        private async Task<bool> IsEmailUniqueAsync(string? email, string? excludeEmpcod)
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

        private async Task UpsertTenantEmailIndexAsync(string email)
        {
            try
            {
                var slug = _currentTenant.Current?.Slug;
                if (string.IsNullOrWhiteSpace(slug)) return;

                var emailLower = email.Trim().ToLowerInvariant();
                await using var master = await _masterFactory.CreateDbContextAsync();
                var existing = await master.TenantEmailIndex.FirstOrDefaultAsync(x => x.Email == emailLower);
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
                    _log.LogWarning(
                        "Email {Email} déjà mappé sur le tenant {OtherSlug} ; mapping sur {Slug} ignoré pour le routage login.",
                        emailLower, existing.Slug, slug);
                }
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Échec d'écriture TenantEmailIndex pour {Email}", email);
            }
        }

        private string BuildLoginUrl()
        {
            var rootDomain = _configuration["Hosting:RootDomain"] ?? "concorde.com";
            return $"https://{rootDomain}/login";
        }

        private string BuildDownloadUrl()
        {
            // Page publique de téléchargement de l'app mobile — destination FIXE (Download:PageUrl),
            // indépendante de Hosting:RootDomain (qui peut valoir localhost en dev/staging → lien
            // cassé https://localhost/download dans l'email du nouvel utilisateur).
            return _configuration["Download:PageUrl"] ?? "https://concorde-work-force.com/download";
        }

        private string BuildSetupPasswordUrl(string email, string token)
        {
            var rootDomain = _configuration["Hosting:RootDomain"] ?? "concorde.com";
            var encodedEmail = Uri.EscapeDataString(email ?? string.Empty);
            var encodedToken = Uri.EscapeDataString(token ?? string.Empty);
            return $"https://{rootDomain}/login?setup=1&email={encodedEmail}&code={encodedToken}";
        }

        private static string GenerateSetupToken()
        {
            var bytes = new byte[32];
            System.Security.Cryptography.RandomNumberGenerator.Fill(bytes);
            return Convert.ToBase64String(bytes)
                .Replace('+', '-').Replace('/', '_').TrimEnd('=');
        }

        private static string GenerateRandomPlaceholderPassword()
        {
            return Guid.NewGuid().ToString("N") + Guid.NewGuid().ToString("N");
        }

        private async Task SendWelcomeEmailAsync(string toEmail, string? fullName, string login, string password)
        {
            if (string.IsNullOrWhiteSpace(toEmail)) return;
            var loginUrl = BuildLoginUrl();
            var displayName = string.IsNullOrWhiteSpace(fullName) ? login : fullName;
            var safeName = System.Net.WebUtility.HtmlEncode(displayName);
            var safeLogin = System.Net.WebUtility.HtmlEncode(login);
            var safePassword = System.Net.WebUtility.HtmlEncode(password);
            var safeEmail = System.Net.WebUtility.HtmlEncode(toEmail);

            var infoCard = EmailTemplates.InfoCard(new Dictionary<string, string>
            {
                ["Email"] = safeEmail,
                ["Identifiant"] = safeLogin,
                ["Mot de passe provisoire"] = $"<code style=\"background:#eef2ff;color:#1e3a8a;padding:2px 8px;border-radius:6px;font-size:13px;\">{safePassword}</code>",
            });

            var inner =
                $"<p>Bonjour <strong>{safeName}</strong>,</p>" +
                $"<p>Votre compte collaborateur vient d'être créé sur la plateforme <strong>{EmailTemplates.BrandName}</strong>. Vous pouvez dès maintenant vous connecter pour consulter vos pointages, déposer vos demandes de congés et accéder à votre coffre-fort numérique.</p>" +
                "<p style=\"margin-top:18px;font-size:13px;color:#475569;\">Vos informations de connexion :</p>" +
                infoCard +
                EmailTemplates.Button("Accéder à mon espace", loginUrl) +
                EmailTemplates.StatusBanner(
                    "Conseil sécurité : changez votre mot de passe provisoire dès votre première connexion.",
                    EmailTemplates.StatusKind.Warning) +
                EmailTemplates.MobileAppCard(BuildDownloadUrl()) +
                "<p style=\"margin-top:24px;\">À très vite,<br/><strong>L'équipe Concorde Workforce</strong></p>";

            var subject = "Bienvenue sur Concorde Workforce — vos identifiants";
            var body = EmailTemplates.Wrap(
                title: $"Bienvenue, {displayName}",
                preview: "Vos identifiants de connexion à Concorde Workforce",
                innerHtml: inner);

            await _emailService.SendEmailAsync(toEmail, subject, body);
        }

        private async Task SendSetupPasswordEmailAsync(string toEmail, string? fullName, string login, string setupUrl)
        {
            if (string.IsNullOrWhiteSpace(toEmail)) return;
            var displayName = string.IsNullOrWhiteSpace(fullName) ? login : fullName;
            var safeName = System.Net.WebUtility.HtmlEncode(displayName);
            var safeLogin = System.Net.WebUtility.HtmlEncode(login);
            var safeEmail = System.Net.WebUtility.HtmlEncode(toEmail);

            var infoCard = EmailTemplates.InfoCard(new Dictionary<string, string>
            {
                ["Email"] = safeEmail,
                ["Identifiant"] = safeLogin,
            });

            var inner =
                $"<p>Bonjour <strong>{safeName}</strong>,</p>" +
                $"<p>Votre compte collaborateur vient d'être créé sur la plateforme <strong>{EmailTemplates.BrandName}</strong>. Pour finaliser votre accès, choisissez votre propre mot de passe en cliquant sur le bouton ci-dessous.</p>" +
                infoCard +
                EmailTemplates.Button("Définir mon mot de passe", setupUrl) +
                EmailTemplates.StatusBanner(
                    "Ce lien est personnel et expire dans 7 jours. Si vous n'êtes pas à l'origine de cette création, ignorez simplement cet email.",
                    EmailTemplates.StatusKind.Warning) +
                EmailTemplates.MobileAppCard(BuildDownloadUrl()) +
                "<p style=\"margin-top:24px;\">À très vite,<br/><strong>L'équipe Concorde Workforce</strong></p>";

            var subject = "Bienvenue sur Concorde Workforce — définissez votre mot de passe";
            var body = EmailTemplates.Wrap(
                title: $"Bienvenue, {displayName}",
                preview: "Choisissez votre mot de passe pour accéder à Concorde Workforce",
                innerHtml: inner);

            await _emailService.SendEmailAsync(toEmail, subject, body);
        }
    }
}
