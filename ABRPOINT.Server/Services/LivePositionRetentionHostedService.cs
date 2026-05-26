using ABRPOINT.Server.Data;
using ABRPOINT.Server.Tenancy;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Services;

/// <summary>
/// Purge périodique de la table <c>live_position</c> : supprime les lignes dont
/// <see cref="Models.LivePosition.UpdatedAt"/> dépasse <see cref="StaleAfter"/>
/// (30 min par défaut). C'est une donnée VOLATILE — on ne conserve aucun
/// historique. L'historique des positions au moment du pointage reste, lui,
/// disponible via <c>presence.prelat/prelon</c> (cf. PresencesController.GetPositions).
///
/// Justification RGPD (Art. 5.1.e — limitation de la conservation) :
///   - La position live n'est nécessaire que tant que le salarié est en service ;
///     dès qu'il quitte son poste / éteint son téléphone, la donnée perd sa
///     raison d'être et doit être effacée.
///   - 30 minutes laissent à l'admin le temps de consulter la carte juste après
///     un pointage de fin de journée, sans accumuler de positions « fantôme ».
///
/// Cadence : toutes les 5 minutes (Interval). Plus fréquent que les autres
/// services de rétention car la table est très volatile (heartbeats ~1 fois/min
/// par salarié actif → potentiellement plusieurs centaines de lignes/h).
///
/// Multi-tenant : itère <c>Tenants</c> en Active/Trialing depuis MasterDb,
/// ouvre un ApplicationDbContext par tenant pour la purge. Un tenant dont la
/// table n'existe pas encore (provisioning en cours) est silencieusement ignoré.
/// </summary>
public sealed class LivePositionRetentionHostedService : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan StaleAfter = TimeSpan.FromMinutes(30);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IConfiguration _cfg;
    private readonly ILogger<LivePositionRetentionHostedService> _log;

    public LivePositionRetentionHostedService(
        IServiceScopeFactory scopeFactory,
        IConfiguration cfg,
        ILogger<LivePositionRetentionHostedService> log)
    {
        _scopeFactory = scopeFactory;
        _cfg = cfg;
        _log = log;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Délai initial : on laisse l'application stabiliser ses migrations / pools.
        // Aligné sur les autres BackgroundService de rétention pour homogénéité ops.
        try { await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken); }
        catch (TaskCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var deletedTotal = await PurgeAllTenantsAsync(stoppingToken);
                if (deletedTotal > 0)
                    _log.LogDebug("LivePosition retention sweep: {Deleted} lignes obsolètes purgées.", deletedTotal);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                _log.LogError(ex, "LivePosition retention sweep failed.");
            }

            try { await Task.Delay(Interval, stoppingToken); }
            catch (TaskCanceledException) { break; }
        }
    }

    private async Task<int> PurgeAllTenantsAsync(CancellationToken ct)
    {
        var template = _cfg.GetConnectionString("TenantTemplate");
        var masterConnection = _cfg.GetConnectionString("MasterConnection");
        var defaultConn = _cfg.GetConnectionString("DefaultConnection");
        var total = 0;

        if (!string.IsNullOrWhiteSpace(masterConnection) && !string.IsNullOrWhiteSpace(template))
        {
            using var scope = _scopeFactory.CreateScope();
            var masterFactory = scope.ServiceProvider.GetService<IDbContextFactory<MasterDbContext>>();
            if (masterFactory is null) return 0;
            await using var master = await masterFactory.CreateDbContextAsync(ct);
            var tenants = await master.Tenants
                .AsNoTracking()
                .Where(t => t.Status == "Active" || t.Status == "Trialing")
                .ToListAsync(ct);

            foreach (var t in tenants)
            {
                try
                {
                    var cs = template.Replace("{DbName}", t.DbName);
                    total += await PurgeOneAsync(cs, ct);
                }
                catch (Exception ex)
                {
                    // Une base indisponible ne doit pas bloquer les autres tenants
                    // (cas typique : tenant en cours de migration, ou DB momentanément
                    // inaccessible suite à maintenance). Log warn et on continue.
                    _log.LogWarning(ex, "LivePosition purge tenant {Slug} échoué", t.Slug);
                }
            }
        }
        else if (!string.IsNullOrWhiteSpace(defaultConn))
        {
            total = await PurgeOneAsync(defaultConn, ct);
        }

        return total;
    }

    private static async Task<int> PurgeOneAsync(string connStr, CancellationToken ct)
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(connStr, npg => npg.EnableRetryOnFailure())
            .Options;
        await using var db = new ApplicationDbContext(options);

        var cutoff = DateTime.UtcNow.Subtract(StaleAfter);
        try
        {
            // ExecuteDeleteAsync = un seul DELETE serveur, pas de chargement en mémoire.
            // L'index ix_live_position_updated_at rend cette requête O(log n).
            return await db.LivePositions
                .Where(p => p.UpdatedAt < cutoff)
                .ExecuteDeleteAsync(ct);
        }
        catch (Npgsql.PostgresException ex) when (ex.SqlState == "42P01")
        {
            // Table live_position n'existe pas encore sur ce tenant (BaseDataSchemaMigrator
            // n'a pas tourné, ou tenant créé avant cette feature et pas encore migré au
            // démarrage suivant). Silencieux — le prochain boot créera la table.
            return 0;
        }
    }
}
