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
    private readonly IStorageQuotaGuard _quotaGuard;
    private readonly IConfiguration _cfg;
    private readonly ILogger<BillingController> _log;

    /// <summary>
    /// Délai de conservation des données du tenant après une résiliation, en jours.
    /// Référentiel : Code du travail FR (bulletins/contrats : 5 ans) — mais ici on parle
    /// uniquement de la fenêtre de réactivation "self-service" via /resume-checkout.
    /// Au-delà : l'utilisateur doit re-créer un compte (les données peuvent être restaurées
    /// par le support si dans la rétention légale stricte, sur demande RGPD ad hoc).
    /// </summary>
    private const int DataRetentionDaysAfterCancellation = 90;

    public BillingController(
        IDbContextFactory<MasterDbContext> masterFactory,
        ApplicationDbContext tenantDb,
        ICurrentTenant currentTenant,
        IBillingService billing,
        IStorageQuotaGuard quotaGuard,
        IConfiguration cfg,
        ILogger<BillingController> log)
    {
        _masterFactory = masterFactory;
        _tenantDb = tenantDb;
        _currentTenant = currentTenant;
        _billing = billing;
        _quotaGuard = quotaGuard;
        _cfg = cfg;
        _log = log;
    }

    /// <summary>
    /// État courant du quota de stockage du tenant. Lecture du snapshot mis à jour
    /// hourly par <c>StorageUsageHostedService</c> (mesure réelle = pg_database_size).
    /// Affiché côté dashboard admin sous forme de jauge "X Mo / Y Mo".
    /// </summary>
    [HttpGet("storage-usage")]
    public async Task<IActionResult> GetStorageUsage(CancellationToken ct)
    {
        var tenant = _currentTenant.Current;
        if (tenant is null) return BadRequest(new { error = "Tenant non résolu." });

        var snap = await _quotaGuard.GetSnapshotAsync(tenant.Id, ct);
        return Ok(new
        {
            usedMb = snap.UsedMb,
            quotaMb = snap.QuotaMb,
            // Convenances UI : versions Go arrondies pour affichage direct.
            usedGb = Math.Round((decimal)snap.UsedMb / 1024m, 2),
            quotaGb = Math.Round((decimal)snap.QuotaMb / 1024m, 2),
            percentUsed = snap.PercentUsed,
            checkedAt = snap.CheckedAt,
            planCode = tenant.PlanCode,
        });
    }

    public sealed record CheckoutRequest(
        string PlanCode,
        string BillingCycle,
        int? UserCount,
        string? PackageType,
        string? SuccessUrl,
        string? CancelUrl);

    /// <summary>
    /// Résolution miroir de <see cref="ABRPOINT.Server.Billing.StripeBillingService"/> :
    /// on essaie d'abord la clé moderne 3 segments <c>{Plan}:base:{cycle}</c>, puis la clé
    /// legacy 2 segments <c>{Plan}:{cycle}</c> en fallback. Sans cette double tentative,
    /// un tenant qui a migré sa config vers <c>Standard:base:annual</c> recevait quand
    /// même un 400 "Aucun price_id Stripe configuré pour Standard:annual" parce que le
    /// controller cherchait uniquement le format legacy. Retourne (key, priceId) — `key`
    /// est celui effectivement résolu (utile pour le message d'erreur si non trouvé).
    /// </summary>
    private (string Key, string? PriceId) ResolveBasePriceId(string planCode, string billingCycle)
    {
        var cycle = billingCycle.ToLowerInvariant();
        var prices = _cfg.GetSection("Stripe").GetSection("Prices");

        var modernKey = $"{planCode}:base:{cycle}";
        var modernPid = prices[modernKey];
        if (!string.IsNullOrWhiteSpace(modernPid) && !modernPid.Contains("REPLACE"))
            return (modernKey, modernPid);

        var legacyKey = $"{planCode}:{cycle}";
        var legacyPid = prices[legacyKey];
        if (!string.IsNullOrWhiteSpace(legacyPid) && !legacyPid.Contains("REPLACE"))
            return (legacyKey, legacyPid);

        // Aucun trouvé — on renvoie la clé moderne dans le message pour pousser la bonne convention.
        return (modernKey, null);
    }

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

        var (priceKey, priceId) = ResolveBasePriceId(req.PlanCode, req.BillingCycle);
        if (string.IsNullOrWhiteSpace(priceId))
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

        // Validation server-side du userCount : le client envoie sa valeur dans le payload,
        // mais on ne lui fait pas confiance — un attaquant peut envoyer 1 employé pour payer
        // le forfait minimum tout en gérant 500 personnes en interne. On clamp donc sur :
        //   - bas : nombre d'employés actifs réellement comptés (Empactif='A' ou Empactif='1') ;
        //   - haut : seuil raisonnable (10000) pour rejeter les payloads aberrants.
        var planDef = PlanCatalog.GetPlan(req.PlanCode);
        var requestedQty = req.UserCount.HasValue && req.UserCount.Value > 0 ? req.UserCount.Value : 1;
        if (requestedQty > 10_000)
            return BadRequest(new { error = "Nombre d'utilisateurs irréaliste.", code = "user_count_too_high" });

        // Comptage réel en base tenant — on n'écrase pas le payload si le client demande PLUS
        // que les actifs (cas légitime : provisionnement futur, batch de recrutement). On bloque
        // uniquement le sous-dimensionnement frauduleux. Le seuil minimum côté Stripe reste 1.
        var activeEmployees = await _tenantDb.Employes
            .CountAsync(e => e.Actif == "A" || e.Actif == "1" || e.Actif == "Oui", ct);
        var minimumBilled = Math.Max(1, activeEmployees);
        var billedQty = Math.Max(requestedQty, minimumBilled);
        if (billedQty > requestedQty)
        {
            _log.LogWarning(
                "Quantity Stripe ajustée pour {Slug} : client a demandé {Requested}, mais {Active} employés actifs trouvés → facturation sur {Billed}.",
                slug, requestedQty, activeEmployees, billedQty);
        }

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
                    Quantity = billedQty,
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
                ["billed_qty"] = billedQty.ToString(),
                ["active_employees_at_checkout"] = activeEmployees.ToString(),
            },
        };
        if (!string.IsNullOrWhiteSpace(tenant.StripeCustomerId))
            sessionOptions.Customer = tenant.StripeCustomerId;
        else if (!string.IsNullOrWhiteSpace(tenant.AdminEmail))
            sessionOptions.CustomerEmail = tenant.AdminEmail;

        // Idempotency-Key : sans ça, un double-clic sur le bouton "Confirmer l'achat" crée
        // deux sessions Checkout distinctes (donc potentiellement deux subscriptions). On
        // dérive la clé d'un hash stable du tuple (tenant, plan, cycle, quantité, ~minute) :
        //   - identique sur retry rapide (= idempotence vraie),
        //   - distincte si l'utilisateur change vraiment de plan plus tard.
        // La fenêtre temporelle 1min est un compromis : assez large pour absorber un retry
        // réseau, assez courte pour permettre un re-checkout immédiat après un cancel.
        var idempotencyKey = ComputeIdempotencyKey(tenant.Id, req.PlanCode, req.BillingCycle, billedQty);
        var requestOptions = new RequestOptions { IdempotencyKey = idempotencyKey };

        var sessionService = new SessionService();
        Session session;
        try
        {
            session = await sessionService.CreateAsync(sessionOptions, requestOptions, ct);
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

    /// <summary>
    /// Clé d'idempotence Stripe stable pour un tuple (tenant, plan, cycle, quantité) dans
    /// une fenêtre d'une minute. Hash SHA-256 tronqué → 32 hex chars, bien en-dessous de la
    /// limite Stripe de 255. La granularité minute évite qu'un retry valide soit refusé tout
    /// en empêchant qu'un double-clic crée deux sessions.
    /// </summary>
    private static string ComputeIdempotencyKey(Guid tenantId, string planCode, string cycle, long qty)
    {
        var bucket = DateTimeOffset.UtcNow.ToUnixTimeSeconds() / 60;
        var raw = $"{tenantId}:{planCode}:{cycle}:{qty}:{bucket}";
        var bytes = System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(raw));
        return Convert.ToHexString(bytes, 0, 16);
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
    [Microsoft.AspNetCore.RateLimiting.EnableRateLimiting("auth-resume")]
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

        // Sécurité : on autorise la reprise pour 2 cas
        //   1) PendingPayment : essai expiré ou plan Premium au signup.
        //   2) Cancelled : l'admin a résilié et veut réactiver avant la fin de la rétention.
        // RétentionData = 90 jours après CancellationRequestedAt (cf. CGU). Au-delà, on
        // considère le tenant comme définitivement clos et l'utilisateur doit re-signup.
        var isPendingPayment = string.Equals(tenant.Status, "PendingPayment", StringComparison.OrdinalIgnoreCase);
        var isCancelled = string.Equals(tenant.Status, "Cancelled", StringComparison.OrdinalIgnoreCase);
        if (!isPendingPayment && !isCancelled)
            return BadRequest(new { error = "Aucun paiement en attente pour ce compte." });
        if (isCancelled)
        {
            var cancelledAt = tenant.CancellationRequestedAt ?? DateTime.UtcNow.AddDays(-DataRetentionDaysAfterCancellation - 1);
            if (DateTime.UtcNow - cancelledAt > TimeSpan.FromDays(DataRetentionDaysAfterCancellation))
                return BadRequest(new
                {
                    error = $"Délai de réactivation dépassé ({DataRetentionDaysAfterCancellation} jours). Veuillez créer un nouveau compte.",
                    code = "retention_expired"
                });
        }

        // PG : LOWER() des deux côtés (cf. UtilisateursController.Connect).
        var emailLower = req.Email.Trim().ToLowerInvariant();
        var user = await _tenantDb.Utilisateurs.FirstOrDefaultAsync(u => u.Utimail != null && u.Utimail.ToLower() == emailLower, ct);
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
        var (priceKey, priceId) = ResolveBasePriceId(planCode, billingCycle);
        if (string.IsNullOrWhiteSpace(priceId))
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
            return StatusCode(502, new { error = "Erreur Stripe : " });
        }

        return Ok(new { url = session.Url, sessionId = session.Id });
    }

    /// <summary>
    /// Retourne l'état de l'abonnement courant pour la page "Mon abonnement" : plan, statut,
    /// fin de période, fin d'essai, et indicateurs de résiliation en cours. Toutes les
    /// données sont lues depuis la master DB — pas d'appel Stripe (les webhooks gardent
    /// CurrentPeriodEndsAt à jour, ce qui suffit pour l'affichage).
    /// </summary>
    public sealed record ChangePlanRequest(string PlanCode, string BillingCycle, int? UserCount);

    /// <summary>
    /// Preview chiffré d'un changement de plan AVANT confirmation. Renvoie le différentiel
    /// prorata-temporis que Stripe ajoutera (ou crédite) sur la prochaine facture. Aucun
    /// effet de bord (pas d'update Stripe, pas d'update tenant). Réservé Admin/Manager.
    /// </summary>
    [HttpPost("preview-plan-change")]
    public async Task<IActionResult> PreviewPlanChange([FromBody] ChangePlanRequest req, CancellationToken ct)
    {
        if (req is null || string.IsNullOrWhiteSpace(req.PlanCode) || string.IsNullOrWhiteSpace(req.BillingCycle))
            return BadRequest(new { error = "PlanCode et BillingCycle requis." });

        if (!await CallerIsAdminOrManagerAsync()) return Forbid();

        var slug = _currentTenant.Current?.Slug;
        if (string.IsNullOrEmpty(slug)) return BadRequest(new { error = "Tenant non résolu." });

        await using var master = await _masterFactory.CreateDbContextAsync(ct);
        var tenant = await master.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is null) return NotFound(new { error = "Tenant introuvable." });

        // Quantité = même règle que CreateCheckout : on prend max(req, employés actifs)
        // pour empêcher un admin de sous-déclarer son effectif pour réduire l'overage.
        var requested = req.UserCount.HasValue && req.UserCount.Value > 0 ? req.UserCount.Value : 1;
        if (requested > 10_000) return BadRequest(new { error = "Nombre d'utilisateurs irréaliste.", code = "user_count_too_high" });
        var activeEmployees = await _tenantDb.Employes
            .CountAsync(e => e.Actif == "A" || e.Actif == "1" || e.Actif == "Oui", ct);
        var billedSeats = Math.Max(Math.Max(1, activeEmployees), requested);

        var preview = await _billing.PreviewPlanChangeAsync(tenant, req.PlanCode, req.BillingCycle, billedSeats, ct);
        if (!preview.Available)
            return BadRequest(new { error = preview.UnavailableReason ?? "Preview indisponible." });

        return Ok(new
        {
            currentPlan = preview.CurrentPlan,
            newPlan = preview.NewPlan,
            prorationAmount = preview.ProrationAmount,
            currency = preview.Currency,
            nextInvoiceAt = preview.NextInvoiceAt,
            nextInvoiceTotal = preview.NextInvoiceTotal,
            billedSeats,
            activeEmployees,
        });
    }

    /// <summary>
    /// Applique le changement de plan : Stripe Subscription.UpdateAsync avec proration
    /// puis bascule du Tenant.PlanCode local. Les features deviennent immédiatement
    /// disponibles/inaccessibles (selon le sens upgrade/downgrade) ; le différentiel
    /// monétaire est ajouté à la prochaine facture régulière. Réservé Admin/Manager.
    /// </summary>
    [HttpPost("change-plan")]
    public async Task<IActionResult> ChangePlan([FromBody] ChangePlanRequest req, CancellationToken ct)
    {
        if (req is null || string.IsNullOrWhiteSpace(req.PlanCode) || string.IsNullOrWhiteSpace(req.BillingCycle))
            return BadRequest(new { error = "PlanCode et BillingCycle requis." });

        if (!await CallerIsAdminOrManagerAsync()) return Forbid();

        var slug = _currentTenant.Current?.Slug;
        if (string.IsNullOrEmpty(slug)) return BadRequest(new { error = "Tenant non résolu." });

        await using var master = await _masterFactory.CreateDbContextAsync(ct);
        var tenant = await master.Tenants.FirstOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is null) return NotFound(new { error = "Tenant introuvable." });

        // Statut bloquant : on autorise le change-plan uniquement pour les tenants
        // Active / Trialing. Un tenant PendingPayment / Suspended / Cancelled doit
        // d'abord passer par /checkout ou /resume-checkout.
        var allowedStatuses = new[] { "Active", "Trialing" };
        if (!allowedStatuses.Contains(tenant.Status, StringComparer.OrdinalIgnoreCase))
            return BadRequest(new
            {
                error = $"Le changement de plan n'est pas disponible pour le statut '{tenant.Status}'. " +
                        "Réactivez d'abord votre abonnement.",
                code = "invalid_status",
            });

        var requested = req.UserCount.HasValue && req.UserCount.Value > 0 ? req.UserCount.Value : 1;
        if (requested > 10_000) return BadRequest(new { error = "Nombre d'utilisateurs irréaliste.", code = "user_count_too_high" });
        var activeEmployees = await _tenantDb.Employes
            .CountAsync(e => e.Actif == "A" || e.Actif == "1" || e.Actif == "Oui", ct);
        var billedSeats = Math.Max(Math.Max(1, activeEmployees), requested);

        var result = await _billing.ChangePlanAsync(tenant, req.PlanCode, req.BillingCycle, billedSeats, ct);
        if (!result.Success)
            return StatusCode(502, new { error = result.ErrorMessage ?? "Échec du changement de plan." });

        return Ok(new
        {
            success = true,
            previousPlan = result.PreviousPlan,
            newPlan = result.NewPlan,
            netAmountOnNextInvoice = result.NetAmountOnNextInvoice,
            currency = result.Currency,
            nextInvoiceAt = result.NextInvoiceAt,
        });
    }

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
        // On lit Utiadm + Utirole en base — le claim "role" du JWT n'est pas peuplé dans ce projet
        // (voir UtilisateursController.UpdateUser qui suit la même convention).
        if (!await CallerIsAdminOrManagerAsync()) return Forbid();

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
            prorated = result.Prorated,
            refundedAmount = result.RefundedAmount,
            refundCurrency = result.RefundCurrency,
        });
    }

    /// <summary>
    /// Annule une résiliation planifiée (uniquement valable tant que la fin de période
    /// n'est pas atteinte). Permet à l'utilisateur de revenir sur sa décision.
    /// </summary>
    [HttpPost("resume-subscription")]
    public async Task<IActionResult> ResumeSubscription(CancellationToken ct)
    {
        if (!await CallerIsAdminOrManagerAsync()) return Forbid();

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

    /// <summary>
    /// Vérifie en base que l'appelant est admin (Utiadm=1 ou rôle "Administrator") ou
    /// manager (rôle dont le nom contient "manager"). Évite de dépendre du claim "role"
    /// du JWT, qui n'est pas peuplé dans ce projet (cf. JwtAuthService).
    /// </summary>
    private async Task<bool> CallerIsAdminOrManagerAsync()
    {
        var uticod = User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(uticod)) return false;
        var user = await _tenantDb.Utilisateurs.AsNoTracking()
            .Where(u => u.Uticod == uticod)
            .Select(u => new { u.Utiadm, u.Utirole })
            .FirstOrDefaultAsync();
        if (user is null) return false;
        if (user.Utiadm == "1") return true;
        if (ABRPOINT.Server.Authorization.PermissionCatalog.IsAdminRole(user.Utirole)) return true;
        if (!string.IsNullOrEmpty(user.Utirole)
            && user.Utirole.Contains("manager", StringComparison.OrdinalIgnoreCase)) return true;
        return false;
    }
}
