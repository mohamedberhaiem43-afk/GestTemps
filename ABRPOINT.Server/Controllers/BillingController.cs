using ABRPOINT.Server.Billing;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Stripe;
using Stripe.Checkout;

namespace ABRPOINT.Server.Controllers;

/// <summary>
/// Endpoints d'upgrade vers un plan payant. La page PlanConfiguration appelle
/// /api/billing/checkout, on crée une session Stripe Checkout (mode subscription)
/// et on renvoie l'URL hostée par Stripe vers laquelle rediriger l'utilisateur.
/// Les webhooks (cf. StripeWebhookController) flippent Tenant.Status après paiement.
/// </summary>
[ApiController]
[Route("api/billing")]
[Authorize]
public class BillingController : ControllerBase
{
    private readonly IDbContextFactory<MasterDbContext> _masterFactory;
    private readonly ApplicationDbContext _tenantDb;
    private readonly ICurrentTenant _currentTenant;
    private readonly IBillingService _billing;
    private readonly IConfiguration _cfg;
    private readonly ILogger<BillingController> _log;

    public BillingController(
        IDbContextFactory<MasterDbContext> masterFactory,
        ApplicationDbContext tenantDb,
        ICurrentTenant currentTenant,
        IBillingService billing,
        IConfiguration cfg,
        ILogger<BillingController> log)
    {
        _masterFactory = masterFactory;
        _tenantDb = tenantDb;
        _currentTenant = currentTenant;
        _billing = billing;
        _cfg = cfg;
        _log = log;
    }

    public sealed record CheckoutRequest(
        string PlanCode,
        string BillingCycle,
        int? UserCount,
        string? PackageType,
        string? SuccessUrl,
        string? CancelUrl);

    [HttpPost("checkout")]
    public async Task<IActionResult> CreateCheckout([FromBody] CheckoutRequest req, CancellationToken ct)
    {
        var slug = _currentTenant.Current?.Slug;
        if (string.IsNullOrEmpty(slug))
            return BadRequest(new { error = "Tenant non résolu." });
        if (string.IsNullOrWhiteSpace(req.PlanCode) || string.IsNullOrWhiteSpace(req.BillingCycle))
            return BadRequest(new { error = "PlanCode et BillingCycle requis." });

        var stripeSection = _cfg.GetSection("Stripe");
        var secretKey = stripeSection["SecretKey"];
        if (string.IsNullOrWhiteSpace(secretKey) || secretKey.Contains("REPLACE"))
            return StatusCode(503, new { error = "Stripe non configuré côté serveur." });

        var priceKey = $"{req.PlanCode}:{req.BillingCycle.ToLowerInvariant()}";
        var priceId = stripeSection.GetSection("Prices")[priceKey];
        if (string.IsNullOrWhiteSpace(priceId) || priceId.Contains("REPLACE"))
            return BadRequest(new { error = $"Aucun price_id Stripe configuré pour {priceKey}." });

        await using var master = await _masterFactory.CreateDbContextAsync(ct);
        var tenant = await master.Tenants.FirstOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is null)
            return NotFound(new { error = "Tenant introuvable." });

        // Persiste le plan sélectionné dès la création du checkout : sans attendre le webhook,
        // les quotas TrialPolicy.GetLimits(tenant) reflètent le plan choisi pour ce tenant.
        if (!string.Equals(tenant.PlanCode, req.PlanCode, StringComparison.OrdinalIgnoreCase))
        {
            tenant.PlanCode = req.PlanCode;
            await master.SaveChangesAsync(ct);
        }

        StripeConfiguration.ApiKey = secretKey;

        // URLs de retour : si le client n'en fournit pas, on retombe sur l'origin de la requête.
        var origin = $"{Request.Scheme}://{Request.Host}";
        var successUrl = !string.IsNullOrWhiteSpace(req.SuccessUrl)
            ? req.SuccessUrl
            : $"{origin}/dashboard?checkout=success&session_id={{CHECKOUT_SESSION_ID}}";
        var cancelUrl = !string.IsNullOrWhiteSpace(req.CancelUrl)
            ? req.CancelUrl
            : $"{origin}/dashboard/plan-configuration?checkout=cancelled";

