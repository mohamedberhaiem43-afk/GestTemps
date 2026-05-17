using ABRPOINT.Server.Helpers;
using ABRPOINT.Server.Tenancy;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace ABRPOINT.Server.Billing;

/// <summary>
/// Mesure périodique du stockage consommé par chaque tenant. Le résultat est
/// stocké dans <see cref="Tenant.StorageUsedMb"/> (master DB) et comparé au
/// quota dérivé du <see cref="Tenant.PlanCode"/> via
/// <see cref="PlanCatalog.GetStorageQuotaMb(string?)"/> par <c>StorageQuotaGuard</c>
/// au moment d'un upload.
///
/// Cadence : une fois par heure (configurable via <c>Storage:UsageSweepIntervalMinutes</c>).
/// Eventually-consistent : un burst d'uploads peut brièvement dépasser le quota
/// entre deux passages — acceptable pour du SaaS B2B vu l'absence d'enjeu temps-réel.
/// Pour bloquer durement, il faudrait un hard-quota PG (tablespace par tenant
/// avec quota filesystem), beaucoup plus lourd côté ops.
///
/// MESURE V2 (2026-05) : somme de
///   - <c>pg_database_size(DbName)</c> (taille on-disk de la base PG du tenant)
///   - taille récursive de <c>uploads/{slug}/</c> (fichiers per-tenant, cf.
///     <c>FileHelper.SaveFile(file, slug)</c> qui écrit là depuis 2026-05).
/// Les fichiers legacy à la racine de <c>uploads/</c> (créés avant la migration
/// per-tenant) ne sont PAS comptés — pas attribués à un tenant. Acceptable :
/// volumétrie résiduelle dans la première période de migration, à passer en
/// nettoyage ops si nécessaire.
/// </summary>
public sealed class StorageUsageHostedService : BackgroundService
{
    private readonly IServiceProvider _services;
    private readonly ILogger<StorageUsageHostedService> _log;
    private readonly IConfiguration _cfg;

    public StorageUsageHostedService(
        IServiceProvider services,
        IConfiguration cfg,
        ILogger<StorageUsageHostedService> log)
    {
        _services = services;
        _cfg = cfg;
        _log = log;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var intervalMin = int.TryParse(_cfg["Storage:UsageSweepIntervalMinutes"], out var m) && m > 0 ? m : 60;
        // Démarrage différé : laisse l'app finir son boot avant de scanner toutes les bases.
        try { await Task.Delay(TimeSpan.FromMinutes(2), stoppingToken); }
        catch (TaskCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await RunOnceAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "StorageUsage : erreur globale d'itération, on continue à la suivante.");
            }

