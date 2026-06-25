using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.RegularExpressions;
using ABRPOINT.Server.Billing;
using ABRPOINT.Server.Provisioning;
using ABRPOINT.Server.Services;
using ABRPOINT.Server.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.IdentityModel.Tokens;

namespace ABRPOINT.Server.Controllers;

/// <summary>
/// Self-service SaaS : un visiteur s'inscrit, on crée un tenant + sa base + on l'authentifie.
/// </summary>
[ApiController]
[Route("api/signup")]
[AllowAnonymous]
public class SignupController : ControllerBase
{
    private static readonly Regex SlugRegex = new("^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$", RegexOptions.Compiled);
    private static readonly HashSet<string> ReservedSlugs = new(StringComparer.OrdinalIgnoreCase)
    {
        "www", "app", "api", "admin", "mail", "support", "billing", "status", "concorde",
        "master", "auth", "login", "signup", "stripe", "test", "demo", "staging", "prod",
    };

    // Notification interne envoyée à chaque création de tenant pour que l'équipe
    // commerciale/produit ait une visibilité temps réel sur les nouveaux clients
    // (lead qualification, suivi onboarding, détection d'abus). Hardcodé volontairement —
    // c'est un détail opérationnel Concorde, pas un paramètre tenant.
    private const string SignupNotificationRecipient = "postmaster@concorde-work-force.com";

    // Note 2026-05 — Liste des domaines d'emails personnels/jetables RETIRÉE : la contrainte
    // « adresse pro uniquement » bloquait trop de prospects légitimes (indépendants, asso,
    // petites structures sans domaine propre). Compensé par la vérification email obligatoire
    // (OTP 6 chiffres envoyé au signup, cf. UtilisateursController.VerifyEmail) qui prouve
    // que l'utilisateur contrôle réellement l'adresse — peu importe le fournisseur.

    private readonly IDbContextFactory<MasterDbContext> _masterFactory;
    private readonly IProvisioningService _provisioning;
    private readonly IBillingService _billing;
    private readonly ITenantStore _tenantStore;
    private readonly IConfiguration _cfg;
    private readonly Microsoft.Extensions.Caching.Memory.IMemoryCache _cache;
    private readonly ISiretValidator _siretValidator;
    private readonly IPasswordBreachChecker _passwordBreach;
    // SMTP optionnel : injecté en nullable pour que le signup continue de fonctionner
    // si la conf SMTP est absente (dev local sans .env). L'email de bienvenue devient
    // alors un no-op silencieux — l'inscription ne doit jamais échouer à cause du mail.
    private readonly ABRPOINT.Server.Interfaces.IEmailService? _email;
    private readonly ILogger<SignupController> _log;

    public SignupController(
        IDbContextFactory<MasterDbContext> masterFactory,
        IProvisioningService provisioning,
        IBillingService billing,
        ITenantStore tenantStore,
        IConfiguration cfg,
        Microsoft.Extensions.Caching.Memory.IMemoryCache cache,
        ISiretValidator siretValidator,
        IPasswordBreachChecker passwordBreach,
        ILogger<SignupController> log,
        ABRPOINT.Server.Interfaces.IEmailService? email = null)
    {
        _masterFactory = masterFactory;
        _provisioning = provisioning;
        _billing = billing;
        _tenantStore = tenantStore;
        _cfg = cfg;
        _cache = cache;
        _siretValidator = siretValidator;
        _passwordBreach = passwordBreach;
        _email = email;
        _log = log;
    }

    /// <summary>
    /// Captcha arithmétique anti-bot pour le signup. Le serveur génère deux opérandes
    /// (1-10) + une opération (+/−/×), garde la réponse en mémoire 5 min indexée par
    /// challengeId (GUID). Le frontend renvoie {challengeId, answer} dans le POST signup.
    /// Pas de tracker externe → conforme RGPD sans bandeau cookie supplémentaire.
    /// </summary>
    [HttpGet("captcha")]
    public IActionResult GetCaptcha()
    {
        var rng = System.Random.Shared;
        var a = rng.Next(1, 11);
        var b = rng.Next(1, 11);
        var op = rng.Next(3); // 0=+, 1=-, 2=×
        int answer; string opSymbol;
        switch (op)
        {
            case 1: opSymbol = "−"; answer = a - b; break;
            case 2: opSymbol = "×"; answer = a * b; break;
            default: opSymbol = "+"; answer = a + b; break;
        }
        var challengeId = Guid.NewGuid().ToString("N");
        _cache.Set($"signup_captcha:{challengeId}", answer, TimeSpan.FromMinutes(5));
        return Ok(new { challengeId, question = $"{a} {opSymbol} {b}" });
    }

    /// <summary>
    /// Valide la réponse captcha et invalide le challenge (single-use, anti-rejeu).
    /// Retourne false si introuvable, expiré ou mauvaise réponse.
    /// </summary>
    private bool ValidateCaptcha(string? challengeId, int? answer)
    {
        if (string.IsNullOrWhiteSpace(challengeId) || answer is null) return false;
        var key = $"signup_captcha:{challengeId}";
        if (!_cache.TryGetValue<int>(key, out var expected)) return false;
        _cache.Remove(key); // single-use même si la réponse est fausse → empêche le brute force
        return expected == answer.Value;
    }

    /// <summary>
    /// Vérifie en temps réel si un slug est disponible. Utilisé par le formulaire d'inscription.
    /// </summary>
    [HttpGet("check-slug")]
    public async Task<IActionResult> CheckSlug([FromQuery] string slug, CancellationToken ct)
    {
        slug = (slug ?? string.Empty).Trim().ToLowerInvariant();
        if (!SlugRegex.IsMatch(slug))
            return Ok(new { available = false, reason = "format" });
        if (ReservedSlugs.Contains(slug))
            return Ok(new { available = false, reason = "reserved" });

        await using var master = await _masterFactory.CreateDbContextAsync(ct);
        var taken = await master.Tenants.AsNoTracking()
            .AnyAsync(t => t.Slug == slug && t.Status != "Failed", ct);
        return Ok(new { available = !taken, reason = taken ? "taken" : null });
    }

