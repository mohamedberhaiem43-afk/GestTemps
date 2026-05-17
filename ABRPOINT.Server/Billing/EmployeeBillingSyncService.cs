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

        // Délègue le push Stripe à IBillingService.SyncSupplementaryEmployeesAsync —
        // logique de upsert d'item user_supp + idempotence + détection de cycle de
        // facturation centralisée. Le job ne fait plus que la collecte du compte
        // d'employés actifs par tenant et appelle le service.
        var billing = scope.ServiceProvider.GetService<IBillingService>();
        if (billing is null)
        {
            _log.LogWarning("EmployeeBillingSync : IBillingService non résolu, sync impossible.");
            return;
        }

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

        // PERF — Parallélisation bornée. Chaque itération est I/O-bound : 1 SELECT côté
        // base tenant + 2 appels HTTP Stripe (GET subscription + éventuel UPDATE item).
        // À 50 tenants × ~500 ms d'appel Stripe = ~25 s en séquentiel, ~3-4 s avec
        // degré 8. Le degré reste modéré pour ne pas saturer le rate-limit Stripe
        // (100 req/s par défaut, large marge avec 8 concurrent flows).
        await Parallel.ForEachAsync(
            tenants,
            new ParallelOptions
            {
                MaxDegreeOfParallelism = 8,
                CancellationToken = ct,
            },
            async (tenant, innerCt) =>
            {
                Interlocked.Increment(ref processed);

                try
                {
                    // 1. Compte les salariés actifs sur la base du tenant.
                    var connStr = template.Replace("{DbName}", tenant.DbName);
                    var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                        .UseNpgsql(connStr, npg => npg.EnableRetryOnFailure())
                        .Options;
                    int employeeCount;
                    await using (var tenantDb = new ApplicationDbContext(options))
                    {
                        employeeCount = await tenantDb.Employes.CountAsync(e => e.Actif == "A", innerCt);
                    }

                    // 2. Délègue le push (idempotent). Retour null = sync skip (plan/price
                    // non configuré), valeur = qty finale poussée. Pas d'incrément "updated"
                    // strict puisque le service push silencieusement quand la qty change ;
                    // le log de StripeBillingService trace les vrais updates.
                    var pushed = await billing.SyncSupplementaryEmployeesAsync(tenant, employeeCount, innerCt);
                    if (pushed is null)
                    {
                        Interlocked.Increment(ref skipped);
                        return;
                    }
                    Interlocked.Increment(ref updated);
                }
                catch (Exception ex)
                {
                    Interlocked.Increment(ref errored);
                    _log.LogError(ex, "Tenant {Slug} : erreur lors du sync user_supp.", tenant.Slug);
                }
            });

        _log.LogInformation(
            "EmployeeBillingSync : {Processed} tenants traités ({Updated} synchronisés, {Skipped} ignorés, {Errored} en erreur).",
            processed, updated, skipped, errored);
    }
}
