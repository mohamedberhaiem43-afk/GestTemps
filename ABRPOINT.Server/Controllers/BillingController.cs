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
    private readonly Interfaces.IEmailService _email;
    private readonly ITenantStore _tenantStore;

    /// <summary>
    /// Adresse interne notifiée à chaque résiliation pour suivi commercial / churn.
    /// Hardcodée (et non dans appsettings) pour rester traçable côté code review —
    /// si on veut la rendre configurable plus tard, déplacer vers Billing:ChurnAlertsTo.
    /// </summary>
    private const string ChurnAlertRecipient = "mohamed@concorde-work-force.com";

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
        ILogger<BillingController> log,
        Interfaces.IEmailService email,
        ITenantStore tenantStore)
    {
        _masterFactory = masterFactory;
        _tenantDb = tenantDb;
        _currentTenant = currentTenant;
        _billing = billing;
        _quotaGuard = quotaGuard;
        _cfg = cfg;
        _log = log;
        _email = email;
        _tenantStore = tenantStore;
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

    public sealed record ConfirmCheckoutRequest(string SessionId);

    /// <summary>
    /// Réconciliation active post-checkout : interroge Stripe pour savoir si la session
    /// est payée et bascule Tenant.Status → "Active" si oui. Sert de fallback quand le
    /// webhook checkout.session.completed tarde à arriver (retry queue Stripe, DNS,
    /// reverse proxy intermittent…). Idempotent — si le webhook arrive juste après, il
    /// fera UPDATE Status='Active' sur un tenant déjà Active : no-op.
    ///
    /// SEC : la session DOIT correspondre au tenant courant (client_reference_id matché),
    /// sinon un attaquant pourrait activer le tenant d'un tiers en lui passant une
    /// session_id qu'il aurait payée pour un autre customer.
    /// </summary>
    [HttpPost("confirm-checkout")]
    public async Task<IActionResult> ConfirmCheckout([FromBody] ConfirmCheckoutRequest req, CancellationToken ct)
    {
        if (req is null || string.IsNullOrWhiteSpace(req.SessionId))
            return BadRequest(new { error = "SessionId requis." });

        var slug = _currentTenant.Current?.Slug;
        if (string.IsNullOrEmpty(slug))
            return BadRequest(new { error = "Tenant non résolu." });

        var secretKey = _cfg["Stripe:SecretKey"];
        if (string.IsNullOrWhiteSpace(secretKey) || secretKey.Contains("REPLACE"))
            return StatusCode(503, new { error = "Stripe non configuré côté serveur." });
        StripeConfiguration.ApiKey = secretKey;

        await using var master = await _masterFactory.CreateDbContextAsync(ct);
        var tenant = await master.Tenants.FirstOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is null)
            return NotFound(new { error = "Tenant introuvable." });

        // Court-circuit : déjà Active → rien à faire, on renvoie le statut courant pour que
        // le front sorte de son polling immédiatement.
        if (string.Equals(tenant.Status, "Active", StringComparison.OrdinalIgnoreCase))
            return Ok(new { status = tenant.Status, alreadyActive = true });

        Session session;
        try
        {
            session = await new SessionService().GetAsync(req.SessionId, cancellationToken: ct);
        }
        catch (StripeException ex)
        {
            _log.LogError(ex, "Lecture session Stripe {SessionId} échouée pour tenant {Slug}.", req.SessionId, slug);
            return StatusCode(502, new { error = "Impossible de vérifier la session Stripe." });
        }

        if (!Guid.TryParse(session?.ClientReferenceId, out var tenantIdFromSession) || tenantIdFromSession != tenant.Id)
        {
            _log.LogWarning("Session Stripe {SessionId} ne correspond pas au tenant {Slug} (client_reference_id={ClientRef}).",
                req.SessionId, slug, session?.ClientReferenceId);
            return BadRequest(new { error = "Session non rattachée à ce tenant." });
        }

        // payment_status possibles : "paid", "unpaid", "no_payment_required".
        // unpaid = en cours de traitement (SEPA, carte 3DS…) → on laisse le front re-poll.
        var isPaid = string.Equals(session.PaymentStatus, "paid", StringComparison.OrdinalIgnoreCase)
                  || string.Equals(session.PaymentStatus, "no_payment_required", StringComparison.OrdinalIgnoreCase);
        if (!isPaid)
        {
            return Ok(new { status = tenant.Status, paymentStatus = session.PaymentStatus, reconciled = false });
        }

        // Réplique la logique du webhook checkout.session.completed (cf. StripeWebhookController).
        if (!string.IsNullOrEmpty(session.SubscriptionId)) tenant.StripeSubscriptionId = session.SubscriptionId;
        if (!string.IsNullOrEmpty(session.CustomerId)) tenant.StripeCustomerId = session.CustomerId;
        tenant.Status = "Active";
        await master.SaveChangesAsync(ct);
        _tenantStore.Invalidate(tenant.Slug);

        _log.LogInformation("Tenant {Slug} → Active via /confirm-checkout (réconciliation, session={SessionId}).", tenant.Slug, req.SessionId);
        return Ok(new { status = tenant.Status, reconciled = true });
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

        // Alerte interne de churn — best-effort, on ne fait pas échouer la résiliation
        // si l'email ne part pas (l'effet métier principal est déjà persisté côté Stripe + DB).
        _ = SendChurnAlertEmailAsync(tenant, req, result);

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
    /// Envoie une notification interne (<see cref="ChurnAlertRecipient"/>) à chaque
    /// résiliation. Contenu : date, client (slug + raison sociale), motif et type
    /// (immédiate / fin de période). Fire-and-forget : capture toute exception
    /// pour ne jamais perturber la réponse HTTP de /cancel-subscription.
    /// </summary>
    private async Task SendChurnAlertEmailAsync(Tenancy.Tenant tenant, CancelSubscriptionRequest req, Billing.CancellationResult result)
    {
        try
        {
            var typeLabel = result.Immediate ? "Résiliation immédiate" : "Résiliation programmée (fin de période)";
            var dateLabel = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm 'UTC'", System.Globalization.CultureInfo.InvariantCulture);
            var effectiveLabel = result.EffectiveAt?.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture) ?? "—";
            var motif = string.IsNullOrWhiteSpace(req.Reason) ? "<em>(aucun motif fourni)</em>" : System.Net.WebUtility.HtmlEncode(req.Reason);
            var company = System.Net.WebUtility.HtmlEncode(tenant.CompanyName ?? "—");
            var slug = System.Net.WebUtility.HtmlEncode(tenant.Slug ?? "—");
            var adminEmail = System.Net.WebUtility.HtmlEncode(tenant.AdminEmail ?? "—");

            var subject = $"[Concorde Workforce] Résiliation — {tenant.CompanyName} ({tenant.Slug})";
            var body = $@"<html><body style=""font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a;line-height:1.55"">
<h2 style=""color:#0040a1;margin:0 0 12px"">Nouvelle résiliation d'abonnement</h2>
<p style=""color:#475569;margin:0 0 16px"">Un tenant vient de résilier son abonnement Concorde Workforce. Détails ci-dessous pour suivi commercial / churn.</p>
<table cellpadding=""6"" cellspacing=""0"" style=""border-collapse:collapse;border:1px solid #e2e8f0"">
  <tr><td style=""font-weight:700;background:#f8fafc;border:1px solid #e2e8f0"">Date</td><td style=""border:1px solid #e2e8f0"">{dateLabel}</td></tr>
  <tr><td style=""font-weight:700;background:#f8fafc;border:1px solid #e2e8f0"">Client (raison sociale)</td><td style=""border:1px solid #e2e8f0"">{company}</td></tr>
  <tr><td style=""font-weight:700;background:#f8fafc;border:1px solid #e2e8f0"">Slug / sous-domaine</td><td style=""border:1px solid #e2e8f0"">{slug}</td></tr>
  <tr><td style=""font-weight:700;background:#f8fafc;border:1px solid #e2e8f0"">Admin contact</td><td style=""border:1px solid #e2e8f0"">{adminEmail}</td></tr>
  <tr><td style=""font-weight:700;background:#f8fafc;border:1px solid #e2e8f0"">Type</td><td style=""border:1px solid #e2e8f0"">{typeLabel}</td></tr>
  <tr><td style=""font-weight:700;background:#f8fafc;border:1px solid #e2e8f0"">Effet</td><td style=""border:1px solid #e2e8f0"">{effectiveLabel}</td></tr>
  <tr><td style=""font-weight:700;background:#f8fafc;border:1px solid #e2e8f0"">Motif déclaré</td><td style=""border:1px solid #e2e8f0"">{motif}</td></tr>
  <tr><td style=""font-weight:700;background:#f8fafc;border:1px solid #e2e8f0"">Pack</td><td style=""border:1px solid #e2e8f0"">{System.Net.WebUtility.HtmlEncode(tenant.PlanCode ?? "—")}</td></tr>
</table>
<p style=""color:#94a3b8;font-size:12px;margin-top:18px"">Email automatique envoyé par BillingController.CancelSubscription. Conserver les 90 jours pour analyse churn.</p>
</body></html>";

            await _email.SendEmailAsync(ChurnAlertRecipient, subject, body);
            _log.LogInformation("Alerte churn envoyée à {Recipient} pour le tenant {Slug}.", ChurnAlertRecipient, tenant.Slug);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Échec d'envoi de l'alerte churn pour {Slug} (best-effort).", tenant.Slug);
        }
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
    /// Carte de paiement par défaut du customer Stripe — récupérée via l'API Stripe
    /// (jamais persistée côté tenant pour rester PCI-DSS compliant : seuls les 4
    /// derniers chiffres + brand + expiration sont retournés, pas le PAN complet).
    /// Utilisé par la section « Carte de paiement » de /dashboard/mon-abonnement.
    /// </summary>
    [HttpGet("payment-method")]
    public async Task<IActionResult> GetPaymentMethod(CancellationToken ct)
    {
        var slug = _currentTenant.Current?.Slug;
        if (string.IsNullOrEmpty(slug))
            return BadRequest(new { error = "Tenant non résolu." });

        await using var master = await _masterFactory.CreateDbContextAsync(ct);
        var tenant = await master.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is null) return NotFound(new { error = "Tenant introuvable." });
        if (string.IsNullOrEmpty(tenant.StripeCustomerId))
            return Ok(new { hasCard = false });

        var secretKey = _cfg["Stripe:SecretKey"];
        if (string.IsNullOrWhiteSpace(secretKey) || secretKey.Contains("REPLACE"))
            return StatusCode(503, new { error = "Stripe non configuré côté serveur." });
        StripeConfiguration.ApiKey = secretKey;

        try
        {
            // On lit d'abord le default_payment_method de la subscription active, puis fallback
            // sur le invoice_settings.default_payment_method du customer (le scénario Stripe
            // Checkout standard pose le PM sur les deux mais des flows custom peuvent diverger).
            string? paymentMethodId = null;
            if (!string.IsNullOrEmpty(tenant.StripeSubscriptionId))
            {
                try
                {
                    var sub = await new SubscriptionService().GetAsync(tenant.StripeSubscriptionId, cancellationToken: ct);
                    paymentMethodId = sub?.DefaultPaymentMethodId;
                }
                catch (StripeException) { /* sub introuvable / cancelled — on bascule sur le customer */ }
            }
            if (string.IsNullOrEmpty(paymentMethodId))
            {
                var customer = await new CustomerService().GetAsync(tenant.StripeCustomerId, cancellationToken: ct);
                paymentMethodId = customer?.InvoiceSettings?.DefaultPaymentMethodId;
            }
            if (string.IsNullOrEmpty(paymentMethodId))
                return Ok(new { hasCard = false });

            var pm = await new PaymentMethodService().GetAsync(paymentMethodId, cancellationToken: ct);
            if (pm?.Card is null) return Ok(new { hasCard = false });

            return Ok(new
            {
                hasCard = true,
                brand = pm.Card.Brand,           // "visa", "mastercard", "amex"…
                last4 = pm.Card.Last4,
                expMonth = pm.Card.ExpMonth,
                expYear = pm.Card.ExpYear,
            });
        }
        catch (StripeException ex)
        {
            _log.LogError(ex, "Lecture du PaymentMethod échouée pour tenant {Slug}.", slug);
            return StatusCode(502, new { error = "Impossible de lire la carte de paiement." });
        }
    }

    /// <summary>
    /// Crée une session Stripe Billing Portal pour permettre à l'admin de mettre à jour
    /// sa carte / consulter ses factures côté Stripe. On délègue 100 % à Stripe pour ne
    /// jamais manipuler le PAN ni le CVV côté serveur (PCI-DSS SAQ A — scope minimal).
    /// </summary>
    [HttpPost("portal-session")]
    public async Task<IActionResult> CreatePortalSession([FromBody] PortalSessionRequest? req, CancellationToken ct)
    {
        if (!await CallerIsAdminOrManagerAsync())
            return Forbid();

        var slug = _currentTenant.Current?.Slug;
        if (string.IsNullOrEmpty(slug))
            return BadRequest(new { error = "Tenant non résolu." });

        await using var master = await _masterFactory.CreateDbContextAsync(ct);
        var tenant = await master.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is null) return NotFound(new { error = "Tenant introuvable." });
        if (string.IsNullOrEmpty(tenant.StripeCustomerId))
            return BadRequest(new { error = "Aucun customer Stripe rattaché à ce tenant." });

        var secretKey = _cfg["Stripe:SecretKey"];
        if (string.IsNullOrWhiteSpace(secretKey) || secretKey.Contains("REPLACE"))
            return StatusCode(503, new { error = "Stripe non configuré côté serveur." });
        StripeConfiguration.ApiKey = secretKey;

        var origin = $"{Request.Scheme}://{Request.Host}";
        var returnUrl = !string.IsNullOrWhiteSpace(req?.ReturnUrl)
            ? req!.ReturnUrl!
            : $"{origin}/dashboard/mon-abonnement";

        try
        {
            var session = await new Stripe.BillingPortal.SessionService().CreateAsync(
                new Stripe.BillingPortal.SessionCreateOptions
                {
                    Customer = tenant.StripeCustomerId,
                    ReturnUrl = returnUrl,
                }, cancellationToken: ct);
            return Ok(new { url = session.Url });
        }
        catch (StripeException ex)
        {
            _log.LogError(ex, "Création portal-session Stripe échouée pour tenant {Slug}.", slug);
            return StatusCode(502, new { error = "Impossible d'ouvrir le portail de facturation." });
        }
    }

    /// <summary>
    /// Liste les factures à venir + les 12 dernières factures émises pour le customer
    /// Stripe du tenant. Alimente la page « Factures Concorde » du dashboard.
    /// Retourne montants HT + TTC, période couverte, statut (open / paid / draft).
    /// </summary>
    [HttpGet("invoices")]
    public async Task<IActionResult> GetInvoices(CancellationToken ct)
    {
        var slug = _currentTenant.Current?.Slug;
        if (string.IsNullOrEmpty(slug))
            return BadRequest(new { error = "Tenant non résolu." });

        await using var master = await _masterFactory.CreateDbContextAsync(ct);
        var tenant = await master.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is null) return NotFound(new { error = "Tenant introuvable." });
        if (string.IsNullOrEmpty(tenant.StripeCustomerId))
            return Ok(new { upcoming = (object?)null, history = new object[0] });

        var secretKey = _cfg["Stripe:SecretKey"];
        if (string.IsNullOrWhiteSpace(secretKey) || secretKey.Contains("REPLACE"))
            return StatusCode(503, new { error = "Stripe non configuré côté serveur." });
        StripeConfiguration.ApiKey = secretKey;

        object? upcoming = null;
        try
        {
            // Stripe.InvoiceService.UpcomingAsync simule la prochaine facture à venir
            // basée sur la subscription active (subscription items + proration). Si pas
            // d'abonnement actif, l'appel lève → on retombe sur null silencieusement.
            var upcomingInvoice = await new InvoiceService().UpcomingAsync(
                new UpcomingInvoiceOptions { Customer = tenant.StripeCustomerId },
                cancellationToken: ct);
            if (upcomingInvoice != null)
            {
                upcoming = SerializeInvoice(upcomingInvoice, isUpcoming: true);
            }
        }
        catch (StripeException ex) when (ex.StripeError?.Code == "invoice_upcoming_none")
        {
            // Pas de subscription active → pas de facture à venir, comportement attendu.
        }
        catch (StripeException ex)
        {
            _log.LogWarning(ex, "CreateUpcoming échoué pour tenant {Slug} — on continue avec l'historique.", slug);
        }

        var history = new List<object>();
        try
        {
            var listed = await new InvoiceService().ListAsync(new InvoiceListOptions
            {
                Customer = tenant.StripeCustomerId,
                Limit = 12,
            }, cancellationToken: ct);
            foreach (var inv in listed.Data)
                history.Add(SerializeInvoice(inv, isUpcoming: false));
        }
        catch (StripeException ex)
        {
            _log.LogError(ex, "Lecture des factures Stripe échouée pour tenant {Slug}.", slug);
            return StatusCode(502, new { error = "Impossible de récupérer les factures." });
        }

        return Ok(new { upcoming, history });
    }

    /// <summary>
    /// Projection minimale d'une facture Stripe → DTO JSON consommé par le front.
    /// Montants en euros (Stripe les expose en centimes). On expose AmountDue (TTC) +
    /// SubtotalExcludingTax (HT) quand dispo, sinon Subtotal (qui peut inclure les
    /// remises mais hors taxes en France si le tax behavior est "exclusive").
    /// </summary>
    private static object SerializeInvoice(Invoice inv, bool isUpcoming)
    {
        long amountTtcCents = inv.AmountDue;
        long amountHtCents = inv.SubtotalExcludingTax ?? inv.Subtotal;
        long? taxCents = (inv.Tax) ?? null;
        return new
        {
            id = inv.Id,
            number = inv.Number,                                 // null si upcoming
            status = isUpcoming ? "upcoming" : inv.Status,        // "open" / "paid" / "draft" / "upcoming"
            currency = (inv.Currency ?? "eur").ToUpperInvariant(),
            amountHt = amountHtCents / 100m,
            amountTtc = amountTtcCents / 100m,
            tax = taxCents.HasValue ? taxCents.Value / 100m : (decimal?)null,
            periodStart = inv.PeriodStart,
            periodEnd = inv.PeriodEnd,
            issuedAt = isUpcoming ? (DateTime?)null : inv.Created,
            dueDate = inv.DueDate,
            hostedInvoiceUrl = inv.HostedInvoiceUrl,
            invoicePdf = inv.InvoicePdf,
            description = inv.Lines?.Data?.FirstOrDefault()?.Description,
        };
    }

    public sealed record PortalSessionRequest(string? ReturnUrl);

    /// <summary>
    /// Met à jour la liste des addons souscrits par le tenant courant (cf. Tenant.Addons).
    /// Permet à l'admin de souscrire/désouscrire des modules optionnels APRÈS le signup
    /// initial, sans repasser par un nouveau parcours Stripe Checkout. Le payload est
    /// une liste de clés d'addons (cf. <see cref="PlanCatalog.ValidAddonKeys"/>) ; toute
    /// clé inconnue est silencieusement ignorée. Les addons valides sont sérialisés en
    /// CSV dédupliqué et persistés sur le Tenant.
    ///
    /// IMPORTANT — pas de sync Stripe pour l'instant :
    /// Les SKU Stripe par addon (price_addon_signature, price_addon_api…) ne sont pas
    /// encore configurés côté Stripe Dashboard. Cet endpoint active donc UNIQUEMENT la
    /// dimension fonctionnelle (Tenant.Addons → /me planFeatures via GetEffectiveFeatures
    /// → sidebar + endpoints gated par RequirePlanFeature). La facturation Stripe reste au
    /// tarif du pack seul. À brancher avec Subscription items quand les SKU existeront.
    /// Auth : admin OU manager du tenant courant (mêmes pré-requis que /billing/cancel
    /// et /billing/change-plan).
    /// </summary>
    [HttpPut("addons")]
    public async Task<IActionResult> UpdateAddons([FromBody] UpdateAddonsRequest req, CancellationToken ct)
    {
        if (!await CallerIsAdminOrManagerAsync()) return Forbid();

        var slug = _currentTenant.Current?.Slug;
        if (string.IsNullOrEmpty(slug))
            return BadRequest(new { error = "Tenant non résolu." });

        // Normalisation : filtre les clés invalides + dédupe + ordre stable (alphabétique
        // pour faciliter les comparaisons côté audit). Si la liste finale est vide → null
        // pour matcher la sémantique « pas d'addons » utilisée par GetEffectiveFeatures.
        var requested = (req?.Addons ?? new List<string>())
            .Where(a => !string.IsNullOrWhiteSpace(a))
            .Select(a => a.Trim())
            .Where(a => Tenancy.PlanCatalog.ValidAddonKeys.Contains(a))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(a => a, StringComparer.OrdinalIgnoreCase)
            .ToList();
        var addonsCsv = requested.Count == 0 ? null : string.Join(",", requested);

        await using var master = await _masterFactory.CreateDbContextAsync(ct);
        var tenant = await master.Tenants.FirstOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is null)
            return NotFound(new { error = "Tenant introuvable." });

        tenant.Addons = addonsCsv;
        await master.SaveChangesAsync(ct);

        // Invalider le cache tenant pour que le prochain /me lise la nouvelle valeur
        // d'addons (sinon le user devrait attendre l'expiration TTL côté ITenantStore).
        _tenantStore.Invalidate(slug);

        _log.LogInformation("Tenant {Slug} addons mis à jour → [{Addons}]", slug, addonsCsv ?? "(none)");

        return Ok(new { addons = requested.ToArray() });
    }

    public sealed record UpdateAddonsRequest(List<string>? Addons);

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
