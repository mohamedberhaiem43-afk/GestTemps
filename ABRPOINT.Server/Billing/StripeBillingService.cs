using ABRPOINT.Server.Tenancy;
using Microsoft.EntityFrameworkCore;
using Stripe;

namespace ABRPOINT.Server.Billing;

public sealed class StripeBillingService : IBillingService
{
    private readonly IDbContextFactory<MasterDbContext> _masterFactory;
    private readonly ITenantStore _store;
    private readonly StripeOptions _opts;
    private readonly ILogger<StripeBillingService> _log;
    private readonly CustomerService _customers;
    private readonly SubscriptionService _subscriptions;

    public StripeBillingService(
        IDbContextFactory<MasterDbContext> masterFactory,
        ITenantStore store,
        IConfiguration cfg,
        ILogger<StripeBillingService> log)
    {
        _masterFactory = masterFactory;
        _store = store;
        _log = log;
        _opts = StripeOptions.Read(cfg);

        // Configure la clé secrète Stripe globalement pour les services SDK.
        if (!string.IsNullOrWhiteSpace(_opts.SecretKey))
            StripeConfiguration.ApiKey = _opts.SecretKey;

        _customers = new CustomerService();
        _subscriptions = new SubscriptionService();
    }

    public async Task<BillingProvisionResult> CreateCustomerAndTrialAsync(
        Tenant tenant,
        string? planCode,
        string? billingCycle,
        CancellationToken ct = default)
    {
        if (!_opts.IsConfigured)
        {
            _log.LogWarning("Stripe non configuré (clé manquante). Provisioning Stripe sauté pour tenant {Slug}.", tenant.Slug);
            return new BillingProvisionResult(null, null, tenant.TrialEndsAt, Skipped: true, SkipReason: "Stripe key missing");
        }

        // Idempotence : si le tenant a déjà un customer + subscription, on ne rejoue pas.
        if (!string.IsNullOrEmpty(tenant.StripeCustomerId) && !string.IsNullOrEmpty(tenant.StripeSubscriptionId))
        {
            return new BillingProvisionResult(tenant.StripeCustomerId, tenant.StripeSubscriptionId, tenant.TrialEndsAt, Skipped: true, SkipReason: "Already provisioned");
        }

        var customer = await _customers.CreateAsync(new CustomerCreateOptions
        {
            Email = tenant.AdminEmail,
            Name = tenant.CompanyName,
            Description = $"Tenant {tenant.Slug} ({tenant.Region})",
            Metadata = new Dictionary<string, string>
            {
                ["tenant_id"] = tenant.Id.ToString(),
                ["tenant_slug"] = tenant.Slug,
                ["tenant_db"] = tenant.DbName,
            }
        }, cancellationToken: ct);

        // Modèle V2 : 2 items par souscription — un forfait (base) + un seat metered (overage).
        // L'item seat est créé avec quantité 0 au signup (les premiers IncludedEmployees salariés
        // sont couverts par le forfait) et incrémenté plus tard par EmployeeBillingSync quand le
        // tenant dépasse l'inclus.
        var canonical = ABRPOINT.Server.Tenancy.PlanCatalog.Normalize(planCode);
        var basePriceId = ResolvePriceId(canonical, "base", billingCycle);
        var seatPriceId = ResolvePriceId(canonical, "seat", billingCycle);
        Subscription? subscription = null;
        if (!string.IsNullOrEmpty(basePriceId))
        {
            var items = new List<SubscriptionItemOptions> { new() { Price = basePriceId, Quantity = 1 } };
            if (!string.IsNullOrEmpty(seatPriceId))
            {
                items.Add(new SubscriptionItemOptions { Price = seatPriceId, Quantity = 0 });
            }
            subscription = await _subscriptions.CreateAsync(new SubscriptionCreateOptions
            {
                Customer = customer.Id,
                Items = items,
                TrialPeriodDays = _opts.TrialDays,
                PaymentBehavior = "default_incomplete",
                PaymentSettings = new SubscriptionPaymentSettingsOptions
                {
                    SaveDefaultPaymentMethod = "on_subscription",
                },
                Metadata = new Dictionary<string, string>
                {
                    ["tenant_slug"] = tenant.Slug,
                    ["plan"] = planCode ?? "Essentiel",
                    ["cycle"] = billingCycle ?? "monthly",
                }
            }, cancellationToken: ct);
        }
        else
        {
            _log.LogWarning("Aucun price_id Stripe résolu pour plan={Plan}/cycle={Cycle}. Subscription non créée.", planCode, billingCycle);
        }

        // Persiste les ids dans la master DB.
        await using var master = await _masterFactory.CreateDbContextAsync(ct);
        var managed = await master.Tenants.FirstOrDefaultAsync(t => t.Id == tenant.Id, ct);
        if (managed != null)
        {
            managed.StripeCustomerId = customer.Id;
            managed.StripeSubscriptionId = subscription?.Id;
            await master.SaveChangesAsync(ct);
            _store.Invalidate(managed.Slug);
        }

        return new BillingProvisionResult(customer.Id, subscription?.Id, tenant.TrialEndsAt, Skipped: false, SkipReason: null);
    }

