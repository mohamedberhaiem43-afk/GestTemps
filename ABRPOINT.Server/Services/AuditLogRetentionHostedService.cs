using ABRPOINT.Server.Data;
using ABRPOINT.Server.Tenancy;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Services;

/// <summary>
/// RGPD Art. 32 + Art. 5.1.e (minimisation et limitation de la conservation) :
/// purge quotidienne des entrées de la table <c>AuditLog</c> dont l'âge dépasse
/// <see cref="RetentionDays"/> (6 mois par défaut). La rétention est lisible
/// depuis <c>Security:AuditLogRetentionDays</c> dans appsettings.json — un
/// admin DPO peut allonger cette durée si son régulateur sectoriel l'impose,
/// mais ne peut pas la passer en-dessous de 30 jours (garde-fou applicatif).
///
/// Le balayage tourne 1× par jour pour limiter l'impact I/O ; en steady state
/// la fenêtre supprimée est d'environ 24 heures de logs, ce qui reste léger.
/// Une exécution est lancée à T+1 minute après le démarrage pour rattraper
/// un éventuel retard si le service était arrêté pendant plusieurs jours.
///
/// Multi-tenant : on itère la liste des tenants Active/Trialing depuis la
/// base master, puis on ouvre un <see cref="ApplicationDbContext"/> par
/// tenant — chaque tenant a sa propre table AuditLog.
/// </summary>
public sealed class AuditLogRetentionHostedService : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromHours(24);
    private const int MinRetentionDays = 30;
    private const int DefaultRetentionDays = 180; // 6 mois

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IConfiguration _cfg;
    private readonly ILogger<AuditLogRetentionHostedService> _log;

    public AuditLogRetentionHostedService(
        IServiceScopeFactory scopeFactory,
        IConfiguration cfg,
        ILogger<AuditLogRetentionHostedService> log)
    {
        _scopeFactory = scopeFactory;
        _cfg = cfg;
        _log = log;
    }

    private int RetentionDays
    {
        get
        {
            var configured = _cfg.GetValue<int?>("Security:AuditLogRetentionDays") ?? DefaultRetentionDays;
            return configured < MinRetentionDays ? MinRetentionDays : configured;
        }
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Délai initial : on laisse l'application stabiliser ses migrations / pools.
        try { await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken); }
        catch (TaskCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var deletedTotal = await PurgeAllTenantsAsync(stoppingToken);
                if (deletedTotal > 0)
                    _log.LogInformation("AuditLog retention purge: {Deleted} lignes supprimées (rétention={Days}j).",
                        deletedTotal, RetentionDays);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                _log.LogError(ex, "AuditLog retention sweep failed.");
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
        var cutoff = DateTime.UtcNow.AddDays(-RetentionDays);
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
                    total += await PurgeOneAsync(cs, cutoff, ct);
                }
                catch (Exception ex)
                {
                    // Une base indisponible ne doit pas bloquer les autres tenants.
                    _log.LogWarning(ex, "AuditLog purge tenant {Slug} échoué", t.Slug);
                }
            }
        }
        else if (!string.IsNullOrWhiteSpace(defaultConn))
        {
            total = await PurgeOneAsync(defaultConn, cutoff, ct);
        }

        return total;
    }

    private static async Task<int> PurgeOneAsync(string connStr, DateTime cutoff, CancellationToken ct)
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(connStr, npg => npg.EnableRetryOnFailure())
            .Options;
        await using var db = new ApplicationDbContext(options);
        // ExecuteDeleteAsync = un seul DELETE serveur, pas de chargement en mémoire.
        // Index sur DateAction (à créer en migration si absent) rend cette requête O(log n).
        return await db.AuditLogs
            .Where(a => a.DateAction < cutoff)
            .ExecuteDeleteAsync(ct);
    }
}