        var sessionOptions = new SessionCreateOptions
        {
            Mode = "subscription",
            SuccessUrl = successUrl,
            CancelUrl = cancelUrl,
            LineItems = new List<SessionLineItemOptions>
            {
                new()
                {
                    Price = priceId,
                    Quantity = req.UserCount.HasValue && req.UserCount.Value > 0 ? req.UserCount.Value : 1,
                }
            },
            ClientReferenceId = tenant.Id.ToString(),
            Metadata = new Dictionary<string, string>
            {
                ["tenant_id"] = tenant.Id.ToString(),
                ["tenant_slug"] = tenant.Slug,
                ["plan"] = req.PlanCode,
                ["cycle"] = req.BillingCycle,
                ["package"] = req.PackageType ?? string.Empty,
            },
        };
        if (!string.IsNullOrWhiteSpace(tenant.StripeCustomerId))
            sessionOptions.Customer = tenant.StripeCustomerId;
        else if (!string.IsNullOrWhiteSpace(tenant.AdminEmail))
            sessionOptions.CustomerEmail = tenant.AdminEmail;

        var sessionService = new SessionService();
        Session session;
        try
        {
            session = await sessionService.CreateAsync(sessionOptions, cancellationToken: ct);
        }
        catch (StripeException ex)
        {
            // SEC-18 — Avant : on remontait `ex.Message` au client, ce qui pouvait fuiter
            // l'ID compte Stripe, des détails de configuration, ou des paramètres internes.
            // Maintenant : log structuré côté serveur + message générique avec un code
            // pour que le support puisse corréler en cas de ticket utilisateur.
            _log.LogError(ex, "Stripe Checkout création échouée pour tenant {Slug}. StripeError={Code}", slug, ex.StripeError?.Code);
            return StatusCode(502, new { error = "Erreur lors de l'initialisation du paiement. Veuillez réessayer plus tard.", code = ex.StripeError?.Code });
        }