    /// <summary>
    /// Vérifie l'unicité globale d'un email (tous tenants confondus). Un email est lié à un
    /// seul compte dans tout le système : il sert au routage du login (TenantEmailIndex).
    /// </summary>
    [HttpGet("check-email")]
    public async Task<IActionResult> CheckEmail([FromQuery] string email, CancellationToken ct)
    {
        email = (email ?? string.Empty).Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(email) || !email.Contains('@'))
            return Ok(new { available = false, reason = "format" });
        // Filtre "email pro" retiré (2026-05) — cf. note en tête de classe : tout email
        // valide est accepté, la preuve de contrôle de l'adresse passe désormais par
        // la vérification OTP envoyée au signup.

        await using var master = await _masterFactory.CreateDbContextAsync(ct);
        var taken = await master.TenantEmailIndex.AsNoTracking()
            .AnyAsync(x => x.Email == email, ct);
        return Ok(new { available = !taken, reason = taken ? "taken" : null });
    }

    /// <summary>
    /// Vérifie en temps réel qu'un identifiant entreprise (SIRET FR / BCE BE / ICE MA /
    /// NINEA SN / Matricule Fiscal TN) est valide ET qu'il n'a pas déjà été utilisé pour
    /// souscrire un essai gratuit. Appelé en onBlur depuis le formulaire signup pour donner
    /// un feedback immédiat à l'utilisateur. La règle métier est dupliquée dans le POST
    /// /api/signup pour empêcher tout contournement côté client.
    /// </summary>
    [HttpGet("check-siret")]
    public async Task<IActionResult> CheckSiret([FromQuery] string siret, [FromQuery] string? country, CancellationToken ct)
    {
        var validation = await _siretValidator.ValidateAsync(siret, country, ct);
        if (!validation.IsValid)
            return Ok(new { available = false, reason = validation.ErrorCode, message = validation.ErrorMessage });

        // Uppercase pour normaliser le casing des ID alpha-numériques (TN — Matricule Fiscal
        // tunisien `1234567A`/`1234567AAM001`). No-op pour FR/BE/MA/SN qui sont 100% chiffres.
        // Sans ça, l'index unique UX_Tenants_Siret_Active traiterait `1234567a` et `1234567A`
        // comme deux ID distincts → double trial possible par variation de casse.
        var normalized = (siret ?? string.Empty).Replace(" ", "").Replace("-", "").Replace(".", "").Trim().ToUpperInvariant();
        await using var master = await _masterFactory.CreateDbContextAsync(ct);
        // Unicité globale (tous pays confondus) sur l'ID brut : un attaquant ne peut pas
        // contourner en changeant le pays s'il garde le même numéro. La contrainte unique
        // filtrée côté SQL (UX_Tenants_Siret_Active) est la barrière dure côté DB.
        var alreadyUsed = await master.Tenants.AsNoTracking()
            .AnyAsync(t => t.Siret == normalized && t.Status != "Failed" && t.Status != "Cancelled", ct);
        if (alreadyUsed)
            return Ok(new { available = false, reason = "siret_already_used", message = "Un compte existe déjà pour ce numéro d'entreprise. Connectez-vous depuis l'écran de login pour y accéder." });

        return Ok(new
        {
            available = true,
            companyName = validation.CompanyName,
            companyAddress = validation.CompanyAddress,
            // 2026-05-27 — Exposé au frontend pour pré-remplir le champ
            // « Secteur d'activité » du formulaire signup quand l'API Sirene/BCE
            // a pu fournir l'info. Le champ reste éditable côté UI.
            activitySector = validation.ActivitySector,
        });
    }

    [HttpPost]
    [EnableRateLimiting("auth-signup")] // SEC-29 : 3 signups/heure/IP — anti-bot tenant flooding.
    public async Task<IActionResult> Signup([FromBody] SignupRequest req, CancellationToken ct)
    {
        if (req is null) return BadRequest(new { error = "Body manquant." });

        var slug = (req.Slug ?? string.Empty).Trim().ToLowerInvariant();
        if (!SlugRegex.IsMatch(slug))
            return BadRequest(new { error = "Slug invalide. Utilisez 3 à 30 caractères a-z, 0-9 ou tirets." });
        if (ReservedSlugs.Contains(slug))
            return BadRequest(new { error = "Ce slug est réservé." });
        if (string.IsNullOrWhiteSpace(req.AdminEmail) || !req.AdminEmail.Contains('@'))
            return BadRequest(new { error = "Email administrateur invalide." });
        // Filtre "email pro" retiré (2026-05) — cf. note en tête de classe.
        if (string.IsNullOrWhiteSpace(req.AdminPassword) || req.AdminPassword.Length < 8)
            return BadRequest(new { error = "Mot de passe trop court (8 caractères minimum)." });
        if (string.IsNullOrWhiteSpace(req.CompanyName))
            return BadRequest(new { error = "Nom d'entreprise requis." });

        // Vérif HIBP : refuse les mots de passe figurant dans des fuites publiques. C'est la
        // mesure single la plus efficace contre le credential stuffing (60-80% des attaques
        // exploitent des mdp réutilisés/fuités). Fail-open si HIBP est inaccessible.
        var breachCount = await _passwordBreach.GetBreachCountAsync(req.AdminPassword, ct);
        if (breachCount > 0)
            return BadRequest(new
            {
                error = $"Ce mot de passe figure dans des fuites de données publiques (vu {breachCount:N0} fois). Choisissez un mot de passe différent.",
                code = "password_pwned",
            });

        // Captcha anti-bot. Validé avant toute écriture (DB / Stripe) pour ne pas créer
        // de tenant fantôme si la vérif échoue. Le challenge est single-use (cf.
        // ValidateCaptcha → cache.Remove) ce qui empêche le brute force.
        if (!ValidateCaptcha(req.CaptchaChallengeId, req.CaptchaAnswer))
            return BadRequest(new { error = "Captcha invalide ou expiré. Rechargez et réessayez.", code = "captcha_failed" });

        // Anti-fraude business ID multi-pays (2026-05) : un même identifiant entreprise
        // (SIRET FR / BCE BE / ICE MA / NINEA SN / Matricule Fiscal TN) ne peut bénéficier
        // que d'un seul essai gratuit. La validation diffère par pays (FR a une API complète,
        // BE a un checksum local mod 97, MA/SN/TN n'ont qu'un check format), mais l'unicité
        // en base s'applique globalement.
        var countryNormalized = string.IsNullOrWhiteSpace(req.Country) ? "FR" : req.Country.Trim().ToUpperInvariant();
        if (!IsSupportedCountry(countryNormalized))
            return BadRequest(new { error = "Pays non supporté. Choisissez parmi : FR, BE, MA, SN, TN.", code = "country_unsupported" });

        var siretValidation = await _siretValidator.ValidateAsync(req.Siret, countryNormalized, ct);
        if (!siretValidation.IsValid)
            return BadRequest(new { error = siretValidation.ErrorMessage ?? "Identifiant entreprise invalide.", code = siretValidation.ErrorCode ?? "siret_invalid" });
        // Uppercase ici aussi — cf. CheckSiret pour le commentaire détaillé. Sans cette
        // normalisation, le check d'unicité plus bas (master.Tenants.AnyAsync(t => t.Siret == ...))
        // peut laisser passer un doublon `1234567a` vs `1234567A`.
        var siretNormalized = (req.Siret ?? string.Empty).Replace(" ", "").Replace("-", "").Replace(".", "").Trim().ToUpperInvariant();

        await using var master = await _masterFactory.CreateDbContextAsync(ct);

        // Doublon SIRET : on autorise plusieurs lignes Failed (retries de provisioning)
        // et plusieurs Cancelled (réactivations après rétention). Toute autre ligne avec
        // ce SIRET est bloquante. L'index unique filtré côté SQL (cf. Program.cs) est le
        // garde-fou contre les race conditions ; ce check explicite donne juste un
        // message d'erreur clair plutôt qu'une 500 sur violation de contrainte.
        var siretInUse = await master.Tenants.AsNoTracking()
            .AnyAsync(t => t.Siret == siretNormalized && t.Status != "Failed" && t.Status != "Cancelled", ct);
        if (siretInUse)
            return Conflict(new
            {
                error = "Un compte existe déjà pour ce numéro d'entreprise. Connectez-vous depuis l'écran de login pour accéder à votre espace, ou contactez le support si vous avez perdu vos identifiants.",
                code = "siret_already_used",
            });

        // Une éventuelle ligne existante pour ce slug : si elle est active, on refuse ;
        // si elle est en 'Failed' (tentative précédente échouée), on la réutilise pour
        // éviter une violation de IX_Tenants_Slug — l'index unique ne filtre pas par statut.
        var existing = await master.Tenants.FirstOrDefaultAsync(t => t.Slug == slug, ct);
        if (existing != null && existing.Status != "Failed")
            return Conflict(new { error = "Ce slug est déjà utilisé." });

        // Unicité globale de l'email (tous tenants confondus). On tolère le cas où l'index
        // pointe déjà sur le slug actuel ET que ce tenant est en 'Failed' (recyclage d'une
        // tentative ratée par le même utilisateur). Sinon, refus pour préserver l'invariant
        // « 1 email = 1 compte » sur lequel s'appuie /Auth/lookup-tenant.
        var adminEmailLowerCheck = req.AdminEmail.Trim().ToLowerInvariant();
        var emailIndexEntry = await master.TenantEmailIndex.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Email == adminEmailLowerCheck, ct);
        if (emailIndexEntry != null)
        {
            var isReusableFailedSlot = existing != null
                && existing.Status == "Failed"
                && string.Equals(emailIndexEntry.Slug, slug, StringComparison.OrdinalIgnoreCase);
            if (!isReusableFailedSlot)
            {
                // Cas spécial : l'email pointe vers un tenant résilié. On guide l'utilisateur
                // vers le flow de réactivation au lieu de bloquer aveuglément — sinon il pense
                // que son email est "interdit" alors qu'il peut récupérer son compte via login
                // → Stripe Checkout (rétention 90j, cf. /billing/resume-checkout).
                // Au-delà de la rétention, on libère l'email et on autorise un nouveau compte
                // (les données du tenant Cancelled restent côté backup, accessibles via support).
                var ownerTenant = await master.Tenants.AsNoTracking()
                    .FirstOrDefaultAsync(t => t.Slug == emailIndexEntry.Slug, ct);
                if (ownerTenant != null && string.Equals(ownerTenant.Status, "Cancelled", StringComparison.OrdinalIgnoreCase))
                {
                    var cancelledAt = ownerTenant.CancellationRequestedAt ?? DateTime.UtcNow;
                    var withinRetention = (DateTime.UtcNow - cancelledAt).TotalDays <= 90;
                    if (withinRetention)
                    {
                        return StatusCode(StatusCodes.Status409Conflict, new
                        {
                            error = "Cet email correspond à un compte résilié. Connectez-vous pour réactiver votre abonnement (vos données sont conservées 90 jours).",
                            code = "cancelled_account_reactivatable",
                            slug = emailIndexEntry.Slug,
                        });
                    }
                    // Rétention dépassée → on libère l'email + l'index pour permettre une nouvelle inscription.
                    master.TenantEmailIndex.Remove(await master.TenantEmailIndex
                        .FirstAsync(x => x.Email == adminEmailLowerCheck, ct));
                    await master.SaveChangesAsync(ct);
                    emailIndexEntry = null;
                }
                else
                {
                    return Conflict(new { error = "Cet email est déjà utilisé par un autre compte." });
                }
            }
        }

        // Génération du DbName : tenant_<slug>_<8hex>. Limite 64 caractères enforce par Tenant entity.
        // Les hyphens du slug (autorisés dans l'URL) sont remplacés par '_' pour rester compatibles
        // avec le validateur SQL — ProvisioningService.ValidateDbName n'accepte que [A-Za-z0-9_].
        var suffix = Guid.NewGuid().ToString("N").Substring(0, 8);
        var dbSafeSlug = slug.Replace('-', '_');
        var dbName = $"tenant_{dbSafeSlug}_{suffix}";
        if (dbName.Length > 64) dbName = dbName.Substring(0, 64);

        Tenant tenant;
        if (existing != null)
        {
            // Recyclage de la ligne 'Failed' : on remet à neuf les champs métier.
            tenant = existing;
            tenant.CompanyName = req.CompanyName.Trim();
            tenant.DbName = dbName;
            tenant.Status = "Provisioning";
            tenant.AdminEmail = req.AdminEmail.Trim();
            tenant.CreatedAt = DateTime.UtcNow;
            // Promesse commerciale : 30 jours d'essai gratuit *sans carte bancaire* sur
            // les 3 packs (Starter / Standard / Premium). Avant on faussait avec 14j et
            // un branchement PendingPayment dès qu'un plan payant était choisi → on
            // demandait implicitement une CB. Désormais l'inscription est toujours en
            // Trialing pour la durée canonique TrialPolicy.TrialDurationDays, et un
            // rappel push/in-app/email est émis 4 jours avant l'expiration.
            tenant.TrialEndsAt = DateTime.UtcNow.AddDays(TrialPolicy.TrialDurationDays);
            tenant.Region = "eu-fr";
            tenant.LegacySoccod = "01";
            tenant.StripeCustomerId = null;
            tenant.StripeSubscriptionId = null;
            tenant.OnboardingCompleted = false;
            tenant.PlanCode = string.IsNullOrWhiteSpace(req.PlanCode) ? null : req.PlanCode.Trim();
            tenant.Siret = siretNormalized;
            tenant.CountryCode = countryNormalized;
            tenant.Addons = NormalizeAddons(req.Addons);
            // ActivitySector (2026-05-27) : libellé libre fourni par le client (pré-rempli
            // depuis Sirene/BCE côté UI ou saisi manuellement). On trim et clamp à 200
            // chars en silence pour ne jamais faire échouer un signup à cause de ce champ.
            tenant.ActivitySector = NormalizeActivitySector(req.ActivitySector);
        }
        else
        {
            tenant = new Tenant
            {
                Id = Guid.NewGuid(),
                Slug = slug,
                CompanyName = req.CompanyName.Trim(),
                DbName = dbName,
                Status = "Provisioning",
                AdminEmail = req.AdminEmail.Trim(),
                CreatedAt = DateTime.UtcNow,
                // 30 jours d'essai sans CB (cf. note ci-dessus).
                TrialEndsAt = DateTime.UtcNow.AddDays(TrialPolicy.TrialDurationDays),
                Region = "eu-fr",
                LegacySoccod = "01",
                PlanCode = string.IsNullOrWhiteSpace(req.PlanCode) ? null : req.PlanCode.Trim(),
                Siret = siretNormalized,
                CountryCode = countryNormalized,
                Addons = NormalizeAddons(req.Addons),
                ActivitySector = NormalizeActivitySector(req.ActivitySector),
            };
            master.Tenants.Add(tenant);
        }
        await master.SaveChangesAsync(ct);

        // Pré-génération du code OTP de vérification email AVANT le seed pour que la valeur
        // hashée soit posée dès la création de l'admin "AD". Le code clair n'est conservé
        // que le temps d'envoyer l'email (variable locale, jamais persistée ni loggée hors DEV).
        var verifCodePlain = EmailVerificationHelper.GenerateCode();
        var verifCodeHash = BCrypt.Net.BCrypt.HashPassword(verifCodePlain);
        var verifCodeExpiry = DateTime.UtcNow.AddMinutes(EmailVerificationHelper.CodeLifetimeMinutes);

        try
        {
            await _provisioning.CreateDatabaseAsync(dbName, ct);
            await _provisioning.RunMigrationsAsync(dbName, ct);
            await _provisioning.SeedInitialAsync(tenant, new ProvisioningSeedRequest(
                CompanyName: req.CompanyName,
                AdminFirstName: string.IsNullOrWhiteSpace(req.AdminFirstName) ? "Admin" : req.AdminFirstName,
                AdminLastName: string.IsNullOrWhiteSpace(req.AdminLastName) ? "Compte" : req.AdminLastName,
                AdminEmail: req.AdminEmail,
                AdminPassword: req.AdminPassword,
                EmailVerifCodeHash: verifCodeHash,
                EmailVerifCodeExpiry: verifCodeExpiry
            ), ct);

            // Stripe : Customer + Subscription en mode trial. Si Stripe non configuré, ce no-op
            // laisse le tenant en Trialing sans facturation (utile pour le dev local).
            try
            {
                await _billing.CreateCustomerAndTrialAsync(tenant, req.PlanCode, req.BillingCycle, ct);
            }
            catch (Exception billingEx)
            {
                // Le provisioning DB est OK ; on ne casse pas l'inscription si Stripe échoue.
                // L'admin pourra finaliser l'abonnement depuis /dashboard/payment.
                _log.LogError(billingEx, "Billing échoué pour {Slug} mais provisioning OK — tenant marqué Trialing sans Stripe.", slug);
            }

            // V3 : aucun pack n'exige la CB au signup → tous les nouveaux tenants entrent
            // directement en Trialing pour 30 jours. Le RequiresPayment historique est ignoré
            // pour préserver la rétro-compatibilité du payload front sans changer le comportement.
            // À la fin de l'essai, ProcessTrialExpirationsAsync flippera en PendingPayment, et
            // le rappel J-4 (cf. SendTrialExpiryRemindersAsync) aura déjà invité admin/manager
            // à finaliser le paiement Stripe.
            tenant.Status = "Trialing";
            // Index email→slug : permet à la page de login (root domain) de retrouver
            // le tenant à partir de l'email saisi, sans demander le code société.
            // Upsert : on remplace une éventuelle ligne existante (cas d'un re-signup
            // après tenant 'Failed' avec le même email).
            var adminEmailLower = req.AdminEmail.Trim().ToLowerInvariant();
            var existingIndex = await master.TenantEmailIndex
                .FirstOrDefaultAsync(x => x.Email == adminEmailLower, ct);
            if (existingIndex != null)
            {
                existingIndex.Slug = slug;
            }
            else
            {
                master.TenantEmailIndex.Add(new TenantEmailIndex
                {
                    Email = adminEmailLower,
                    Slug = slug,
                    CreatedAt = DateTime.UtcNow,
                });
            }
            await master.SaveChangesAsync(ct);
            _tenantStore.Invalidate(slug);

            // Pose un cookie JWT pour pré-authentifier le nouveau client : il atterrit directement
            // sur son dashboard sans repasser par l'écran de login.
            var token = IssueAdminJwt(slug, "AD");
            Response.Cookies.Append("accessToken", token, BuildAuthCookie(DateTimeOffset.UtcNow.AddHours(1)));
            Response.Cookies.Append("uticod", "AD", BuildAuthCookie(DateTimeOffset.UtcNow.AddDays(7)));
            // SEC — Cookie HttpOnly : le statut admin est lu par le front via /me, pas via document.cookie.
            Response.Cookies.Append("admin", "1", BuildAuthCookie(DateTimeOffset.UtcNow.AddDays(7)));

            var rootDomain = _cfg["Hosting:RootDomain"] ?? "concorde-work-force.com";
            var redirectUrl = $"https://{rootDomain}/dashboard";

            // Email combiné bienvenue + code de vérification (6 chiffres). L'utilisateur :
            //   (1) confirme qu'il contrôle réellement l'adresse en saisissant le code sur
            //       /verify-email,
            //   (2) reçoit son URL d'espace, les conditions de l'essai, etc.
            // Best-effort SMTP : un échec d'envoi ne casse pas le signup. Si le mail ne
            // part pas, l'utilisateur peut relancer depuis la page /verify-email
            // (POST /api/Utilisateurs/resend-verification).
            _ = SendWelcomeEmailAsync(tenant, req, redirectUrl, rootDomain, verifCodePlain, ct);

            // Notification interne Concorde — best-effort fire-and-forget. Capture
            // l'IP/UA AVANT le détachement de tâche : HttpContext n'est plus garanti
            // accessible une fois la réponse renvoyée.
            var requestIp = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "—";
            var requestUa = Request.Headers["User-Agent"].ToString();
            _ = SendInternalSignupNotificationAsync(tenant, req, redirectUrl, requestIp, requestUa, ct);

            // SEC-20 — `dbName` retiré de la réponse : exposait la convention de nommage
            // de la base SQL (`tenant_<slug>_<8hex>`), ce qui facilite une attaque ciblée
            // si un attaquant obtient un accès réseau au serveur SQL.
            return Created(string.Empty, new
            {
                tenantId = tenant.Id,
                slug = tenant.Slug,
                trialEndsAt = tenant.TrialEndsAt,
                redirectUrl,
                // En DEV (host = localhost), le frontend utilisera localStorage('tenantSlug') = slug
                // au lieu d'un vrai sous-domaine.
                devHint = "Set localStorage('tenantSlug') and reload to test on localhost.",
            });
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Provisioning échoué pour slug={Slug}", slug);
            tenant.Status = "Failed";
            await master.SaveChangesAsync(ct);
            try { await _provisioning.DropDatabaseAsync(dbName, ct); }
            catch (Exception dropEx) { _log.LogWarning(dropEx, "Drop fallback échoué pour {DbName}", dbName); }
            // SEC-19 — `detail = ex.Message` retiré (peut leaker SQL/chemins/secrets).
            return StatusCode(500, new { error = "Provisioning échoué. Contactez le support si le problème persiste." });
        }
    }

    /// <summary>
    /// Normalise et persiste les addons souscrits au signup :
    /// 1. Filtre les clés inconnues (PlanCatalog.ValidAddonKeys).
    /// 2. Retire les addons DÉJÀ inclus dans le PlanCode (cf. mapping côté PlanPicker
    ///    PACK_INCLUDED_ADDONS — ex. Premium inclut RagAi donc aiAssistantRh est inutile).
    ///    Évite la double-facturation et garde Tenant.Addons strictement informatif sur
    ///    les modules « en plus » du pack.
    /// 3. Sérialise en CSV ou retourne null si vide (pour matcher la sémantique « pas d'addons »).
    /// </summary>
    private static string? NormalizeAddons(List<string>? raw)
    {
        if (raw == null || raw.Count == 0) return null;
        var valid = raw
            .Where(a => !string.IsNullOrWhiteSpace(a))
            .Select(a => a.Trim())
            .Where(a => Tenancy.PlanCatalog.ValidAddonKeys.Contains(a))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        return valid.Count == 0 ? null : string.Join(",", valid);
    }

    /// <summary>
    /// Nettoie le secteur d'activité saisi au signup : trim, retire les retours
    /// chariot (anti-injection email/HTML basique vu qu'on l'affiche tel quel
    /// dans la notif interne), clamp à 200 chars (max du champ DB). Retourne
    /// null si vide après nettoyage.
    /// </summary>
    private static string? NormalizeActivitySector(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var clean = raw.Replace('\r', ' ').Replace('\n', ' ').Trim();
        if (clean.Length > 200) clean = clean.Substring(0, 200);
        return string.IsNullOrEmpty(clean) ? null : clean;
    }

    private string IssueAdminJwt(string slug, string uticod)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_cfg["Jwt:Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, uticod),
            new Claim(ClaimTypes.NameIdentifier, uticod),
            new Claim(ClaimTypes.Name, uticod),
            new Claim("tenant_slug", slug),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };
        var token = new JwtSecurityToken(
            issuer: _cfg["Jwt:Issuer"],
            audience: _cfg["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddHours(1),
            signingCredentials: creds);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    /// <summary>
    /// Email combiné « bienvenue + vérification email » envoyé à l'admin du nouveau tenant
    /// juste après un signup réussi. Le code OTP 6 chiffres est affiché en gros et expire
    /// 15 min après émission. Best-effort : tout échec (SMTP non configuré, timeout, etc.)
    /// est loggé mais NE re-throw PAS — l'inscription reste valide même sans email.
    /// L'utilisateur peut relancer un nouveau code depuis /verify-email
    /// (POST /api/Utilisateurs/resend-verification).
    /// </summary>
    private async Task SendWelcomeEmailAsync(
        Tenant tenant,
        SignupRequest req,
        string redirectUrl,
        string rootDomain,
        string verificationCode,
        CancellationToken ct)
    {
        if (_email is null)
        {
            // En DEV sans SMTP : on log le code pour que le développeur puisse tester le
            // flow de vérification sans configurer un serveur mail. Volontairement INFO
            // (pas DEBUG) car cette info est cruciale au flow ; ne JAMAIS exposer en prod.
            _log.LogInformation("[DEV] Code de vérification email pour {Email} : {Code} (valide {Minutes}min)",
                tenant.AdminEmail, verificationCode, EmailVerificationHelper.CodeLifetimeMinutes);
            return;
        }
        if (string.IsNullOrWhiteSpace(tenant.AdminEmail)) return;

        try
        {
            var firstName = string.IsNullOrWhiteSpace(req.AdminFirstName) ? "" : req.AdminFirstName.Trim();
            var safeFirstName = System.Net.WebUtility.HtmlEncode(firstName);
            var safeCompany = System.Net.WebUtility.HtmlEncode(req.CompanyName?.Trim() ?? "");
            var safeSlug = System.Net.WebUtility.HtmlEncode(tenant.Slug);
            var safeUrl = System.Net.WebUtility.HtmlEncode(redirectUrl);
            var trialEndStr = tenant.TrialEndsAt?.ToLocalTime().ToString("d MMMM yyyy",
                new System.Globalization.CultureInfo("fr-FR")) ?? "";
            var safeTrialEnd = System.Net.WebUtility.HtmlEncode(trialEndStr);
            // Liens de téléchargement DIRECT de l'app mobile (+ QR code) : Android via
            // /api/download/android (302 → APK, télécharge le .apk directement), iOS via la
            // fiche App Store. Destinations publiques FIXES — surtout PAS dérivées de RootDomain
            // qui peut valoir localhost hors prod → lien cassé dans l'email.
            var androidApkUrl = _cfg["Download:AndroidDirectUrl"] ?? "https://concorde-work-force.com/api/download/android";
            var iosAppStoreUrl = _cfg["Download:IosAppStoreUrl"] ?? "https://apps.apple.com/us/app/concorde-workly/id6780909371";

            var planLabel = string.IsNullOrWhiteSpace(req.PlanCode) ? "Essai 30 jours"
                : char.ToUpper(req.PlanCode.Trim()[0]) + req.PlanCode.Trim()[1..].ToLower();
            var cycleLabel = (req.BillingCycle ?? "").Trim().ToLowerInvariant() switch
            {
                "annual" => "Engagement annuel",
                "monthly" => "Mensuel sans engagement",
                _ => "Essai gratuit",
            };

            var infoCard = Services.EmailTemplates.InfoCard(new Dictionary<string, string>
            {
                ["Entreprise"] = safeCompany,
                ["URL de votre espace"] = $"<a href=\"{safeUrl}\" style=\"color:#0040a1;text-decoration:none;font-weight:600;\">{safeUrl}</a>",
                ["Identifiant administrateur"] = "AD",
                ["Pack souscrit"] = System.Net.WebUtility.HtmlEncode(planLabel) + " · " + System.Net.WebUtility.HtmlEncode(cycleLabel),
                ["Fin de l'essai gratuit"] = safeTrialEnd,
            });

            // Bloc OTP — affichage volontairement gros (32px, letter-spacing 8px) pour que
            // l'utilisateur puisse le copier d'un coup d'œil sur mobile sans dérouler.
            // Codé en tableau HTML inline pour rester rendable dans Outlook/Gmail.
            var safeCode = System.Net.WebUtility.HtmlEncode(verificationCode);
            var verifyUrl = $"{redirectUrl.TrimEnd('/')}/verify-email";
            var verifBlock = $@"
<table role=""presentation"" cellpadding=""0"" cellspacing=""0"" border=""0"" width=""100%"" style=""margin:20px 0;"">
  <tr>
    <td style=""background:#f0f6ff;border:1px solid #cdd9ee;border-radius:14px;padding:24px;text-align:center;"">
      <p style=""margin:0 0 8px;color:#475569;font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;"">Votre code de vérification</p>
      <div style=""font-family:'Courier New',monospace;font-size:36px;font-weight:800;letter-spacing:10px;color:#0040a1;margin:4px 0 10px;padding:8px 0;"">{safeCode}</div>
      <p style=""margin:0;color:#64748b;font-size:12px;"">Valable {EmailVerificationHelper.CodeLifetimeMinutes} minutes. À saisir sur la page de vérification après votre première connexion.</p>
    </td>
  </tr>
</table>";

            var greeting = string.IsNullOrEmpty(safeFirstName)
                ? "<p>Bonjour,</p>"
                : $"<p>Bonjour <strong>{safeFirstName}</strong>,</p>";

            var inner =
                greeting +
                $"<p>Votre compte <strong>{Services.EmailTemplates.BrandName}</strong> vient d'être créé pour <strong>{safeCompany}</strong>. 🎉</p>" +
                "<p><strong>Première étape :</strong> confirmez votre adresse email en saisissant le code ci-dessous sur l'écran de vérification. Cette étape ne prend que quelques secondes et nous permet de vous garantir l'accès aux notifications et aux fonctions sensibles (réinitialisation de mot de passe, alertes RGPD, etc.).</p>" +
                verifBlock +
                Services.EmailTemplates.Button("Vérifier mon email", verifyUrl) +
                "<p>Vous bénéficiez de <strong>30 jours d'essai gratuit</strong>, sans carte bancaire, avec accès complet à votre pack — pointage web &amp; mobile, gestion RH, congés &amp; absences, géolocalisation, et reporting.</p>" +
                infoCard +
                Services.EmailTemplates.StatusBanner(
                    $"Votre essai gratuit prend fin le {trialEndStr}. Nous vous enverrons des rappels à l'approche de l'échéance (4 jours avant, 2 jours avant, puis le jour J) pour activer votre abonnement Stripe — vous gardez la main jusqu'au dernier moment.",
                    Services.EmailTemplates.StatusKind.Info) +
                "<p style=\"margin-top:18px;\"><strong>Prochaines étapes recommandées :</strong></p>" +
                "<ol style=\"padding-left:20px;color:#334155;line-height:1.8;\">" +
                "<li>Vérifiez votre email avec le code ci-dessus.</li>" +
                "<li>Connectez-vous à votre espace et complétez la fiche de votre société.</li>" +
                "<li>Invitez vos premiers collaborateurs depuis <em>Gestion des employés</em>.</li>" +
                "<li>Téléchargez l'application mobile pour pointer en déplacement.</li>" +
                "</ol>" +
                Services.EmailTemplates.MobileAppCard(androidApkUrl, iosAppStoreUrl) +
                "<p style=\"margin-top:24px;\">Une question ? Répondez simplement à cet email — notre équipe support vous accompagne pendant toute la durée de votre essai et au-delà.</p>" +
                "<p style=\"margin-top:18px;\">Bienvenue à bord,<br/><strong>L'équipe Concorde Workforce</strong></p>";

            var subject = $"Bienvenue chez {Services.EmailTemplates.BrandName} — code de vérification : {verificationCode}";
            var body = Services.EmailTemplates.Wrap(
                title: string.IsNullOrEmpty(firstName) ? "Bienvenue !" : $"Bienvenue, {firstName}",
                preview: $"Votre code de vérification : {verificationCode} (valable {EmailVerificationHelper.CodeLifetimeMinutes} min). Espace prêt sur {safeSlug}.{rootDomain}.",
                innerHtml: inner);

            await _email.SendEmailAsync(tenant.AdminEmail, subject, body);
            _log.LogInformation("Welcome+verify email envoyé à {Email} (tenant {Slug})", tenant.AdminEmail, tenant.Slug);
        }
        catch (Exception ex)
        {
            // Best-effort : on log mais on ne fait pas échouer le signup. L'admin
            // peut demander un nouveau code depuis /verify-email.
            _log.LogWarning(ex, "Welcome email échoué pour {Email} (tenant {Slug}) — signup non impacté.",
                tenant.AdminEmail, tenant.Slug);
        }
    }

    /// <summary>
    /// Email interne envoyé à <see cref="SignupNotificationRecipient"/> pour signaler
    /// la création d'un nouveau tenant. Contient toutes les infos d'inscription utiles
    /// au suivi commercial et à la détection d'abus (entreprise, admin, pack souscrit,
    /// IP, User-Agent). N'inclut JAMAIS le mot de passe administrateur.
    ///
    /// Best-effort fire-and-forget : SMTP absent ou erreur d'envoi → log warning,
    /// l'inscription reste valide.
    /// </summary>
    private async Task SendInternalSignupNotificationAsync(
        Tenant tenant,
        SignupRequest req,
        string redirectUrl,
        string requestIp,
        string requestUa,
        CancellationToken ct)
    {
        if (_email == null) return;

        try
        {
            string Esc(string? s) => System.Net.WebUtility.HtmlEncode(s ?? "");

            var planLabel = string.IsNullOrWhiteSpace(req.PlanCode) ? "—" : req.PlanCode.Trim();
            var cycleLabel = string.IsNullOrWhiteSpace(req.BillingCycle) ? "—" : req.BillingCycle.Trim();
            var addonsLabel = string.IsNullOrEmpty(tenant.Addons) ? "—" : tenant.Addons;
            var trialEndStr = tenant.TrialEndsAt?.ToString("yyyy-MM-dd HH:mm 'UTC'") ?? "—";
            var createdStr = tenant.CreatedAt.ToString("yyyy-MM-dd HH:mm 'UTC'");

            var rows = new (string label, string value)[]
            {
                ("Slug",            Esc(tenant.Slug)),
                ("Entreprise",      Esc(tenant.CompanyName)),
                ("Pays",            Esc(tenant.CountryCode)),
                ("SIRET / ID",      Esc(tenant.Siret)),
                ("Admin",           Esc($"{req.AdminFirstName} {req.AdminLastName}".Trim())),
                ("Email admin",     Esc(tenant.AdminEmail)),
                ("Pack",            Esc(planLabel)),
                ("Cycle",           Esc(cycleLabel)),
                ("Addons",          Esc(addonsLabel)),
                ("Statut",          Esc(tenant.Status)),
                ("Région",          Esc(tenant.Region)),
                ("Créé le",         Esc(createdStr)),
                ("Fin essai",       Esc(trialEndStr)),
                ("URL espace",      $"<a href=\"{Esc(redirectUrl)}\">{Esc(redirectUrl)}</a>"),
                ("Tenant Id",       Esc(tenant.Id.ToString())),
                ("IP source",       Esc(requestIp)),
                ("User-Agent",      Esc(requestUa)),
            };

            var tableRows = string.Join("", rows.Select(r =>
                $"<tr><td style=\"padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#64748b;font-weight:600;width:35%;\">{r.label}</td>" +
                $"<td style=\"padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#0f172a;\">{r.value}</td></tr>"));

            var body = $@"<!DOCTYPE html>
<html><body style=""font-family:Arial,Helvetica,sans-serif;color:#1e293b;max-width:640px;margin:0 auto;padding:24px;background:#f8fafc;"">
  <div style=""background:#fff;border-radius:12px;padding:24px;border:1px solid #e2e8f0;"">
    <h2 style=""margin:0 0 4px;color:#0040a1;"">🎉 Nouveau tenant inscrit</h2>
    <p style=""margin:0 0 16px;color:#64748b;font-size:13px;"">Notification automatique — création de compte sur la plateforme.</p>
    <table style=""width:100%;border-collapse:collapse;font-size:14px;"">
      {tableRows}
    </table>
    <p style=""margin-top:20px;font-size:12px;color:#94a3b8;"">Concorde Workforce · Signup auto-notification</p>
  </div>
</body></html>";

            var subject = $"[Signup] {tenant.CompanyName} ({tenant.Slug}) — {planLabel}";
            await _email.SendEmailAsync(SignupNotificationRecipient, subject, body);
            _log.LogInformation("Internal signup notification envoyée à {Recipient} pour tenant {Slug}",
                SignupNotificationRecipient, tenant.Slug);
        }
        catch (Exception ex)
        {
            // Best-effort : ne casse pas le signup si l'envoi échoue (SMTP down, etc.).
            _log.LogWarning(ex, "Internal signup notification échouée pour tenant {Slug} — non bloquant.", tenant.Slug);
        }
    }

    /// <summary>
    /// Liste blanche des pays supportés à l'inscription. Toute extension passe par ce
    /// catalogue + l'ajout d'une stratégie de validation correspondante côté
    /// <see cref="SiretValidator"/>. On évite les ISO codes inconnus dans la base
    /// pour préserver l'intégrité des reports/audit.
    /// </summary>
    private static bool IsSupportedCountry(string code) =>
        code == "FR" || code == "BE" || code == "MA" || code == "SN" || code == "TN";

    private CookieOptions BuildAuthCookie(DateTimeOffset expires, bool httpOnly = true)
    {
        var isHttps = Request.IsHttps;
        return new CookieOptions
        {
            HttpOnly = httpOnly,
            Secure = isHttps,
            SameSite = isHttps ? SameSiteMode.None : SameSiteMode.Lax,
            Expires = expires,
            Path = "/",
        };
    }
}

