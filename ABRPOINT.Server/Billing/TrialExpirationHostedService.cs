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
                    await billing.ProcessTrialExpirationsAsync(stoppingToken);
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