            try { await Task.Delay(TimeSpan.FromMinutes(intervalMin), stoppingToken); }
            catch (TaskCanceledException) { break; }
        }
    }

    private async Task RunOnceAsync(CancellationToken ct)
    {
        using var scope = _services.CreateScope();
        var masterFactory = scope.ServiceProvider.GetService<IDbContextFactory<Tenancy.MasterDbContext>>();
        if (masterFactory is null)
        {
            _log.LogInformation("StorageUsage : MasterDbContext non configuré, sweep ignoré.");
            return;
        }

        var masterCs = _cfg.GetConnectionString("MasterConnection");
        if (string.IsNullOrWhiteSpace(masterCs))
        {
            _log.LogWarning("StorageUsage : MasterConnection manquant, sweep impossible.");
            return;
        }

        await using var master = await masterFactory.CreateDbContextAsync(ct);
        // On mesure tous les tenants qui ont une base provisionnée. Les Failed/Cancelled
        // sont exclus : leur base n'existe plus (DropDatabase au teardown) et
        // pg_database_size() retournerait une erreur.
        var tenants = await master.Tenants
            .Where(t => t.Status == "Active" || t.Status == "Trialing"
                     || t.Status == "PastDue" || t.Status == "Suspended"
                     || t.Status == "Provisioning")
            .ToListAsync(ct);

        int processed = 0, updated = 0, errored = 0;
        var nowNaive = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Unspecified);

        // Parallélisation bornée : chaque mesure est I/O-bound (1 connexion PG + 1 SELECT).
        // Le degré reste modéré pour ne pas saturer le pool de connexions PG (typiquement
        // 100 max côté serveur). À 8 connexions concurrentes on garde large marge.
        await Parallel.ForEachAsync(
            tenants,
            new ParallelOptions { MaxDegreeOfParallelism = 8, CancellationToken = ct },
            async (tenant, innerCt) =>
            {
                Interlocked.Increment(ref processed);
                try
                {
                    var dbBytes = await GetDatabaseSizeBytesAsync(masterCs, tenant.DbName, innerCt);
                    if (dbBytes < 0)
                    {
                        // -1 = base introuvable ou erreur transitoire → on n'écrase pas
                        // la valeur précédente avec 0 (qui aurait l'effet de bord de
                        // débloquer un tenant suspendu pour quota le temps que la base
                        // se reconnecte).
                        return;
                    }
                    // Taille du dossier d'uploads dédié au tenant (FileHelper.SaveFile
                    // y écrit depuis 2026-05). Best-effort : si le dossier n'existe pas
                    // encore (tenant fraîchement créé sans aucun upload), on compte 0.
                    var uploadsBytes = GetTenantUploadsFolderBytes(tenant.Slug);
                    var sizeBytes = dbBytes + uploadsBytes;
                    var sizeMb = sizeBytes / (1024L * 1024L);

                    // Charge UNE ligne fraîche du tenant pour éviter les conflits de
                    // concurrence (par ex. un webhook Stripe qui update Status en parallèle).
                    await using var localMaster = await masterFactory.CreateDbContextAsync(innerCt);
                    var fresh = await localMaster.Tenants.FirstOrDefaultAsync(t => t.Id == tenant.Id, innerCt);
                    if (fresh is null) return;

                    fresh.StorageUsedMb = sizeMb;
                    fresh.StorageUsageCheckedAt = nowNaive;
                    await localMaster.SaveChangesAsync(innerCt);
                    Interlocked.Increment(ref updated);
                }
                catch (Exception ex)
                {
                    Interlocked.Increment(ref errored);
                    _log.LogWarning(ex, "StorageUsage tenant {Slug} : erreur de mesure.", tenant.Slug);
                }
            });

        _log.LogInformation(
            "StorageUsage : {Processed} tenants scannés ({Updated} mis à jour, {Errored} en erreur).",
            processed, updated, errored);
    }

    /// <summary>
    /// Retourne la taille on-disk d'une base PG en octets, ou -1 si la base n'existe
    /// pas / est inaccessible. Utilise <c>pg_database_size(name)</c> qui agrège la
    /// taille de tous les fichiers data + WAL inactifs + index. C'est la même métrique
    /// que <c>du -sh $PGDATA/base/oid</c>, soit ce que paye réellement l'hébergeur.
    /// </summary>
    private async Task<long> GetDatabaseSizeBytesAsync(string masterCs, string dbName, CancellationToken ct)
    {
        // Connexion à la base "postgres" (toujours présente) — pg_database_size accepte
        // n'importe quelle base de destination, on n'a pas besoin de switcher sur la base
        // du tenant lui-même (qui aurait pu être suspended/dropped).
        var builder = new NpgsqlConnectionStringBuilder(masterCs) { Database = "postgres" };
        await using var conn = new NpgsqlConnection(builder.ConnectionString);
        await conn.OpenAsync(ct);

        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT pg_database_size(@name)";
        cmd.Parameters.AddWithValue("@name", dbName);
        try
        {
            var result = await cmd.ExecuteScalarAsync(ct);
            if (result is null || result is DBNull) return -1;
            return Convert.ToInt64(result);
        }
        catch (PostgresException pex) when (pex.SqlState == "3D000" || pex.SqlState == "42704")
        {
            // 3D000 = invalid_catalog_name (DB introuvable), 42704 = undefined_object.
            // Tenant provisionné mais base pas encore créée, ou drop entre temps.
            return -1;
        }
    }

    /// <summary>
    /// Taille récursive du dossier <c>uploads/{slug}/</c> en octets, ou 0 si le
    /// dossier n'existe pas. Synchrone : <see cref="DirectoryInfo.EnumerateFiles"/>
    /// reste rapide tant qu'il y a quelques centaines/milliers de fichiers par
    /// tenant (le cas typique du SaaS RH : justificatifs + bulletins de paie).
    /// Si un tenant accumule des dizaines de milliers de fichiers, on basculera
    /// sur du <c>du --block-size=1</c> via Process.
    /// </summary>
    private static long GetTenantUploadsFolderBytes(string slug)
    {
        try
        {
            var dir = FileHelper.GetTenantUploadsPath(slug);
            if (!Directory.Exists(dir)) return 0;
            long total = 0;
            // SearchOption.AllDirectories : couvre les éventuels sous-dossiers
            // (cf. RAG documents dans uploads/{soccod}/rag/ historique).
            foreach (var path in Directory.EnumerateFiles(dir, "*", SearchOption.AllDirectories))
            {
                try { total += new FileInfo(path).Length; }
                catch { /* fichier supprimé entre EnumerateFiles et FileInfo, on l'ignore */ }
            }
            return total;
        }
        catch
        {
            // Permission denied, dossier dans un état transitoire, etc. On retourne 0
            // plutôt que -1 (qui annulerait la mise à jour de StorageUsedMb) — la
            // base PG reste comptée même si l'inspection FS échoue.
            return 0;
        }
    }
}
