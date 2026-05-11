using ABRPOINT.Server.Data;
using ABRPOINT.Server.Tenancy;
using Microsoft.EntityFrameworkCore;
using Stripe;

namespace ABRPOINT.Server.Billing;

/// <summary>
/// Synchronisation périodique de la quantité de seats facturables sur Stripe pour chaque
/// tenant actif. Le pricing V2 facture un forfait mensuel (item "Base") + un overage par
/// salarié au-delà de <see cref="PlanDefinition.IncludedEmployees"/> (item "Seat").
///
/// Cette tâche balaye les tenants en statut Active/Trialing dont la souscription Stripe
/// est connue, compte les employés actifs côté base tenant, et met à jour la quantité de
/// l'item Seat correspondant. Sans cette boucle, l'overage serait défini en tarif mais
/// jamais facturé — les clients à 30+ salariés sur Starter resteraient à 29.50€/mois ad
/// vitam.
///
/// Cadence : une fois par jour (configurable via <c>Billing__SeatSyncIntervalHours</c>).
/// Idempotent : on ne push une update Stripe que si la quantité a changé.
/// </summary>
public sealed class EmployeeBillingSyncService : BackgroundService
{
    private readonly IServiceProvider _services;
    private readonly ILogger<EmployeeBillingSyncService> _log;
    private readonly IConfiguration _cfg;

    public EmployeeBillingSyncService(
        IServiceProvider services,
        IConfiguration cfg,
        ILogger<EmployeeBillingSyncService> log)
    {
        _services = services;
        _cfg = cfg;
        _log = log;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var intervalHours = int.TryParse(_cfg["Billing:SeatSyncIntervalHours"], out var h) && h > 0 ? h : 24;
        var startupDelay = TimeSpan.FromMinutes(5); // évite de tourner pendant le boot du serveur

        try { await Task.Delay(startupDelay, stoppingToken); }
        catch (TaskCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await RunOnceAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "EmployeeBillingSync : erreur globale d'itération, on continue à l'itération suivante.");
            }

            try { await Task.Delay(TimeSpan.FromHours(intervalHours), stoppingToken); }
            catch (TaskCanceledException) { break; }
        }
    }

    private async Task RunOnceAsync(CancellationToken ct)
    {
        using var scope = _services.CreateScope();
        var masterFactory = scope.ServiceProvider.GetService<IDbContextFactory<MasterDbContext>>();
        if (masterFactory is null)
        {
            _log.LogInformation("EmployeeBillingSync : MasterDbContext non configuré, sync ignorée.");
            return;
        }

        var stripeKey = _cfg["Stripe:SecretKey"];
        if (string.IsNullOrWhiteSpace(stripeKey) || stripeKey.Contains("REPLACE"))
        {
            _log.LogInformation("EmployeeBillingSync : Stripe non configuré (clé absente), sync ignorée.");
            return;
        }
        StripeConfiguration.ApiKey = stripeKey;
        var subItems = new SubscriptionItemService();

        await using var master = await masterFactory.CreateDbContextAsync(ct);
        var tenants = await master.Tenants
            .Where(t => t.StripeSubscriptionId != null
                        && (t.Status == "Active" || t.Status == "Trialing" || t.Status == "PastDue"))
            .ToListAsync(ct);

        var template = _cfg.GetConnectionString("TenantTemplate");
        if (string.IsNullOrWhiteSpace(template))
        {
            _log.LogWarning("EmployeeBillingSync : TenantTemplate manquant, sync impossible.");
            return;
        }

        int processed = 0, updated = 0, skipped = 0, errored = 0;

        foreach (var tenant in tenants)
        {
            if (ct.IsCancellationRequested) break;
            processed++;

            try
            {
                var plan = PlanCatalog.GetPlan(tenant.PlanCode);
                if (plan is null)
                {
                    _log.LogDebug("Tenant {Slug} : plan inconnu ({Plan}), skip.", tenant.Slug, tenant.PlanCode);
                    skipped++;
                    continue;
                }

                // 1. Compte les salariés actifs sur la base du tenant.
                var connStr = template.Replace("{DbName}", tenant.DbName);
                var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                    .UseSqlServer(connStr, sql => sql.EnableRetryOnFailure())
                    .Options;
                int employeeCount;
                await using (var tenantDb = new ApplicationDbContext(options))
                {
                    employeeCount = await tenantDb.Employes.CountAsync(e => e.Actif == "A", ct);
                }

                var overage = Math.Max(0, employeeCount - plan.IncludedEmployees);

                // 2. Récupère la souscription Stripe pour trouver l'item "seat".
                var subscriptionService = new SubscriptionService();
                var subscription = await subscriptionService.GetAsync(tenant.StripeSubscriptionId!, cancellationToken: ct);
                if (subscription is null)
                {
                    _log.LogWarning("Tenant {Slug} : souscription Stripe {SubId} introuvable.", tenant.Slug, tenant.StripeSubscriptionId);
                    skipped++;
                    continue;
                }

                // Trouve l'item "seat" : on l'identifie par son price_id qui matche la clé
                // `{Plan}:seat:monthly` côté config.
                var seatPriceId = _cfg[$"Stripe:Prices:{plan.Code}:seat:monthly"];
                if (string.IsNullOrWhiteSpace(seatPriceId) || seatPriceId.Contains("REPLACE"))
                {
                    _log.LogDebug("Tenant {Slug} : price_id seat non configuré pour {Plan}, skip.", tenant.Slug, plan.Code);
                    skipped++;
                    continue;
                }
                var seatItem = subscription.Items.Data.FirstOrDefault(i =>
                    string.Equals(i.Price?.Id, seatPriceId, StringComparison.Ordinal));
                if (seatItem is null)
                {
                    _log.LogWarning("Tenant {Slug} : item seat absent de la souscription (price={Price}). Manuel à corriger côté Stripe.",
                        tenant.Slug, seatPriceId);
                    skipped++;
                    continue;
                }

                // 3. Idempotence : ne push que si la quantité a changé.
                if (seatItem.Quantity == overage)
                {
                    _log.LogDebug("Tenant {Slug} : seat={Seat} déjà à jour, skip.", tenant.Slug, overage);
                    continue;
                }

                await subItems.UpdateAsync(seatItem.Id, new SubscriptionItemUpdateOptions
                {
                    Quantity = overage,
                    // ProrationBehavior=create_prorations facture/crédite immédiatement la
                    // différence depuis le dernier billing cycle. Pour les Starter qui ajoutent
                    // 1 employé en milieu de mois, ça génère une mini-facture prorata.
                    ProrationBehavior = "create_prorations",
                }, cancellationToken: ct);

                updated++;
                _log.LogInformation(
                    "Tenant {Slug} ({Plan}) : seats {Old} → {New} (employés={Count}, inclus={Included})",
                    tenant.Slug, plan.Code, seatItem.Quantity, overage, employeeCount, plan.IncludedEmployees);
            }
            catch (Exception ex)
            {
                errored++;
                _log.LogError(ex, "Tenant {Slug} : erreur lors du sync seat.", tenant.Slug);
            }
        }

        _log.LogInformation(
            "EmployeeBillingSync : {Processed} tenants traités ({Updated} mis à jour, {Skipped} ignorés, {Errored} en erreur).",
            processed, updated, skipped, errored);
    }
}
