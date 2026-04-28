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

        var priceId = ResolvePriceId(planCode, billingCycle);
        Subscription? subscription = null;
        if (!string.IsNullOrEmpty(priceId))
        {
            subscription = await _subscriptions.CreateAsync(new SubscriptionCreateOptions
            {
                Customer = customer.Id,
                Items = new List<SubscriptionItemOptions> { new() { Price = priceId } },
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
            // Sans Stripe : on bascule directement en PastDue (le SaaS bloque l'accès jusqu'au paiement).
            // Avec Stripe : Stripe déclenche automatiquement la première facture à fin de trial,
            // donc l'état réel viendra du webhook. Ce job ne fait que purger les tenants restés en limbo.
            tenant.Status = "PastDue";
        }
        if (expired.Count > 0)
        {
            await master.SaveChangesAsync(ct);
            foreach (var t in expired) _store.Invalidate(t.Slug);
            _log.LogInformation("ProcessTrialExpirations : {Count} tenant(s) basculé(s) en PastDue.", expired.Count);
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

    private string? ResolvePriceId(string? planCode, string? billingCycle)
    {
        if (string.IsNullOrWhiteSpace(planCode)) return null;
        var cycle = string.IsNullOrWhiteSpace(billingCycle) ? "monthly" : billingCycle.ToLowerInvariant();
        var key = $"{planCode}:{cycle}";
        if (_opts.Prices.TryGetValue(key, out var pid) && !string.IsNullOrWhiteSpace(pid) && !pid.Contains("REPLACE"))
            return pid;
        return null;
    }
}

internal sealed class StripeOptions
{
    public string? SecretKey { get; init; }
    public string? WebhookSecret { get; init; }
    public long TrialDays { get; init; } = 14;
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
            TrialDays = long.TryParse(section["TrialDays"], out var d) ? d : 14,
            Prices = prices,
        };
    }
}
