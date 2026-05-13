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

    private readonly IDbContextFactory<MasterDbContext> _masterFactory;
    private readonly IProvisioningService _provisioning;
    private readonly IBillingService _billing;
    private readonly ITenantStore _tenantStore;
    private readonly IConfiguration _cfg;
    private readonly Microsoft.Extensions.Caching.Memory.IMemoryCache _cache;
    private readonly ISiretValidator _siretValidator;
    private readonly IPasswordBreachChecker _passwordBreach;
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
        ILogger<SignupController> log)
    {
        _masterFactory = masterFactory;
        _provisioning = provisioning;
        _billing = billing;
        _tenantStore = tenantStore;
        _cfg = cfg;
        _cache = cache;
        _siretValidator = siretValidator;
        _passwordBreach = passwordBreach;
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

        await using var master = await _masterFactory.CreateDbContextAsync(ct);
        var taken = await master.TenantEmailIndex.AsNoTracking()
            .AnyAsync(x => x.Email == email, ct);
        return Ok(new { available = !taken, reason = taken ? "taken" : null });
    }

    /// <summary>
    /// Vérifie en temps réel qu'un identifiant entreprise (SIRET FR / BCE BE / ICE MA /
    /// NINEA SN) est valide ET qu'il n'a pas déjà été utilisé pour souscrire un essai
    /// gratuit. Appelé en onBlur depuis le formulaire signup pour donner un feedback
    /// immédiat à l'utilisateur. La règle métier est dupliquée dans le POST /api/signup
    /// pour empêcher tout contournement côté client.
    /// </summary>
    [HttpGet("check-siret")]
    public async Task<IActionResult> CheckSiret([FromQuery] string siret, [FromQuery] string? country, CancellationToken ct)
    {
        var validation = await _siretValidator.ValidateAsync(siret, country, ct);
        if (!validation.IsValid)
            return Ok(new { available = false, reason = validation.ErrorCode, message = validation.ErrorMessage });

        var normalized = (siret ?? string.Empty).Replace(" ", "").Replace("-", "").Replace(".", "").Trim();
        await using var master = await _masterFactory.CreateDbContextAsync(ct);
        // Unicité globale (tous pays confondus) sur l'ID brut : un attaquant ne peut pas
        // contourner en changeant le pays s'il garde le même numéro. La contrainte unique
        // filtrée côté SQL (UX_Tenants_Siret_Active) est la barrière dure côté DB.
        var alreadyUsed = await master.Tenants.AsNoTracking()
            .AnyAsync(t => t.Siret == normalized && t.Status != "Failed" && t.Status != "Cancelled", ct);
        if (alreadyUsed)
            return Ok(new { available = false, reason = "siret_already_used", message = "Un compte existe déjà pour ce numéro d'entreprise. Connectez-vous depuis l'écran de login pour y accéder." });

        return Ok(new { available = true, companyName = validation.CompanyName });
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
        // (SIRET FR / BCE BE / ICE MA / NINEA SN) ne peut bénéficier que d'un seul
        // essai gratuit. La validation diffère par pays (FR a une API complète, BE a un
        // checksum local mod 97, MA/SN n'ont qu'un check format), mais l'unicité en base
        // s'applique globalement.
        var countryNormalized = string.IsNullOrWhiteSpace(req.Country) ? "FR" : req.Country.Trim().ToUpperInvariant();
        if (!IsSupportedCountry(countryNormalized))
            return BadRequest(new { error = "Pays non supporté. Choisissez parmi : FR, BE, MA, SN.", code = "country_unsupported" });

        var siretValidation = await _siretValidator.ValidateAsync(req.Siret, countryNormalized, ct);
        if (!siretValidation.IsValid)
            return BadRequest(new { error = siretValidation.ErrorMessage ?? "Identifiant entreprise invalide.", code = siretValidation.ErrorCode ?? "siret_invalid" });
        var siretNormalized = (req.Siret ?? string.Empty).Replace(" ", "").Replace("-", "").Replace(".", "").Trim();

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
            };
            master.Tenants.Add(tenant);
        }
        await master.SaveChangesAsync(ct);

        try
        {
            await _provisioning.CreateDatabaseAsync(dbName, ct);
            await _provisioning.RunMigrationsAsync(dbName, ct);
            await _provisioning.SeedInitialAsync(tenant, new ProvisioningSeedRequest(
                CompanyName: req.CompanyName,
                AdminFirstName: string.IsNullOrWhiteSpace(req.AdminFirstName) ? "Admin" : req.AdminFirstName,
                AdminLastName: string.IsNullOrWhiteSpace(req.AdminLastName) ? "Compte" : req.AdminLastName,
                AdminEmail: req.AdminEmail,
                AdminPassword: req.AdminPassword
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
            Response.Cookies.Append("admin", "1", BuildAuthCookie(DateTimeOffset.UtcNow.AddDays(7), httpOnly: false));

            var rootDomain = _cfg["Hosting:RootDomain"] ?? "concorde.com";
            var redirectUrl = $"https://{slug}.{rootDomain}/dashboard";

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
    /// Liste blanche des pays supportés à l'inscription. Toute extension passe par ce
    /// catalogue + l'ajout d'une stratégie de validation correspondante côté
    /// <see cref="SiretValidator"/>. On évite les ISO codes inconnus dans la base
    /// pour préserver l'intégrité des reports/audit.
    /// </summary>
    private static bool IsSupportedCountry(string code) =>
        code == "FR" || code == "BE" || code == "MA" || code == "SN";

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
    /// Identifiant entreprise (SIRET FR / BCE BE / ICE MA / NINEA SN). Validé selon le
    /// pays choisi et utilisé comme clé anti-fraude : un seul essai gratuit par ID.
    /// Obligatoire depuis 2026-05.
    /// </summary>
    public string Siret { get; set; } = string.Empty;
    /// <summary>
    /// Code pays ISO 3166-1 alpha-2. Valeurs supportées : FR | BE | MA | SN.
    /// Défaut FR si absent (rétro-compat). Détermine le format attendu pour Siret.
    /// </summary>
    public string? Country { get; set; }
    public string? PlanCode { get; set; }
    public string? BillingCycle { get; set; }
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
