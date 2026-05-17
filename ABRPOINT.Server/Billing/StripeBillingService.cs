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

    public async Task<PlanChangePreview> PreviewPlanChangeAsync(
        Tenant tenant,
        string newPlanCode,
        string billingCycle,
        int billedSeats,
        CancellationToken ct = default)
    {
        var canonicalNew = ABRPOINT.Server.Tenancy.PlanCatalog.Normalize(newPlanCode);
        var newPlan = ABRPOINT.Server.Tenancy.PlanCatalog.GetPlan(canonicalNew);
        if (newPlan == null)
            return new PlanChangePreview(false, tenant.PlanCode ?? "", newPlanCode,
                null, null, null, null, "Plan inconnu.");

        if (!_opts.IsConfigured)
            return new PlanChangePreview(false, tenant.PlanCode ?? "", canonicalNew,
                null, null, null, null, "Stripe non configuré.");

        if (string.IsNullOrEmpty(tenant.StripeSubscriptionId))
            return new PlanChangePreview(false, tenant.PlanCode ?? "", canonicalNew,
                null, null, null, null, "Aucun abonnement Stripe actif (passez par /checkout).");

        if (string.Equals(canonicalNew, ABRPOINT.Server.Tenancy.PlanCatalog.Normalize(tenant.PlanCode), StringComparison.OrdinalIgnoreCase))
            return new PlanChangePreview(false, tenant.PlanCode ?? "", canonicalNew,
                null, null, null, null, "Vous êtes déjà sur ce plan.");

        var newBasePriceId = ResolvePriceId(canonicalNew, "base", billingCycle);
        var newSeatPriceId = ResolvePriceId(canonicalNew, "seat", billingCycle);
        if (string.IsNullOrEmpty(newBasePriceId))
            return new PlanChangePreview(false, tenant.PlanCode ?? "", canonicalNew,
                null, null, null, null, "Prix Stripe manquant pour ce plan.");

        try
        {
            // On reconstruit le mapping (base, seat) → (item.Id existant) pour pouvoir muter
            // en place sans créer de nouveaux items orphelins. Sans l'expand items.data.price,
            // Stripe ne renvoie pas le Recurring.Interval ni le metadata du Price.
            var sub = await _subscriptions.GetAsync(
                tenant.StripeSubscriptionId,
                new SubscriptionGetOptions { Expand = new List<string> { "items.data.price" } },
                cancellationToken: ct);

            var proposedItems = BuildProposedItems(sub, newPlan, newBasePriceId, newSeatPriceId, billedSeats);

            // InvoiceService.UpcomingAsync simule la prochaine facture comme si la sub avait
            // déjà été update avec ces items + proration. Sans cet endpoint, on devrait
            // calculer le proration à la main (durée restante × différentiel) — fragile.
            var invoiceService = new InvoiceService();
            var upcoming = await invoiceService.UpcomingAsync(new UpcomingInvoiceOptions
            {
                Customer = tenant.StripeCustomerId,
                Subscription = tenant.StripeSubscriptionId,
                SubscriptionItems = proposedItems
                    .Select(i => new InvoiceSubscriptionItemOptions
                    {
                        Id = i.Id,
                        Price = i.Price,
                        Quantity = i.Quantity,
                        Deleted = i.Deleted,
                    })
                    .ToList(),
                SubscriptionProrationBehavior = "create_prorations",
                SubscriptionProrationDate = DateTime.UtcNow,
            }, cancellationToken: ct);

            // Proration = somme des lignes proration (positives = à facturer, négatives = crédit).
            // Le reste = lignes du nouveau cycle qui sont reproduites sur l'upcoming. On les exclut.
            var prorationMinor = upcoming.Lines?.Data?
                .Where(l => l.Proration)
                .Sum(l => l.Amount) ?? 0;

            return new PlanChangePreview(
                Available: true,
                CurrentPlan: ABRPOINT.Server.Tenancy.PlanCatalog.Normalize(tenant.PlanCode),
                NewPlan: canonicalNew,
                ProrationAmount: prorationMinor / 100m,
                Currency: upcoming.Currency,
                NextInvoiceAt: upcoming.PeriodEnd != default ? upcoming.PeriodEnd : (DateTime?)null,
                NextInvoiceTotal: upcoming.AmountDue / 100m,
                UnavailableReason: null);
        }
        catch (StripeException ex)
        {
            _log.LogWarning(ex, "Preview plan change failed pour tenant {Slug}. Code={Code}", tenant.Slug, ex.StripeError?.Code);
            return new PlanChangePreview(false, tenant.PlanCode ?? "", canonicalNew,
                null, null, null, null, "Stripe a refusé la simulation : " + (ex.StripeError?.Code ?? "erreur inconnue"));
        }
    }

    public async Task<ChangePlanResult> ChangePlanAsync(
        Tenant tenant,
        string newPlanCode,
        string billingCycle,
        int billedSeats,
        CancellationToken ct = default)
    {
        var canonicalNew = ABRPOINT.Server.Tenancy.PlanCatalog.Normalize(newPlanCode);
        var newPlan = ABRPOINT.Server.Tenancy.PlanCatalog.GetPlan(canonicalNew);
        if (newPlan == null)
            return new ChangePlanResult(false, tenant.PlanCode, newPlanCode, null, null, null, "Plan inconnu.");

        if (!_opts.IsConfigured)
            return new ChangePlanResult(false, tenant.PlanCode, canonicalNew, null, null, null, "Stripe non configuré.");

        if (string.IsNullOrEmpty(tenant.StripeSubscriptionId))
            return new ChangePlanResult(false, tenant.PlanCode, canonicalNew, null, null, null,
                "Aucun abonnement actif. Lancez un Stripe Checkout pour ce plan.");

        if (string.Equals(canonicalNew, ABRPOINT.Server.Tenancy.PlanCatalog.Normalize(tenant.PlanCode), StringComparison.OrdinalIgnoreCase))
            return new ChangePlanResult(false, tenant.PlanCode, canonicalNew, null, null, null, "Vous êtes déjà sur ce plan.");

        var newBasePriceId = ResolvePriceId(canonicalNew, "base", billingCycle);
        var newSeatPriceId = ResolvePriceId(canonicalNew, "seat", billingCycle);
        if (string.IsNullOrEmpty(newBasePriceId))
            return new ChangePlanResult(false, tenant.PlanCode, canonicalNew, null, null, null,
                "Prix Stripe manquant pour ce plan.");

        try
        {
            var sub = await _subscriptions.GetAsync(
                tenant.StripeSubscriptionId,
                new SubscriptionGetOptions { Expand = new List<string> { "items.data.price" } },
                cancellationToken: ct);

            var proposedItems = BuildProposedItems(sub, newPlan, newBasePriceId, newSeatPriceId, billedSeats);

            // proration_behavior=create_prorations : Stripe AJOUTE les lignes de proration à
            // la prochaine facture régulière (pas de prélèvement immédiat). Alternative
            // "always_invoice" facture tout de suite — on l'évite pour éviter une fenêtre
            // de paiement qui peut échouer (3DS, fonds insuffisants…) entre l'admin qui
            // clique et la confirmation Stripe.
            var idempotencyKey = ComputePlanChangeIdempotencyKey(tenant.Id, canonicalNew, billingCycle, billedSeats);

            var updated = await _subscriptions.UpdateAsync(
                tenant.StripeSubscriptionId,
                new SubscriptionUpdateOptions
                {
                    Items = proposedItems,
                    ProrationBehavior = "create_prorations",
                    ProrationDate = DateTime.UtcNow,
                    Metadata = new Dictionary<string, string>
                    {
                        ["plan"] = canonicalNew,
                        ["cycle"] = (billingCycle ?? "monthly").ToLowerInvariant(),
                        ["last_change_at"] = DateTime.UtcNow.ToString("o", System.Globalization.CultureInfo.InvariantCulture),
                    },
                },
                new RequestOptions { IdempotencyKey = idempotencyKey },
                cancellationToken: ct);

            // On lit la facture upcoming une seconde fois POUR EXTRAIRE le net du proration,
            // qui n'est pas renvoyé directement par Subscription.UpdateAsync. Coût : 1 appel
            // API en plus, mais ça permet de renvoyer un montant chiffré à l'UI ("différentiel
            // de 18.40€ ajouté à votre prochaine facture du 12 juin").
            decimal? netMajor = null;
            string? currency = null;
            DateTime? nextInvoiceAt = null;
            try
            {
                var invoiceService = new InvoiceService();
                var upcoming = await invoiceService.UpcomingAsync(new UpcomingInvoiceOptions
                {
                    Customer = tenant.StripeCustomerId,
                    Subscription = tenant.StripeSubscriptionId,
                }, cancellationToken: ct);
                var prorationMinor = upcoming.Lines?.Data?
                    .Where(l => l.Proration)
                    .Sum(l => l.Amount) ?? 0;
                netMajor = prorationMinor / 100m;
                currency = upcoming.Currency;
                nextInvoiceAt = upcoming.PeriodEnd != default ? upcoming.PeriodEnd : (DateTime?)null;
            }
            catch (StripeException ex)
            {
                // Le change a réussi ; on n'a juste pas pu lire la preview après. Log et continue.
                _log.LogWarning(ex,
                    "ChangePlan : update OK mais lecture upcoming invoice échouée pour {Slug}.",
                    tenant.Slug);
            }

            // Mise à jour locale du Tenant.PlanCode. Le webhook customer.subscription.updated
            // pourrait faire ça aussi, mais on le fait synchrone ici pour que la prochaine
            // requête voit le bon PlanCode (sinon fenêtre 1-10s où l'UI affiche encore l'ancien).
            var previousPlan = tenant.PlanCode;
            await using (var master = await _masterFactory.CreateDbContextAsync(ct))
            {
                var managed = await master.Tenants.FirstOrDefaultAsync(t => t.Id == tenant.Id, ct);
                if (managed != null)
                {
                    managed.PlanCode = canonicalNew;
                    if (updated.CurrentPeriodEnd != default) managed.CurrentPeriodEndsAt = updated.CurrentPeriodEnd;
                    await master.SaveChangesAsync(ct);
                    _store.Invalidate(managed.Slug);
                }
            }

            _log.LogInformation(
                "Tenant {Slug} : plan {Prev} → {Next} (subscription={SubId}, proration={Net} {Cur}).",
                tenant.Slug, previousPlan, canonicalNew, tenant.StripeSubscriptionId, netMajor, currency ?? "-");

            return new ChangePlanResult(
                Success: true,
                PreviousPlan: previousPlan,
                NewPlan: canonicalNew,
                NetAmountOnNextInvoice: netMajor,
                Currency: currency,
                NextInvoiceAt: nextInvoiceAt,
                ErrorMessage: null);
        }
        catch (StripeException ex)
        {
            _log.LogError(ex, "ChangePlan Stripe échoué pour tenant {Slug}. Code={Code}",
                tenant.Slug, ex.StripeError?.Code);
            return new ChangePlanResult(false, tenant.PlanCode, canonicalNew, null, null, null,
                "Stripe a refusé le changement de plan. Réessayez plus tard ou contactez le support.");
        }
    }

    /// <summary>
    /// Construit la liste d'items à passer à Subscription.UpdateAsync (et à
    /// Invoice.UpcomingAsync). On mute IN PLACE les items existants (Id préservé) pour
    /// changer leur Price et Quantity sans en créer de nouveaux ni orphelinser les
    /// anciens. Les items présents dans la subscription mais absents du nouveau plan
    /// sont marqués Deleted=true.
    /// </summary>
    private static List<SubscriptionItemOptions> BuildProposedItems(
        Subscription sub,
        ABRPOINT.Server.Tenancy.PlanDefinition newPlan,
        string newBasePriceId,
        string? newSeatPriceId,
        int billedSeats)
    {
        var existingItems = sub.Items?.Data ?? new List<SubscriptionItem>();
        // Heuristique : on identifie les items existants par recurring usage_type / interval
        // n'est pas disponible — on s'appuie sur l'ordre commercial historique (1er item = base,
        // 2e = seat). Plus robuste : inspecter le nom du price ou un metadata, mais le modèle
        // V2 garantit que toutes les subs créées via CreateCustomerAndTrialAsync ont items[0]=base
        // et items[1]=seat (cf. ce fichier l. 80-83).
        var baseItem = existingItems.FirstOrDefault();
        var seatItem = existingItems.Skip(1).FirstOrDefault();

        var newSeatQty = Math.Max(0, billedSeats - newPlan.IncludedEmployees);

        var result = new List<SubscriptionItemOptions>();
        if (baseItem != null)
            result.Add(new SubscriptionItemOptions { Id = baseItem.Id, Price = newBasePriceId, Quantity = 1 });
        else
            result.Add(new SubscriptionItemOptions { Price = newBasePriceId, Quantity = 1 });

        if (!string.IsNullOrEmpty(newSeatPriceId))
        {
            if (seatItem != null)
                result.Add(new SubscriptionItemOptions { Id = seatItem.Id, Price = newSeatPriceId, Quantity = newSeatQty });
            else if (newSeatQty > 0)
                result.Add(new SubscriptionItemOptions { Price = newSeatPriceId, Quantity = newSeatQty });
        }
        else if (seatItem != null)
        {
            // Le nouveau plan n'a pas de price seat configuré → on supprime l'item existant.
            result.Add(new SubscriptionItemOptions { Id = seatItem.Id, Deleted = true });
        }
        return result;
    }

    /// <summary>
    /// Idempotency-Key Stripe pour ChangePlan, équivalent de la clé Checkout. Bucket
    /// 1 minute = un double-clic produit la même clé, deux changements espacés produisent
    /// des clés distinctes.
    /// </summary>
    private static string ComputePlanChangeIdempotencyKey(Guid tenantId, string planCode, string cycle, int seats)
    {
        var bucket = DateTimeOffset.UtcNow.ToUnixTimeSeconds() / 60;
        var raw = $"chgplan:{tenantId}:{planCode}:{cycle}:{seats}:{bucket}";
        var bytes = System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(raw));
        return Convert.ToHexString(bytes).Substring(0, 32).ToLowerInvariant();
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

    /// <summary>
    /// Résout le price_id Stripe du produit unique <c>user_supp</c> pour un plan et un
    /// cycle donnés. Clé de config attendue : <c>Stripe:Prices:UserSupp:{Plan}:{cycle}</c>.
    /// Retourne null si non configuré (l'admin Stripe n'a pas créé le price), ce qui
    /// fera fail-open l'ajout du collab supplémentaire avec un log warn (cf. caller).
    /// </summary>
    private string? ResolveUserSuppPriceId(string? planCode, string? billingCycle)
    {
        if (string.IsNullOrWhiteSpace(planCode)) return null;
        var cycle = string.IsNullOrWhiteSpace(billingCycle) ? "monthly" : billingCycle.ToLowerInvariant();
        var key = $"UserSupp:{planCode}:{cycle}";
        if (_opts.Prices.TryGetValue(key, out var pid) && !string.IsNullOrWhiteSpace(pid) && !pid.Contains("REPLACE"))
            return pid;
        return null;
    }

    /// <summary>
    /// Détecte le cycle de facturation (monthly/annual) d'une subscription Stripe en
    /// inspectant l'intervalle du premier price récurrent. Sert quand on ajoute un
    /// item <c>user_supp</c> à la subscription : on aligne automatiquement le cycle
    /// sur celui de l'abonnement existant, sans avoir à stocker le cycle sur Tenant.
    /// </summary>
    private static string DetectBillingCycle(Stripe.Subscription sub)
    {
        var first = sub.Items?.Data?.FirstOrDefault();
        var interval = first?.Price?.Recurring?.Interval;
        return string.Equals(interval, "year", System.StringComparison.OrdinalIgnoreCase) ? "annual" : "monthly";
    }

    public async Task<int?> SyncSupplementaryEmployeesAsync(
        Tenant tenant,
        int activeEmployeeCount,
        CancellationToken ct = default)
    {
        // Pas de Stripe configuré → skip silencieusement (dev / preview). Le sync horaire
        // re-essaiera plus tard quand l'admin aura mis les clés. Le collab a quand même
        // été créé côté tenant DB par le caller — on ne bloque pas l'usage en dev.
        if (!_opts.IsConfigured) return null;
        if (string.IsNullOrWhiteSpace(tenant.StripeSubscriptionId)) return null;

        var plan = PlanCatalog.GetPlan(tenant.PlanCode);
        if (plan is null) return null;

        var supplementary = PlanCatalog.ComputeSupplementaryCount(plan, activeEmployeeCount);

        Stripe.StripeConfiguration.ApiKey = _opts.SecretKey;
        var subService = new Stripe.SubscriptionService();
        var sub = await subService.GetAsync(tenant.StripeSubscriptionId, cancellationToken: ct);
        if (sub is null)
        {
            _log.LogWarning("Tenant {Slug} : subscription {Sub} introuvable, skip user_supp sync.", tenant.Slug, tenant.StripeSubscriptionId);
            return null;
        }

        var cycle = DetectBillingCycle(sub);
        var userSuppPriceId = ResolveUserSuppPriceId(tenant.PlanCode, cycle);
        if (string.IsNullOrEmpty(userSuppPriceId))
        {
            _log.LogWarning(
                "Tenant {Slug} : price UserSupp:{Plan}:{Cycle} non configuré, skip sync. " +
                "Configurer Stripe:Prices:UserSupp:{Plan}:{Cycle} pour activer la facturation des collabs supplémentaires.",
                tenant.Slug, tenant.PlanCode, cycle, tenant.PlanCode, cycle);
            return null;
        }

        // Item existant ? On match par price_id. Stripe garde plusieurs items distincts par
        // subscription donc on évite tout amalgame avec l'ancien item per-plan "seat".
        var existing = sub.Items.Data.FirstOrDefault(i =>
            string.Equals(i.Price?.Id, userSuppPriceId, System.StringComparison.Ordinal));

        var itemService = new Stripe.SubscriptionItemService();
        if (existing is null)
        {
            // Pas encore d'item user_supp sur cette subscription. On le crée seulement s'il
            // y a un overage à facturer — inutile de polluer la subscription avec un item à 0.
            if (supplementary == 0) return 0;
            await itemService.CreateAsync(new Stripe.SubscriptionItemCreateOptions
            {
                Subscription = tenant.StripeSubscriptionId,
                Price = userSuppPriceId,
                Quantity = supplementary,
                ProrationBehavior = "create_prorations",
            }, cancellationToken: ct);
            _log.LogInformation(
                "Tenant {Slug} ({Plan}) : item user_supp créé sur subscription avec qty={Qty}.",
                tenant.Slug, tenant.PlanCode, supplementary);
            return supplementary;
        }

        // Idempotence : ne push que si la quantité change.
        if (existing.Quantity == supplementary) return supplementary;
        await itemService.UpdateAsync(existing.Id, new Stripe.SubscriptionItemUpdateOptions
        {
            Quantity = supplementary,
            ProrationBehavior = "create_prorations",
        }, cancellationToken: ct);
        _log.LogInformation(
            "Tenant {Slug} ({Plan}) : user_supp {Old} → {New} (employés={Count}, inclus={Included})",
            tenant.Slug, tenant.PlanCode, existing.Quantity, supplementary, activeEmployeeCount, plan.IncludedEmployees);
        return supplementary;
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
