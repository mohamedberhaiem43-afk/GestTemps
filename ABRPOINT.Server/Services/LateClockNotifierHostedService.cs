using System.Collections.Concurrent;
using ABRPOINT.Helper;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Models;
using ABRPOINT.Server.Tenancy;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Services;

/// <summary>
/// Service de fond qui notifie les EMPLOYEURS (managers / RH / admins rattachés au site de
/// l'employé — cf. <see cref="IUserNotificationService.NotifyManagersForEmployeeAsync"/>) quand un
/// collaborateur a pointé :
///   - son ENTRÉE en RETARD (au-delà de la tolérance du poste <c>Apresent</c>), ou
///   - sa SORTIE finale en AVANCE / DÉPART ANTICIPÉ (au-delà de la tolérance <c>Avantsort</c>).
///
/// Les heures attendues proviennent du POSTE de l'employé pour le jour (mêmes plages que l'état
/// de retard / le rappel de pointage). Tourne toutes les 15 min, idempotent par {empcod, jour, type}
/// via <see cref="PushReminderLog"/> (types "late_in" / "early_out"), pour ne notifier qu'une fois.
///
/// NB : on ne flague le départ anticipé que lorsque la sortie FINALE est effectivement pointée
/// (sinon c'est un oubli de pointage, géré par <see cref="PunctualityReminderHostedService"/>).
/// </summary>
public sealed class LateClockNotifierHostedService : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(15);

    // Garde « migré une fois par tenant et par process », analogue au cache du
    // TenantResolverMiddleware : évite de relancer le migrateur à chaque sweep (15 min).
    private static readonly ConcurrentDictionary<string, byte> _migratedTenants = new();

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IConfiguration _cfg;
    private readonly ILogger<LateClockNotifierHostedService> _log;

    public LateClockNotifierHostedService(
        IServiceScopeFactory scopeFactory,
        IConfiguration cfg,
        ILogger<LateClockNotifierHostedService> log)
    {
        _scopeFactory = scopeFactory;
        _cfg = cfg;
        _log = log;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try { await Task.Delay(TimeSpan.FromMinutes(2), stoppingToken); }
        catch (TaskCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try { await ProcessAllTenantsAsync(stoppingToken); }
            catch (OperationCanceledException) { break; }
            catch (Exception ex) { _log.LogError(ex, "LateClockNotifier sweep failed."); }

            try { await Task.Delay(Interval, stoppingToken); }
            catch (TaskCanceledException) { break; }
        }
    }

    private async Task ProcessAllTenantsAsync(CancellationToken ct)
    {
        var template = _cfg.GetConnectionString("TenantTemplate");
        var masterConnection = _cfg.GetConnectionString("MasterConnection");
        var defaultConn = _cfg.GetConnectionString("DefaultConnection");

        if (!string.IsNullOrWhiteSpace(masterConnection) && !string.IsNullOrWhiteSpace(template))
        {
            using var scope = _scopeFactory.CreateScope();
            var masterFactory = scope.ServiceProvider.GetService<IDbContextFactory<MasterDbContext>>();
            if (masterFactory is null) return;
            await using var master = await masterFactory.CreateDbContextAsync(ct);
            var tenants = await master.Tenants
                .AsNoTracking()
                .Where(t => t.Status == "Active" || t.Status == "Trialing")
                .ToListAsync(ct);

            await Parallel.ForEachAsync(
                tenants,
                new ParallelOptions { MaxDegreeOfParallelism = 4, CancellationToken = ct },
                async (t, innerCt) =>
                {
                    try
                    {
                        var cs = template.Replace("{DbName}", t.DbName);
                        await ProcessOneAsync(cs, t.Slug, innerCt);
                    }
                    catch (Exception ex)
                    {
                        _log.LogWarning(ex, "LateClock tenant {Slug} échoué", t.Slug);
                    }
                });
        }
        else if (!string.IsNullOrWhiteSpace(defaultConn))
        {
            await ProcessOneAsync(defaultConn, "_legacy", ct);
        }
    }

    private async Task ProcessOneAsync(string connStr, string tenantTag, CancellationToken ct)
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(connStr, npg => npg.EnableRetryOnFailure())
            .Options;

        await using var db = new ApplicationDbContext(options);

        // Les migrations de schéma idempotentes (ajout de colonnes type presence.preacc,
        // prelat/prelon…) ne tournent QUE de façon paresseuse à la 1re requête HTTP d'un
        // tenant (cf. TenantResolverMiddleware). Or ce hosted service balaie TOUS les
        // tenants depuis la base master, sans trafic HTTP : un tenant jamais sollicité
        // depuis le démarrage du process garde son schéma legacy → 42703 « column
        // p.preacc does not exist » sur le SELECT ci-dessous. On garantit donc la
        // migration ici, une fois par tenant et par process (idempotent + bon marché :
        // chaque étape court-circuite via les checks d'existence).
        if (_migratedTenants.TryAdd(tenantTag, 0))
        {
            try { await BaseDataSchemaMigrator.MigrateAsync(db, ct); }
            catch (Exception migEx)
            {
                // On retire le tag pour réessayer au prochain passage si la migration
                // a échoué (lock concurrent au boot, etc.) — sans bloquer le sweep.
                _migratedTenants.TryRemove(tenantTag, out _);
                _log.LogWarning(migEx, "LateClock migration schéma ignorée pour tenant {Tenant}", tenantTag);
            }
        }

        var today = DateTime.Today;

        var presencesToday = await db.Presences
            .AsNoTracking()
            .Where(p => p.Predat.HasValue && p.Predat.Value.Date == today)
            .ToListAsync(ct);
        if (presencesToday.Count == 0) return;

        // Libellés employés (pour le corps de la notif) + fallback poste si la présence n'en porte pas.
        var employees = await db.Employes
            .AsNoTracking()
            .Select(e => new { e.Empcod, e.Soccod, e.Emplib, e.Poscod })
            .ToListAsync(ct);
        var empByKey = employees
            .Where(e => e.Empcod != null && e.Soccod != null)
            .ToDictionary(e => $"{e.Soccod}|{e.Empcod}", e => e);

        var postes = await db.Postes.AsNoTracking().ToListAsync(ct);
        var posteByKey = postes
            .Where(p => p.Codposte != null && p.Soccod != null)
            .ToDictionary(p => $"{p.Soccod}|{p.Codposte}", p => p);

        // Dédup persistante : un seul "late_in" et un seul "early_out" par employé et par jour.
        var alreadyToday = await db.PushReminderLogs
            .AsNoTracking()
            .Where(l => l.ForDate == today && (l.Type == "late_in" || l.Type == "early_out"))
            .Select(l => new { l.Empcod, l.Type })
            .ToListAsync(ct);
        var dedupSet = new HashSet<string>(alreadyToday.Select(a => $"{a.Empcod}|{a.Type}"));

        // (Soccod, Empcod, Type, Title, Body, data minutes) à notifier aux managers.
        var candidates = new List<(string Soccod, string Empcod, string Type, string Category, string Title, string Body, int Minutes)>();

        foreach (var pr in presencesToday)
        {
            if (string.IsNullOrEmpty(pr.Empcod) || string.IsNullOrEmpty(pr.Soccod)) continue;
            if (IsTrue(pr.Prerepos)) continue; // jour de repos

            var codposte = !string.IsNullOrEmpty(pr.Codposte)
                ? pr.Codposte
                : (empByKey.TryGetValue($"{pr.Soccod}|{pr.Empcod}", out var e0) ? e0.Poscod : null);
            if (string.IsNullOrEmpty(codposte)) continue;
            if (!posteByKey.TryGetValue($"{pr.Soccod}|{codposte}", out var poste)) continue;

            var (mStart, mEnd, eStart, eEnd) = GenericMethodes.GetStartsWorkDay(today, poste);
            var emplib = empByKey.TryGetValue($"{pr.Soccod}|{pr.Empcod}", out var e1) && !string.IsNullOrWhiteSpace(e1.Emplib)
                ? e1.Emplib! : pr.Empcod!;

            // ── Retard d'ENTRÉE ──
            var graceLate = poste.Apresent ?? 0;
            int? expStart = ToMinutes(mStart);
            int? actEntry = ToMinutes(pr.Preentmatup);
            string? entryRef = mStart;
            if (!expStart.HasValue) { expStart = ToMinutes(eStart); actEntry = ToMinutes(pr.Preentamidiup); entryRef = eStart; }
            if (expStart.HasValue && actEntry.HasValue)
            {
                var lateMin = actEntry.Value - expStart.Value;
                if (lateMin > graceLate && !dedupSet.Contains($"{pr.Empcod}|late_in"))
                {
                    candidates.Add((pr.Soccod!, pr.Empcod!, "late_in", "late_arrival",
                        "⏰ Retard de pointage",
                        $"{emplib} a pointé son entrée en retard de {lateMin} min (prévue à {entryRef}).",
                        lateMin));
                }
            }

            // ── Départ ANTICIPÉ (sortie finale uniquement) ──
            var graceEarly = poste.Avantsort ?? 0;
            var twoSessions = !string.IsNullOrWhiteSpace(eEnd);
            string? expEndStr = twoSessions ? eEnd : mEnd;
            int? expEnd = ToMinutes(expEndStr);
            int? actExit = twoSessions ? ToMinutes(pr.Presortamidiup) : ToMinutes(pr.Presortmatup);
            if (expEnd.HasValue && actExit.HasValue)
            {
                var earlyMin = expEnd.Value - actExit.Value;
                if (earlyMin > graceEarly && !dedupSet.Contains($"{pr.Empcod}|early_out"))
                {
                    candidates.Add((pr.Soccod!, pr.Empcod!, "early_out", "early_leave",
                        "🚪 Départ anticipé",
                        $"{emplib} a pointé sa sortie {earlyMin} min en avance (prévue à {expEndStr}).",
                        earlyMin));
                }
            }
        }

        if (candidates.Count == 0) return;

        using var scope = _scopeFactory.CreateScope();
        var notify = scope.ServiceProvider.GetService<IUserNotificationService>();
        if (notify is null) return;

        var notified = new List<(string Empcod, string Type)>();
        foreach (var c in candidates)
        {
            var data = new { type = c.Category, empcod = c.Empcod, soccod = c.Soccod, date = today.ToString("yyyy-MM-dd"), minutes = c.Minutes };
            await notify.NotifyManagersForEmployeeAsync(c.Soccod, c.Empcod, c.Title, c.Body, data, ct);
            notified.Add((c.Empcod, c.Type));
        }

        _log.LogInformation("LateClock notifications tenant {Tenant} : {N} alerte(s) employeur.", tenantTag, candidates.Count);

        foreach (var n in notified.Distinct())
        {
            try
            {
                db.PushReminderLogs.Add(new PushReminderLog
                {
                    Empcod = n.Empcod,
                    Type = n.Type,
                    ForDate = today,
                    SentAt = DateTime.UtcNow,
                });
            }
            catch { /* noop */ }
        }
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException) { /* collision index unique : tolérable */ }
    }

    /// <summary>"HH:mm" → minutes depuis minuit, ou null si vide/illisible.</summary>
    private static int? ToMinutes(string? hhmm)
    {
        if (string.IsNullOrWhiteSpace(hhmm)) return null;
        var parts = hhmm.Split(':');
        if (parts.Length < 2) return null;
        if (!int.TryParse(parts[0], out var h) || !int.TryParse(parts[1], out var m)) return null;
        return h * 60 + m;
    }

    private static bool IsTrue(object? v)
    {
        if (v is bool b) return b;
        if (v is string s) return s == "1" || s.Equals("true", StringComparison.OrdinalIgnoreCase) || s == "Oui";
        return false;
    }
}
