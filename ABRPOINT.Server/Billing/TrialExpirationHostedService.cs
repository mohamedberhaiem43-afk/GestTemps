using ABRPOINT.Server.Tenancy;

namespace ABRPOINT.Server.Billing;

/// <summary>
/// Service de fond qui exécute toutes les heures la purge des trials expirés
/// (ProcessTrialExpirationsAsync). Tolère un délai aléatoire au démarrage pour étaler
/// la charge si plusieurs instances sont déployées.
/// </summary>
public sealed class TrialExpirationHostedService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<TrialExpirationHostedService> _log;
    private static readonly TimeSpan Interval = TimeSpan.FromHours(1);

    public TrialExpirationHostedService(IServiceScopeFactory scopeFactory, ILogger<TrialExpirationHostedService> log)
    {
        _scopeFactory = scopeFactory;
        _log = log;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Délai initial 30s pour laisser le démarrage se stabiliser.
        try { await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken); }
        catch (TaskCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var billing = scope.ServiceProvider.GetService<IBillingService>();
                if (billing != null)
                {
                    // 1) Rappel J-10 (best-effort, échec local n'empêche pas la bascule).
                    //    Envoyé avant le sweep d'expiration : si le job a accumulé du retard,
                    //    on préfère prévenir l'admin trop tôt plutôt que pas du tout.
                    //    Le seuil J-10 (au lieu de J-4) laisse à l'admin/manager 10 jours pour
                    //    décider sereinement de convertir ou non l'essai en abonnement payant.
                    try { await billing.SendTrialExpiryRemindersAsync(daysBeforeEnd: 10, stoppingToken); }
                    catch (Exception remEx) { _log.LogWarning(remEx, "Trial reminder sweep a échoué (continu avec expiration sweep)."); }

                    // 2) Rappel J-7 renouvellement abonnement payant (best-effort). Distinct
                    //    du J-10 essai : ici on cible les tenants déjà Active dont la période
                    //    Stripe arrive à terme. But : leur permettre de mettre à jour leur
                    //    moyen de paiement ou résilier avant prélèvement automatique.
                    try { await billing.SendSubscriptionRenewalRemindersAsync(daysBeforeEnd: 7, stoppingToken); }
                    catch (Exception renEx) { _log.LogWarning(renEx, "Subscription renewal reminder sweep a échoué."); }

                    // 3) Bascule des essais expirés en PendingPayment.
                    await billing.ProcessTrialExpirationsAsync(stoppingToken);
                }
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                _log.LogError(ex, "Trial expiration sweep a échoué.");
            }

            try { await Task.Delay(Interval, stoppingToken); }
            catch (TaskCanceledException) { break; }
        }
    }
}
