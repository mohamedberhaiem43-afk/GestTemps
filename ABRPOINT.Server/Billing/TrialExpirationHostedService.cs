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
                    // 1) Rappels fin d'essai : J-4, J-2 puis le jour J (J-0). Best-effort
                    //    (un échec local n'empêche pas la bascule). Anti-doublon par jour géré
                    //    dans SendTrialExpiryRemindersAsync (flag TrialReminderSentAt) → chaque
                    //    offset n'est envoyé qu'une seule fois.
                    foreach (var daysBefore in new[] { 4, 2, 0 })
                    {
                        try { await billing.SendTrialExpiryRemindersAsync(daysBeforeEnd: daysBefore, stoppingToken); }
                        catch (Exception remEx) { _log.LogWarning(remEx, "Trial reminder J-{Days} sweep a échoué.", daysBefore); }
                    }

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
