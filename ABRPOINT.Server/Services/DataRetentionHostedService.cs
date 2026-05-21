using ABRPOINT.Server.Data;
using ABRPOINT.Server.Tenancy;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Services;

/// <summary>
/// RGPD Art. 5.1.e (limitation de la conservation) + Art. 32 (sécurité par
/// minimisation) — purge quotidienne des données techniques expirées dans
/// chaque tenant. Complète <see cref="AuditLogRetentionHostedService"/> qui ne
/// couvrait que la table <c>AuditLog</c>.
///
/// Tables purgées (durées par défaut, configurables via <c>Security:Retention:*</c>) :
///
///   • <c>refresh_tokens</c>          — Refresh expirés/révoqués > 30 jours.
///                                       (Le quota de 5 RT actifs/user limite déjà
///                                       l'accumulation en steady state ; cette
///                                       purge nettoie les RT révoqués/expirés qui
///                                       traînent et la rotation post-violation.)
///   • <c>known_devices</c>           — Devices inactifs > 365 jours.
///   • <c>push_tokens</c>             — Tokens marqués <c>active=false</c> > 90 jours.
///   • <c>rag_chat_log</c>            — Historique IA > 90 jours (déjà documenté
///                                       en CGU et registre des traitements).
///
/// Hors-périmètre volontaire :
///   • Les employés "sortants" (Empsort) ne sont PAS purgés — leur conservation
///     dépend des obligations légales paie du client (5 ans en France) et reste
///     sous sa responsabilité de RT.
///   • Les utilisateurs et leurs PII (CIN, salaires) ne sont pas purgés ici.
///   • La table <c>AuditLog</c> est purgée par AuditLogRetentionHostedService.
///
/// Multi-tenant : itération des tenants Active/Trialing depuis la base master,
/// un <c>ApplicationDbContext</c> par tenant. Les bases indisponibles sont
/// loggées en warning et n'interrompent pas le sweep des autres tenants.
/// </summary>
public sealed class DataRetentionHostedService : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromHours(24);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IConfiguration _cfg;
    private readonly ILogger<DataRetentionHostedService> _log;

    public DataRetentionHostedService(
        IServiceScopeFactory scopeFactory,
        IConfiguration cfg,
        ILogger<DataRetentionHostedService> log)
    {
        _scopeFactory = scopeFactory;
        _cfg = cfg;
        _log = log;
    }

    // Plancher 7j sur toutes les rétentions techniques : empêche un opérateur
    // de purger en quasi temps réel et de perdre l'historique nécessaire au
    // debug d'incidents (vol de session, replay d'attaque).
    private const int MinDays = 7;

    private int RefreshTokenDays      => Clamp(_cfg.GetValue<int?>("Security:Retention:RefreshTokenDaysAfterExpiry") ?? 30);
    private int KnownDeviceDays       => Clamp(_cfg.GetValue<int?>("Security:Retention:KnownDeviceInactiveDays")     ?? 365);
    private int PushTokenInactiveDays => Clamp(_cfg.GetValue<int?>("Security:Retention:PushTokenInactiveDays")        ?? 90);
    private int RagChatLogDays        => Clamp(_cfg.GetValue<int?>("Security:Retention:RagChatLogDays")               ?? 90);

    private static int Clamp(int value) => value < MinDays ? MinDays : value;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try { await Task.Delay(TimeSpan.FromMinutes(2), stoppingToken); }
        catch (TaskCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var summary = await PurgeAllTenantsAsync(stoppingToken);
                if (summary.Total > 0)
                    _log.LogInformation(
                        "Data retention purge: RT={Rt} devices={Dev} push={Push} rag={Rag} (sur {Tenants} tenant(s)).",
                        summary.RefreshTokens, summary.KnownDevices, summary.PushTokens, summary.RagLogs, summary.Tenants);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                _log.LogError(ex, "Data retention sweep failed.");
            }

            try { await Task.Delay(Interval, stoppingToken); }
            catch (TaskCanceledException) { break; }
        }
    }

    private async Task<PurgeSummary> PurgeAllTenantsAsync(CancellationToken ct)
    {
        var template = _cfg.GetConnectionString("TenantTemplate");
        var masterConnection = _cfg.GetConnectionString("MasterConnection");
        var defaultConn = _cfg.GetConnectionString("DefaultConnection");
        var summary = new PurgeSummary();

        if (!string.IsNullOrWhiteSpace(masterConnection) && !string.IsNullOrWhiteSpace(template))
        {
            using var scope = _scopeFactory.CreateScope();
            var masterFactory = scope.ServiceProvider.GetService<IDbContextFactory<MasterDbContext>>();
            if (masterFactory is null) return summary;
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
                    var partial = await PurgeOneAsync(cs, ct);
                    summary.Add(partial);
                    summary.Tenants++;
                }
                catch (Exception ex)
                {
                    _log.LogWarning(ex, "Data retention tenant {Slug} échoué", t.Slug);
                }
            }
        }
        else if (!string.IsNullOrWhiteSpace(defaultConn))
        {
            var partial = await PurgeOneAsync(defaultConn, ct);
            summary.Add(partial);
            summary.Tenants = 1;
        }

        return summary;
    }

    private async Task<PurgeSummary> PurgeOneAsync(string connStr, CancellationToken ct)
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(connStr, npg => npg.EnableRetryOnFailure())
            .Options;
        await using var db = new ApplicationDbContext(options);

        var now = DateTime.UtcNow;

        // 1) Refresh tokens : expirés OU révoqués, et dont la date d'expiration
        //    remonte à plus de N jours. On garde N jours de tampon post-expiration
        //    pour permettre la corrélation forensique en cas d'incident.
        var rtCutoff = now.AddDays(-RefreshTokenDays);
        var rt = await db.RefreshTokens
            .Where(r => (r.Revoked || r.ExpiresAt < now) && r.ExpiresAt < rtCutoff)
            .ExecuteDeleteAsync(ct);

        // 2) Known devices : pas d'activité depuis > N jours.
        var devCutoff = now.AddDays(-KnownDeviceDays);
        var dev = await db.KnownDevices
            .Where(d => d.LastSeenAt < devCutoff)
            .ExecuteDeleteAsync(ct);

        // 3) Push tokens désactivés (Expo a renvoyé DeviceNotRegistered, ou
        //    désinstallation) ET inactifs depuis > N jours.
        var pushCutoff = now.AddDays(-PushTokenInactiveDays);
        var push = await db.PushTokens
            .Where(p => !p.Active && p.LastSeenAt < pushCutoff)
            .ExecuteDeleteAsync(ct);

        // 4) RAG chat logs : minimisation (les interactions IA contiennent des
        //    questions utilisateur potentiellement nominatives).
        var ragCutoff = now.AddDays(-RagChatLogDays);
        var rag = await db.RagChatLogs
            .Where(r => r.CreatedAt < ragCutoff)
            .ExecuteDeleteAsync(ct);

        return new PurgeSummary
        {
            RefreshTokens = rt,
            KnownDevices = dev,
            PushTokens = push,
            RagLogs = rag,
        };
    }

    private sealed class PurgeSummary
    {
        public int Tenants { get; set; }
        public int RefreshTokens { get; set; }
        public int KnownDevices { get; set; }
        public int PushTokens { get; set; }
        public int RagLogs { get; set; }
        public int Total => RefreshTokens + KnownDevices + PushTokens + RagLogs;

        public void Add(PurgeSummary other)
        {
            RefreshTokens += other.RefreshTokens;
            KnownDevices += other.KnownDevices;
            PushTokens += other.PushTokens;
            RagLogs += other.RagLogs;
        }
    }
}