public class SignupRequest
{
    public string Slug { get; set; } = string.Empty;
    public string CompanyName { get; set; } = string.Empty;
    public string AdminFirstName { get; set; } = string.Empty;
    public string AdminLastName { get; set; } = string.Empty;
    public string AdminEmail { get; set; } = string.Empty;
    public string AdminPassword { get; set; } = string.Empty;
    /// <summary>
    /// Identifiant entreprise (SIRET FR / BCE BE / ICE MA / NINEA SN / Matricule Fiscal TN).
    /// Validé selon le pays choisi et utilisé comme clé anti-fraude : un seul essai gratuit
    /// par ID. Obligatoire depuis 2026-05.
    /// </summary>
    public string Siret { get; set; } = string.Empty;
    /// <summary>
    /// Code pays ISO 3166-1 alpha-2. Valeurs supportées : FR | BE | MA | SN | TN.
    /// Défaut FR si absent (rétro-compat). Détermine le format attendu pour Siret.
    /// </summary>
    public string? Country { get; set; }
    /// <summary>
    /// Secteur d'activité (libellé libre, max 200 chars). Pré-rempli au signup
    /// depuis l'API Sirene/BCE quand disponible (FR/BE), saisi manuellement
    /// sinon. Optionnel — un signup sans secteur reste valide.
    /// </summary>
    public string? ActivitySector { get; set; }
    public string? PlanCode { get; set; }
    public string? BillingCycle { get; set; }
    /// <summary>
    /// Liste des addons souscrits au signup (cf. PlanPicker côté frontend). Optionnel.
    /// Stocké en CSV sur Tenant.Addons. Validé via PlanCatalog.ParseAddons : les clés
    /// inconnues sont silencieusement ignorées (pas d'erreur 400 pour ne pas casser
    /// un client front un peu plus récent qui enverrait un nouvel addon pas encore
    /// connu de cette version backend).
    /// </summary>
    public List<string>? Addons { get; set; }
    /// <summary>
    /// True quand l'inscription vient d'un plan payant configuré (PricingPage → PlanConfiguration → Signup).
    /// Le tenant est alors créé en statut "PendingPayment" : la connexion est refusée tant que le
    /// paiement Stripe n'est pas confirmé via le webhook checkout.session.completed.
    /// </summary>
    public bool RequiresPayment { get; set; }
    /// <summary>ID du challenge captcha distribué par GET /api/signup/captcha.</summary>
    public string? CaptchaChallengeId { get; set; }
    /// <summary>Réponse numérique au challenge captcha.</summary>
    public int? CaptchaAnswer { get; set; }
}
