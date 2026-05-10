using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.RegularExpressions;
using ABRPOINT.Server.Billing;
using ABRPOINT.Server.Provisioning;
using ABRPOINT.Server.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
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
    private readonly ILogger<SignupController> _log;

    public SignupController(
        IDbContextFactory<MasterDbContext> masterFactory,
        IProvisioningService provisioning,
        IBillingService billing,
        ITenantStore tenantStore,
        IConfiguration cfg,
        ILogger<SignupController> log)
    {
        _masterFactory = masterFactory;
        _provisioning = provisioning;
        _billing = billing;
        _tenantStore = tenantStore;
        _cfg = cfg;
        _log = log;
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

        await using var master = await _masterFactory.CreateDbContextAsync(ct);

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
                return Conflict(new { error = "Cet email est déjà utilisé par un autre compte." });
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
            tenant.TrialEndsAt = DateTime.UtcNow.AddDays(14);
            tenant.Region = "eu-fr";
            tenant.LegacySoccod = "01";
            tenant.StripeCustomerId = null;
            tenant.StripeSubscriptionId = null;
            tenant.OnboardingCompleted = false;
            tenant.PlanCode = string.IsNullOrWhiteSpace(req.PlanCode) ? null : req.PlanCode.Trim();
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
                TrialEndsAt = DateTime.UtcNow.AddDays(14),
                Region = "eu-fr",
                LegacySoccod = "01",
                PlanCode = string.IsNullOrWhiteSpace(req.PlanCode) ? null : req.PlanCode.Trim(),
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

            // Si l'inscription découle d'un plan payant, on garde le tenant en attente jusqu'à
            // la confirmation Stripe (webhook checkout.session.completed → Active). Tant qu'on
            // est dans cet état, les endpoints de login refusent la connexion.
            tenant.Status = req.RequiresPayment ? "PendingPayment" : "Trialing";
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
    public string? PlanCode { get; set; }
    public string? BillingCycle { get; set; }
    /// <summary>
    /// True quand l'inscription vient d'un plan payant configuré (PricingPage → PlanConfiguration → Signup).
    /// Le tenant est alors créé en statut "PendingPayment" : la connexion est refusée tant que le
    /// paiement Stripe n'est pas confirmé via le webhook checkout.session.completed.
    /// </summary>
    public bool RequiresPayment { get; set; }
}