    public async Task MarkActiveAsync(string stripeCustomerId, CancellationToken ct = default)
        => await UpdateStatusByCustomerIdAsync(stripeCustomerId, "Active", ct);

    public async Task MarkPastDueAsync(string stripeCustomerId, CancellationToken ct = default)
        => await UpdateStatusByCustomerIdAsync(stripeCustomerId, "PastDue", ct);

    public async Task SuspendAsync(string stripeCustomerId, CancellationToken ct = default)
        => await UpdateStatusByCustomerIdAsync(stripeCustomerId, "Suspended", ct);

    public async Task ProcessTrialExpirationsAsync(CancellationToken ct = default)
    {
        await using var master = await _masterFactory.CreateDbContextAsync(ct);
        var now = DateTime.UtcNow;
        var expired = await master.Tenants
            .Where(t => t.Status == "Trialing" && t.TrialEndsAt != null && t.TrialEndsAt < now)
            .ToListAsync(ct);

        foreach (var tenant in expired)
        {
            // À la fin de l'essai, on bascule en PendingPayment : statut bloqué par
            // TenantResolverMiddleware (sauf /api/billing/*) → l'utilisateur est forcé de payer.
            // Avant ce changement on flippait en PastDue, mais le middleware ne le bloquait pas
            // → fenêtre d'accès gratuit illimité après expiration. Les tenants avec Stripe seront
            // re-flipés en Active par le webhook checkout.session.completed dès paiement.
            tenant.Status = "PendingPayment";
        }
        if (expired.Count > 0)
        {
            await master.SaveChangesAsync(ct);
            foreach (var t in expired) _store.Invalidate(t.Slug);
            _log.LogInformation("ProcessTrialExpirations : {Count} tenant(s) basculé(s) en PendingPayment.", expired.Count);
        }
    }

    private async Task UpdateStatusByCustomerIdAsync(string stripeCustomerId, string newStatus, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(stripeCustomerId)) return;
        await using var master = await _masterFactory.CreateDbContextAsync(ct);
        var tenant = await master.Tenants.FirstOrDefaultAsync(t => t.StripeCustomerId == stripeCustomerId, ct);
        if (tenant == null)
        {
            _log.LogWarning("Webhook reçu pour customer {CustomerId} introuvable dans master.", stripeCustomerId);
            return;
        }
        if (tenant.Status == newStatus) return; // idempotence
        var previous = tenant.Status;
        tenant.Status = newStatus;
        await master.SaveChangesAsync(ct);
        _store.Invalidate(tenant.Slug);
        _log.LogInformation("Tenant {Slug} status: {Prev} → {Next} (customer={CustomerId})", tenant.Slug, previous, newStatus, stripeCustomerId);
    }

    /// <summary>
    /// Résout l'ID de prix Stripe pour une clé `{plan}:{kind}:{cycle}`.
    /// `kind` ∈ { "base", "seat" } — base = forfait mensuel, seat = surcharge par salarié sup.
    /// Rétrocompatibilité : si la clé 3-segments n'existe pas, on tente l'ancienne forme
    /// `{plan}:{cycle}` (un seul prix par plan).
    /// </summary>
    private string? ResolvePriceId(string? planCode, string kind, string? billingCycle)
    {
        if (string.IsNullOrWhiteSpace(planCode)) return null;
        var cycle = string.IsNullOrWhiteSpace(billingCycle) ? "monthly" : billingCycle.ToLowerInvariant();
        var key = $"{planCode}:{kind}:{cycle}";
        if (_opts.Prices.TryGetValue(key, out var pid) && !string.IsNullOrWhiteSpace(pid) && !pid.Contains("REPLACE"))
            return pid;
        // Fallback legacy 2-segments (avant introduction du modèle base/seat).
        if (kind == "base")
        {
            var legacyKey = $"{planCode}:{cycle}";
            if (_opts.Prices.TryGetValue(legacyKey, out var legacyPid) && !string.IsNullOrWhiteSpace(legacyPid) && !legacyPid.Contains("REPLACE"))
                return legacyPid;
        }
        return null;
    }
}

internal sealed class StripeOptions
{
    public string? SecretKey { get; init; }
    public string? WebhookSecret { get; init; }
    public long TrialDays { get; init; } = 30;
    public IReadOnlyDictionary<string, string> Prices { get; init; } = new Dictionary<string, string>();

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(SecretKey) && !SecretKey.Contains("REPLACE");

    public static StripeOptions Read(IConfiguration cfg)
    {
        var section = cfg.GetSection("Stripe");
        var prices = section.GetSection("Prices").GetChildren()
            .ToDictionary(c => c.Key, c => c.Value ?? string.Empty, StringComparer.OrdinalIgnoreCase);
        return new StripeOptions
        {
            SecretKey = section["SecretKey"],
            WebhookSecret = section["WebhookSecret"],
            TrialDays = long.TryParse(section["TrialDays"], out var d) ? d : 30,
            Prices = prices,
        };
    }
}