        return Ok(new { url = session.Url, sessionId = session.Id });
    }

    public sealed record ResumeCheckoutRequest(
        string Email,
        string Password,
        string? PlanCode,
        string? BillingCycle,
        int? UserCount,
        string? PackageType,
        string? SuccessUrl,
        string? CancelUrl);

    /// <summary>
    /// Permet à un utilisateur dont le tenant est en "PendingPayment" (donc
    /// /Utilisateurs/connect renvoie 402) de relancer une session Stripe Checkout
    /// sans passer par un cookie d'authentification. Vérifie email/mot de passe
    /// dans la base du tenant courant (résolu via X-Tenant-Slug).
    /// </summary>
    [HttpPost("resume-checkout")]
    [AllowAnonymous]
    public async Task<IActionResult> ResumeCheckout([FromBody] ResumeCheckoutRequest req, CancellationToken ct)
    {
        if (req is null || string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
            return BadRequest(new { error = "Email et mot de passe requis." });

        var slug = _currentTenant.Current?.Slug;
        if (string.IsNullOrEmpty(slug))
            return BadRequest(new { error = "Tenant non résolu." });

        await using var master = await _masterFactory.CreateDbContextAsync(ct);
        var tenant = await master.Tenants.FirstOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is null)
            return NotFound(new { error = "Tenant introuvable." });

        // Sécurité : on n'autorise la reprise que si le tenant attend effectivement un paiement.
        if (!string.Equals(tenant.Status, "PendingPayment", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { error = "Aucun paiement en attente pour ce compte." });

        var user = await _tenantDb.Utilisateurs.FirstOrDefaultAsync(u => u.Utimail == req.Email, ct);
        if (user is null || !BCrypt.Net.BCrypt.Verify(req.Password, user.Utimps))
            return Unauthorized(new { error = "Identifiants invalides." });

        var stripeSection = _cfg.GetSection("Stripe");
        var secretKey = stripeSection["SecretKey"];
        if (string.IsNullOrWhiteSpace(secretKey) || secretKey.Contains("REPLACE"))
            return StatusCode(503, new { error = "Stripe non configuré côté serveur." });

        // Plan : valeurs raisonnables par défaut si le frontend n'en fournit pas (cas du
        // login bloqué — on ne re-demande pas la configuration du plan, l'utilisateur
        // peut ajuster les quantités sur la page Stripe).
        var planCode = string.IsNullOrWhiteSpace(req.PlanCode) ? "Standard" : req.PlanCode!;
        var billingCycle = string.IsNullOrWhiteSpace(req.BillingCycle) ? "monthly" : req.BillingCycle!;
        var priceKey = $"{planCode}:{billingCycle.ToLowerInvariant()}";
        var priceId = stripeSection.GetSection("Prices")[priceKey];
        if (string.IsNullOrWhiteSpace(priceId) || priceId.Contains("REPLACE"))
            return BadRequest(new { error = $"Aucun price_id Stripe configuré pour {priceKey}." });

        StripeConfiguration.ApiKey = secretKey;

        var origin = $"{Request.Scheme}://{Request.Host}";
        var successUrl = !string.IsNullOrWhiteSpace(req.SuccessUrl)
            ? req.SuccessUrl
            : $"{origin}/dashboard?checkout=success&session_id={{CHECKOUT_SESSION_ID}}";
        var cancelUrl = !string.IsNullOrWhiteSpace(req.CancelUrl)
            ? req.CancelUrl
            : $"{origin}/dashboard/plan-configuration?checkout=cancelled";

        var sessionOptions = new SessionCreateOptions
        {
            Mode = "subscription",
            SuccessUrl = successUrl,
            CancelUrl = cancelUrl,
            LineItems = new List<SessionLineItemOptions>
            {
                new()
                {
                    Price = priceId,
                    Quantity = req.UserCount.HasValue && req.UserCount.Value > 0 ? req.UserCount.Value : 1,
                }
            },
            ClientReferenceId = tenant.Id.ToString(),
            Metadata = new Dictionary<string, string>
            {
                ["tenant_id"] = tenant.Id.ToString(),
                ["tenant_slug"] = tenant.Slug,
                ["plan"] = planCode,
                ["cycle"] = billingCycle,
                ["package"] = req.PackageType ?? string.Empty,
                ["resume"] = "1",
            },
        };
        if (!string.IsNullOrWhiteSpace(tenant.StripeCustomerId))
            sessionOptions.Customer = tenant.StripeCustomerId;
        else if (!string.IsNullOrWhiteSpace(tenant.AdminEmail))
            sessionOptions.CustomerEmail = tenant.AdminEmail;

        var sessionService = new SessionService();
        Session session;
        try
        {
            session = await sessionService.CreateAsync(sessionOptions, cancellationToken: ct);
        }
        catch (StripeException ex)
        {
            _log.LogError(ex, "Stripe Checkout (resume) création échouée pour tenant {Slug}.", slug);
            return StatusCode(502, new { error = "Erreur Stripe : " + ex.Message });
        }

        return Ok(new { url = session.Url, sessionId = session.Id });
    }

    /// <summary>
    /// Retourne l'état de l'abonnement courant pour la page "Mon abonnement" : plan, statut,
    /// fin de période, fin d'essai, et indicateurs de résiliation en cours. Toutes les
    /// données sont lues depuis la master DB — pas d'appel Stripe (les webhooks gardent
    /// CurrentPeriodEndsAt à jour, ce qui suffit pour l'affichage).
    /// </summary>
    [HttpGet("subscription")]
    public async Task<IActionResult> GetSubscription(CancellationToken ct)
    {
        var slug = _currentTenant.Current?.Slug;
        if (string.IsNullOrEmpty(slug))
            return BadRequest(new { error = "Tenant non résolu." });

        await using var master = await _masterFactory.CreateDbContextAsync(ct);
        var tenant = await master.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is null)
            return NotFound(new { error = "Tenant introuvable." });

        return Ok(new
        {
            slug = tenant.Slug,
            companyName = tenant.CompanyName,
            status = tenant.Status,
            planCode = tenant.PlanCode,
            trialEndsAt = tenant.TrialEndsAt,
            currentPeriodEndsAt = tenant.CurrentPeriodEndsAt,
            cancelAtPeriodEnd = tenant.CancelAtPeriodEnd,
            cancellationRequestedAt = tenant.CancellationRequestedAt,
            hasActiveStripeSubscription = !string.IsNullOrEmpty(tenant.StripeSubscriptionId),
        });
    }

    public sealed record CancelSubscriptionRequest(bool Immediate, string? Reason);

    /// <summary>
    /// Résilie l'abonnement du tenant courant. <c>Immediate=true</c> coupe l'accès tout de
    /// suite, <c>Immediate=false</c> programme la résiliation pour la fin de la période en
    /// cours (l'accès est conservé jusque-là, conforme aux attentes B2B SaaS).
    /// Réservé aux rôles Admin / Manager (mêmes rôles que pour /checkout).
    /// </summary>
    [HttpPost("cancel-subscription")]
    public async Task<IActionResult> CancelSubscription([FromBody] CancelSubscriptionRequest req, CancellationToken ct)
    {
        if (req is null)
            return BadRequest(new { error = "Requête invalide." });

        // Sécurité : seuls Admin/Manager peuvent résilier (mêmes rôles que la gestion de paiement).
        var role = User?.FindFirst("role")?.Value ?? User?.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;
        if (!string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(role, "Manager", StringComparison.OrdinalIgnoreCase))
            return Forbid();

        var slug = _currentTenant.Current?.Slug;
        if (string.IsNullOrEmpty(slug))
            return BadRequest(new { error = "Tenant non résolu." });

        await using var master = await _masterFactory.CreateDbContextAsync(ct);
        var tenant = await master.Tenants.FirstOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is null)
            return NotFound(new { error = "Tenant introuvable." });

        if (string.Equals(tenant.Status, "Cancelled", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { error = "Abonnement déjà résilié." });

        var result = await _billing.CancelSubscriptionAsync(tenant, req.Immediate, req.Reason, ct);
        if (!result.Success)
            return StatusCode(502, new { error = result.ErrorMessage ?? "Échec de la résiliation." });

        return Ok(new
        {
            success = true,
            immediate = result.Immediate,
            effectiveAt = result.EffectiveAt,
        });
    }

    /// <summary>
    /// Annule une résiliation planifiée (uniquement valable tant que la fin de période
    /// n'est pas atteinte). Permet à l'utilisateur de revenir sur sa décision.
    /// </summary>
    [HttpPost("resume-subscription")]
    public async Task<IActionResult> ResumeSubscription(CancellationToken ct)
    {
        var role = User?.FindFirst("role")?.Value ?? User?.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;
        if (!string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(role, "Manager", StringComparison.OrdinalIgnoreCase))
            return Forbid();

        var slug = _currentTenant.Current?.Slug;
        if (string.IsNullOrEmpty(slug))
            return BadRequest(new { error = "Tenant non résolu." });

        await using var master = await _masterFactory.CreateDbContextAsync(ct);
        var tenant = await master.Tenants.FirstOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is null)
            return NotFound(new { error = "Tenant introuvable." });
        if (!tenant.CancelAtPeriodEnd)
            return BadRequest(new { error = "Aucune résiliation planifiée à annuler." });

        var ok = await _billing.ResumeSubscriptionAsync(tenant, ct);
        if (!ok)
            return StatusCode(502, new { error = "Impossible d'annuler la résiliation côté Stripe." });

        return Ok(new { success = true });
    }
}
