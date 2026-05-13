using ABRPOINT.Server.Services;
using ABRPOINT.Server.Tenancy;
using Microsoft.EntityFrameworkCore;
using Stripe;

namespace ABRPOINT.Server.Billing;

public sealed class StripeBillingService : IBillingService
{
    private readonly IDbContextFactory<MasterDbContext> _masterFactory;
    private readonly ITenantStore _store;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly StripeOptions _opts;
    private readonly ILogger<StripeBillingService> _log;
    private readonly CustomerService _customers;
    private readonly SubscriptionService _subscriptions;

    public StripeBillingService(
        IDbContextFactory<MasterDbContext> masterFactory,
        ITenantStore store,
        IServiceScopeFactory scopeFactory,
        IConfiguration cfg,
        ILogger<StripeBillingService> log)
    {
        _masterFactory = masterFactory;
        _store = store;
        _scopeFactory = scopeFactory;
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

    public async Task SendTrialExpiryRemindersAsync(int daysBeforeEnd = 4, CancellationToken ct = default)
    {
        // Cherche les tenants Trialing dont la fin d'essai tombe dans une fenêtre
        // [daysBeforeEnd-1 .. daysBeforeEnd] jours à partir de maintenant. La fenêtre
        // d'1 jour absorbe le délai entre 2 sweeps (1h) sans risquer de manquer un
        // tenant. Le flag TrialReminderSentAt évite le double envoi quand plusieurs
        // sweeps tombent dans la fenêtre.
        var now = DateTime.UtcNow;
        var windowStart = now.AddDays(daysBeforeEnd - 1);
        var windowEnd = now.AddDays(daysBeforeEnd);

        await using var master = await _masterFactory.CreateDbContextAsync(ct);
        var candidates = await master.Tenants
            .Where(t => t.Status == "Trialing"
                        && t.TrialEndsAt != null
                        && t.TrialEndsAt >= windowStart
                        && t.TrialEndsAt <= windowEnd
                        && t.TrialReminderSentAt == null)
            .ToListAsync(ct);

        if (candidates.Count == 0) return;

        foreach (var tenant in candidates)
        {
            try
            {
                await SendReminderForOneTenantAsync(tenant, daysBeforeEnd, ct);
                tenant.TrialReminderSentAt = DateTime.UtcNow;
            }
            catch (Exception ex)
            {
                // Échec isolé d'un tenant ne doit pas bloquer le sweep. On laisse le flag
                // null pour retenter au prochain passage horaire (au pire on aura quelques
                // ré-essais avant que la fenêtre se referme).
                _log.LogWarning(ex, "Trial reminder failed for tenant {Slug}.", tenant.Slug);
            }
        }
        await master.SaveChangesAsync(ct);
        _log.LogInformation("SendTrialExpiryReminders : {Count} tenant(s) notifié(s) (J-{Days}).", candidates.Count, daysBeforeEnd);
    }

    /// <summary>
    /// Envoie le rappel "fin d'essai imminente" à tous les admins + managers d'un tenant.
    /// La notification utilise <see cref="IUserNotificationService"/> qui couvre les 3 canaux
    /// (push mobile, in-app, email best-effort). On bascule le tenant courant via
    /// <see cref="ICurrentTenant"/> avant de créer le scope DI pour que l'<c>ApplicationDbContext</c>
    /// pointe sur la bonne base.
    /// </summary>
    private async Task SendReminderForOneTenantAsync(Tenant tenant, int daysBeforeEnd, CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var current = scope.ServiceProvider.GetService<ICurrentTenant>();
        if (current is null)
        {
            _log.LogWarning("ICurrentTenant indisponible : reminder ignoré pour {Slug}.", tenant.Slug);
            return;
        }
        current.Set(tenant);

        var notify = scope.ServiceProvider.GetService<IUserNotificationService>();
        if (notify is null) return;

        var daysLabel = daysBeforeEnd == 1 ? "1 jour" : $"{daysBeforeEnd} jours";
        var title = "⏰ Fin d'essai imminente";
        var body = $"Votre période d'essai gratuite Concorde Workforce se termine dans {daysLabel}. " +
                   "Finalisez votre paiement Stripe pour continuer sans interruption.";
        // type=trial_expiry permet aux préférences utilisateur de filtrer ces rappels
        // commerciaux (canal in-app/push indépendant des notifs métier).
        var payload = new
        {
            type = "trial_expiry",
            daysRemaining = daysBeforeEnd,
            trialEndsAt = tenant.TrialEndsAt,
            planCode = tenant.PlanCode,
        };

        // On notifie indépendamment admins et managers : ce sont les 2 rôles autorisés
        // à gérer la facturation côté UI (/dashboard/payment). Si l'un n'a aucun user
        // dans le tenant, l'autre reçoit quand même.
        await notify.NotifyAdminsAsync(title, body, payload, ct);
        await notify.NotifyManagersAsync(title, body, payload, ct);
    }

    public async Task<CancellationResult> CancelSubscriptionAsync(
        Tenant tenant,
        bool immediate,
        string? reason,
        CancellationToken ct = default)
    {
        if (!_opts.IsConfigured)
        {
            return new CancellationResult(false, immediate, null, "Stripe non configuré.");
        }
        if (string.IsNullOrEmpty(tenant.StripeSubscriptionId))
        {
            // Pas de subscription Stripe → on bascule juste l'état tenant (cas trial non
            // provisionné ou tenant dev sans Stripe). Considéré comme un succès immédiat.
            await SetTenantCancelledAsync(tenant.Id, ct);
            return new CancellationResult(true, true, DateTime.UtcNow, null);
        }

        try
        {
            if (immediate)
            {
                // Récupère la subscription avec items.price expanded pour détecter la périodicité.
                // Politique commerciale : un abonnement ANNUEL résilié en cours de période donne
                // droit à un remboursement prorata temporis du temps non consommé (engagement
                // d'un an payé d'avance → restitution équitable). Un abonnement MENSUEL ne donne
                // pas droit à remboursement (usage SaaS B2B standard, le mois en cours est dû).
                Subscription subscription;
                try
                {
                    subscription = await _subscriptions.GetAsync(
                        tenant.StripeSubscriptionId,
                        new SubscriptionGetOptions
                        {
                            Expand = new List<string> { "items.data.price" },
                        },
                        cancellationToken: ct);
                }
                catch (StripeException ex) when (ex.HttpStatusCode == System.Net.HttpStatusCode.NotFound)
                {
                    // Subscription déjà supprimée côté Stripe (retry idempotent ou race avec webhook
                    // subscription.deleted). On considère la résiliation effective.
                    await SetTenantCancelledAsync(tenant.Id, ct);
                    return new CancellationResult(true, true, DateTime.UtcNow, null);
                }

                var isAnnual = IsAnnualSubscription(subscription);

                // Résiliation immédiate : on annule Stripe (le webhook customer.subscription.deleted
                // sera reçu et déclenchera SuspendAsync → mais on force Cancelled tout de suite
                // pour que l'admin perçoive la résiliation sans attendre le round-trip webhook).
                // Prorate/InvoiceNow restent false : on gère le remboursement nous-mêmes via
                // Refund API pour que l'argent revienne sur la CB du client (et non en crédit
                // sur la balance Stripe qui ne serait restitué qu'au prochain paiement — or il
                // n'y en aura pas après résiliation).
                await _subscriptions.CancelAsync(
                    tenant.StripeSubscriptionId,
                    new SubscriptionCancelOptions
                    {
                        InvoiceNow = false,
                        Prorate = false,
                    },
                    cancellationToken: ct);

                decimal refundedMajor = 0;
                string? refundCurrency = null;
                if (isAnnual)
                {
                    try
                    {
                        (refundedMajor, refundCurrency) = await IssueProratedRefundAsync(subscription, ct);
                    }
                    catch (StripeException refundEx)
                    {
                        // La résiliation reste effective même si le remboursement échoue. Le support
                        // traitera le remboursement manuellement via le Dashboard Stripe — on log
                        // suffisamment d'info pour retracer la facture concernée.
                        _log.LogError(refundEx,
                            "Remboursement prorata échoué pour tenant {Slug} (subscription={SubId}). " +
                            "Code Stripe={Code}. À traiter manuellement via Dashboard.",
                            tenant.Slug, tenant.StripeSubscriptionId, refundEx.StripeError?.Code);
                    }
                }

                await SetTenantCancelledAsync(tenant.Id, ct);
                _log.LogInformation(
                    "Tenant {Slug} : résiliation immédiate effectuée (subscription={SubId}, annual={Annual}, refunded={Refunded} {Cur}).",
                    tenant.Slug, tenant.StripeSubscriptionId, isAnnual, refundedMajor, refundCurrency ?? "-");
                return new CancellationResult(
                    Success: true,
                    Immediate: true,
                    EffectiveAt: DateTime.UtcNow,
                    ErrorMessage: null,
                    Prorated: isAnnual && refundedMajor > 0,
                    RefundedAmount: refundedMajor > 0 ? refundedMajor : (decimal?)null,
                    RefundCurrency: refundCurrency);
            }
            else
            {
                // Résiliation planifiée : Stripe gère la date de fin via cancel_at_period_end.
                // current_period_end est lu pour informer l'UI ("Accès jusqu'au …").
                var updated = await _subscriptions.UpdateAsync(
                    tenant.StripeSubscriptionId,
                    new SubscriptionUpdateOptions
                    {
                        CancelAtPeriodEnd = true,
                        CancellationDetails = new SubscriptionCancellationDetailsOptions
                        {
                            Comment = string.IsNullOrWhiteSpace(reason) ? null : reason,
                        },
                    },
                    cancellationToken: ct);

                DateTime? effectiveAt = updated.CurrentPeriodEnd != default
                    ? updated.CurrentPeriodEnd
                    : (updated.CancelAt != default ? updated.CancelAt : (DateTime?)null);

                await SetTenantScheduledCancellationAsync(tenant.Id, effectiveAt, ct);
                _log.LogInformation("Tenant {Slug} : résiliation planifiée en fin de période ({End}).",
                    tenant.Slug, effectiveAt);
                return new CancellationResult(true, false, effectiveAt, null);
            }
        }
        catch (StripeException ex)
        {
            _log.LogError(ex, "Échec de résiliation Stripe pour tenant {Slug}. Code={Code}",
                tenant.Slug, ex.StripeError?.Code);
            return new CancellationResult(false, immediate, null,
                "Stripe a refusé la résiliation. Réessayez plus tard ou contactez le support.");
        }
    }

    public async Task<bool> ResumeSubscriptionAsync(Tenant tenant, CancellationToken ct = default)
    {
        if (!_opts.IsConfigured || string.IsNullOrEmpty(tenant.StripeSubscriptionId))
            return false;

        try
        {
            await _subscriptions.UpdateAsync(
                tenant.StripeSubscriptionId,
                new SubscriptionUpdateOptions { CancelAtPeriodEnd = false },
                cancellationToken: ct);

            await using var master = await _masterFactory.CreateDbContextAsync(ct);
            var t = await master.Tenants.FirstOrDefaultAsync(x => x.Id == tenant.Id, ct);
            if (t != null)
            {
                t.CancelAtPeriodEnd = false;
                t.CancellationRequestedAt = null;
                await master.SaveChangesAsync(ct);
                _store.Invalidate(t.Slug);
            }
            _log.LogInformation("Tenant {Slug} : résiliation planifiée annulée.", tenant.Slug);
            return true;
        }
        catch (StripeException ex)
        {
            _log.LogError(ex, "Échec de reprise de subscription Stripe pour tenant {Slug}.", tenant.Slug);
            return false;
        }
    }

    /// <summary>
    /// True si au moins un item de la subscription est facturé annuellement (Price.Recurring.Interval == "year").
    /// On considère qu'une subscription contenant un item annuel est globalement annuelle —
    /// le modèle Stripe permet techniquement de mixer base+seat avec intervalles différents,
    /// mais notre catalogue PlanCatalog n'expose que des combinaisons homogènes (base+seat
    /// même intervalle), donc tester le premier item suffit en pratique.
    /// </summary>
    private static bool IsAnnualSubscription(Subscription sub)
    {
        if (sub?.Items?.Data == null) return false;
        foreach (var it in sub.Items.Data)
        {
            var interval = it?.Price?.Recurring?.Interval;
            if (!string.IsNullOrEmpty(interval) && string.Equals(interval, "year", StringComparison.OrdinalIgnoreCase))
                return true;
        }
        return false;
    }

    /// <summary>
    /// Émet un remboursement prorata temporis sur la dernière facture payée de la subscription.
    /// Le ratio remboursé = secondes restantes jusqu'à CurrentPeriodEnd / durée totale de la
    /// période. Ce remboursement va sur la carte d'origine via la Refund API Stripe (et non
    /// en crédit balance, qui serait perdu après cancel). Retourne le montant remboursé en
    /// unité majeure (ex: 47.50 EUR) et le code devise ISO.
    /// </summary>
    private async Task<(decimal amountMajor, string? currency)> IssueProratedRefundAsync(
        Subscription sub, CancellationToken ct)
    {
        if (sub == null) return (0, null);
        var periodStart = sub.CurrentPeriodStart;
        var periodEnd = sub.CurrentPeriodEnd;
        if (periodStart == default || periodEnd == default || periodEnd <= periodStart)
        {
            _log.LogWarning("Période Stripe invalide sur {SubId} — prorata non calculable.", sub.Id);
            return (0, null);
        }

        var totalSeconds = (periodEnd - periodStart).TotalSeconds;
        var now = DateTime.UtcNow;
        if (now <= periodStart) return (0, null); // période pas encore commencée
        if (now >= periodEnd) return (0, null);   // période terminée → rien à rembourser
        var remainingSeconds = (periodEnd - now).TotalSeconds;
        var unusedRatio = (decimal)(remainingSeconds / totalSeconds);
        if (unusedRatio <= 0m) return (0, null);

        // Identifie la dernière facture payée de la subscription pour cibler le PaymentIntent
        // (ou Charge en fallback). On limite à 1 résultat : c'est l'invoice de l'engagement
        // annuel en cours.
        var invoiceService = new InvoiceService();
        var invoices = await invoiceService.ListAsync(new InvoiceListOptions
        {
            Subscription = sub.Id,
            Status = "paid",
            Limit = 1,
        }, cancellationToken: ct);
        var lastInvoice = invoices?.Data?.FirstOrDefault();
        if (lastInvoice == null)
        {
            _log.LogWarning("Aucune facture payée pour {SubId} — prorata non remboursable.", sub.Id);
            return (0, null);
        }

        var refundAmountMinor = (long)Math.Floor(lastInvoice.AmountPaid * unusedRatio);
        if (refundAmountMinor <= 0) return (0, lastInvoice.Currency);

        var refundOptions = new RefundCreateOptions
        {
            Amount = refundAmountMinor,
            Reason = "requested_by_customer",
            Metadata = new Dictionary<string, string>
            {
                ["stripe_subscription_id"] = sub.Id,
                ["stripe_invoice_id"] = lastInvoice.Id,
                ["prorata_unused_ratio"] = unusedRatio.ToString("F6", System.Globalization.CultureInfo.InvariantCulture),
                ["prorata_unused_seconds"] = ((long)remainingSeconds).ToString(System.Globalization.CultureInfo.InvariantCulture),
                ["billing_interval"] = "year",
            },
        };
        var paymentIntentId = lastInvoice.PaymentIntentId;
        var chargeId = lastInvoice.ChargeId;
        if (!string.IsNullOrEmpty(paymentIntentId))
            refundOptions.PaymentIntent = paymentIntentId;
        else if (!string.IsNullOrEmpty(chargeId))
            refundOptions.Charge = chargeId;
        else
        {
            _log.LogWarning(
                "Facture {InvId} sans PaymentIntent ni Charge — prorata non remboursable (paiement par balance/voucher ?).",
                lastInvoice.Id);
            return (0, lastInvoice.Currency);
        }

        var refundService = new RefundService();
        var refund = await refundService.CreateAsync(refundOptions, cancellationToken: ct);
        var amountMajor = refund.Amount / 100m;
        _log.LogInformation(
            "Refund prorata créé : {Amount} {Cur} pour subscription {SubId} (ratio {Ratio:P2}, restant {Days:F1}j).",
            amountMajor, refund.Currency, sub.Id, unusedRatio, remainingSeconds / 86400.0);
        return (amountMajor, refund.Currency);
    }

    /// <summary>
    /// Bascule un tenant en statut Cancelled immédiat (résiliation effective). Met aussi
    /// à jour CancellationRequestedAt et CancelAtPeriodEnd=false.
    /// </summary>
    private async Task SetTenantCancelledAsync(Guid tenantId, CancellationToken ct)
    {
        await using var master = await _masterFactory.CreateDbContextAsync(ct);
        var t = await master.Tenants.FirstOrDefaultAsync(x => x.Id == tenantId, ct);
        if (t == null) return;
        t.Status = "Cancelled";
        t.CancellationRequestedAt = DateTime.UtcNow;
        t.CancelAtPeriodEnd = false;
        await master.SaveChangesAsync(ct);
        _store.Invalidate(t.Slug);
    }

    private async Task SetTenantScheduledCancellationAsync(Guid tenantId, DateTime? effectiveAt, CancellationToken ct)
    {
        await using var master = await _masterFactory.CreateDbContextAsync(ct);
        var t = await master.Tenants.FirstOrDefaultAsync(x => x.Id == tenantId, ct);
        if (t == null) return;
        t.CancelAtPeriodEnd = true;
        t.CancellationRequestedAt = DateTime.UtcNow;
        if (effectiveAt.HasValue) t.CurrentPeriodEndsAt = effectiveAt;
        await master.SaveChangesAsync(ct);
        _store.Invalidate(t.Slug);
    }

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
