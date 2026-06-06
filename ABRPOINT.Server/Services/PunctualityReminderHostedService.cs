using System.Collections.Concurrent;
using ABRPOINT.Helper;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Models;
using ABRPOINT.Server.Tenancy;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Services;

/// <summary>
/// Service de fond qui envoie un rappel push quand un employé a oublié de pointer :
///   - Entrée matin : si maintenant > heure prévue + 15 min ET aucune entrée enregistrée.
///   - Sortie : si maintenant > heure prévue + 15 min ET pointage entrée présent mais pas de sortie.
///
/// Tourne toutes les 15 minutes, idempotent par jour+type via une table push_reminders_log
/// (in-memory pour l'instant : on garde la dernière fois où on a notifié l'employé en mémoire).
/// </summary>
public sealed class PunctualityReminderHostedService : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(15);
    /// <summary>Délai après l'heure prévue avant de notifier l'utilisateur.</summary>
    private static readonly TimeSpan GracePeriod = TimeSpan.FromMinutes(15);

    // Garde « migré une fois par tenant et par process » : ce sweep balaie les tenants
    // depuis la master sans trafic HTTP, donc le migrateur paresseux du middleware
    // (TenantResolverMiddleware) n'a pas tourné → 42703 sur les colonnes récentes
    // (presence.preacc…). On garantit la migration ici, idempotente.
    private static readonly ConcurrentDictionary<string, byte> _migratedTenants = new();

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IConfiguration _cfg;
    private readonly ILogger<PunctualityReminderHostedService> _log;

    public PunctualityReminderHostedService(
        IServiceScopeFactory scopeFactory,
        IConfiguration cfg,
        ILogger<PunctualityReminderHostedService> log)
    {
        _scopeFactory = scopeFactory;
        _cfg = cfg;
        _log = log;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Délai initial pour laisser l'app démarrer.
        try { await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken); }
        catch (TaskCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try { await ProcessAllTenantsAsync(stoppingToken); }
            catch (OperationCanceledException) { break; }
            catch (Exception ex) { _log.LogError(ex, "PunctualityReminder sweep failed."); }

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
            // Mode SaaS multi-tenant : on itère les tenants Active/Trialing.
            using var scope = _scopeFactory.CreateScope();
            var masterFactory = scope.ServiceProvider.GetService<IDbContextFactory<MasterDbContext>>();
            if (masterFactory is null) return;
            await using var master = await masterFactory.CreateDbContextAsync(ct);
            var tenants = await master.Tenants
                .AsNoTracking()
                .Where(t => t.Status == "Active" || t.Status == "Trialing")
                .ToListAsync(ct);

            // PERF — Parallélisation bornée. Chaque tenant ouvre son propre DbContext
            // (cf. ProcessOneAsync) et appelle Firebase Cloud Messaging (HTTP). Sur 50
            // tenants × ~300-500 ms de traitement, on passait à ~15-25 s en séquentiel.
            // Degré 4 : compromis entre rapidité et charge sur FCM/SQL (ne pas saturer
            // le pool de connexions tenant). Le sweep tourne toutes les 15 min, on a
            // largement le temps.
            await Parallel.ForEachAsync(
                tenants,
                new ParallelOptions
                {
                    MaxDegreeOfParallelism = 4,
                    CancellationToken = ct,
                },
                async (t, innerCt) =>
                {
                    try
                    {
                        var cs = template.Replace("{DbName}", t.DbName);
                        await ProcessOneAsync(cs, t.Slug, innerCt);
                    }
                    catch (Exception ex)
                    {
                        // Une base tenant indisponible ne doit pas bloquer les autres.
                        _log.LogWarning(ex, "Reminder tenant {Slug} échoué", t.Slug);
                    }
                });
        }
        else if (!string.IsNullOrWhiteSpace(defaultConn))
        {
            // Mode legacy mono-tenant.
            await ProcessOneAsync(defaultConn, "_legacy", ct);
        }
    }

    private async Task ProcessOneAsync(string connStr, string tenantTag, CancellationToken ct)
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(connStr, npg => npg.EnableRetryOnFailure())
            .Options;

        await using var db = new ApplicationDbContext(options);

        // Garantit que le schéma du tenant est à jour avant toute requête : un tenant
        // jamais sollicité par HTTP depuis le démarrage du process n'a pas eu sa migration
        // paresseuse (cf. TenantResolverMiddleware) → SELECT sur db.Presences échouerait
        // en 42703 « column p.preacc does not exist ». Idempotent, 1× par tenant/process.
        if (_migratedTenants.TryAdd(tenantTag, 0))
        {
            try { await BaseDataSchemaMigrator.MigrateAsync(db, ct); }
            catch (Exception migEx)
            {
                _migratedTenants.TryRemove(tenantTag, out _);
                _log.LogWarning(migEx, "PunctualityReminder migration schéma ignorée pour tenant {Tenant}", tenantTag);
            }
        }

        // Liste des employés actifs aujourd'hui
        var today = DateTime.Today;
        var employees = await db.Employes
            .AsNoTracking()
            .Where(e => e.Actif == "1" || e.Actif == "Oui" || e.Actif == null)
            .Select(e => new { e.Empcod, e.Soccod, e.Sercod, e.Catcod, e.Poscod })
            .ToListAsync(ct);

        if (employees.Count == 0) return;

        var presencesToday = await db.Presences
            .AsNoTracking()
            .Where(p => p.Predat == today)
            .ToListAsync(ct);

        // Set des Uticod ayant un push token actif. Convention codebase : pour un employé
        // self-service, Uticod == Empcod (cf. MobileAuthController.RegisterPushToken qui
        // utilise le claim NameIdentifier=Uticod issu du JWT). Si un tenant fait diverger
        // Empcod / Uticod, on ratera ses reminders ici — à corriger via une jointure
        // Utilisateur dédiée le jour où ce cas apparaît.
        var activeUticods = await db.PushTokens
            .AsNoTracking()
            .Where(t => t.Active && t.Uticod != null)
            .Select(t => t.Uticod!)
            .Distinct()
            .ToListAsync(ct);
        var activeUticodsSet = new HashSet<string>(activeUticods, StringComparer.OrdinalIgnoreCase);

        // Dédup persistante via push_reminder_log : on regarde quels (empcod, type) ont déjà
        // été notifiés aujourd'hui pour ne jamais spammer, même si le serveur redémarre.
        var alreadyToday = await db.PushReminderLogs
            .AsNoTracking()
            .Where(l => l.ForDate == today)
            .Select(l => new { l.Empcod, l.Type })
            .ToListAsync(ct);
        var dedupSet = new HashSet<string>(alreadyToday.Select(a => $"{a.Empcod}|{a.Type}"));

        // Liste des candidats à notifier (un appel NotifyUserAsync par candidat).
        var candidates = new List<(string Uticod, string Empcod, string Type, string Title, string Body, string Hour)>();

        var now = DateTime.Now;

        foreach (var emp in employees)
        {
            if (string.IsNullOrEmpty(emp.Empcod) || string.IsNullOrEmpty(emp.Poscod) || string.IsNullOrEmpty(emp.Soccod)) continue;
            // On suppose Uticod=Empcod (cf. note plus haut). Skip si pas de token actif.
            if (!activeUticodsSet.Contains(emp.Empcod)) continue;

            // Récup poste
            var poste = await db.Postes
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Soccod == emp.Soccod && p.Codposte == emp.Poscod, ct);
            if (poste is null) continue;

            var (mStart, mEnd, eStart, eEnd) = GenericMethodes.GetStartsWorkDay(today, poste);

            var presence = presencesToday.FirstOrDefault(p => p.Empcod == emp.Empcod && p.Soccod == emp.Soccod);

            // Ignorer repos
            if (presence != null && IsTrue(presence.Prerepos)) continue;

            // 1️⃣ Rappel ENTRÉE
            var morningStart = ParseHour(mStart, today);
            if (morningStart.HasValue)
            {
                var dueAt = morningStart.Value + GracePeriod;
                var hasEntry = !string.IsNullOrEmpty(presence?.Preentmatup) || !string.IsNullOrEmpty(presence?.Preentamidiup);
                if (now > dueAt && !hasEntry && !dedupSet.Contains($"{emp.Empcod}|in"))
                {
                    candidates.Add((emp.Empcod!, emp.Empcod!, "in",
                        "🕒 Rappel pointage",
                        $"N'oubliez pas de pointer votre entrée (prévue à {mStart}).",
                        mStart ?? ""));
                }
            }

            // 2️⃣ Rappel SORTIE — si pointage entrée présent mais pas de sortie après l'heure prévue
            var dayEnd = ParseHour(eEnd ?? mEnd, today);
            if (dayEnd.HasValue && presence != null)
            {
                var dueAt = dayEnd.Value + GracePeriod;
                var hasEntry = !string.IsNullOrEmpty(presence.Preentmatup) || !string.IsNullOrEmpty(presence.Preentamidiup);
                var hasExit = !string.IsNullOrEmpty(presence.Presortmatup) || !string.IsNullOrEmpty(presence.Presortamidiup);
                if (now > dueAt && hasEntry && !hasExit && !dedupSet.Contains($"{emp.Empcod}|out"))
                {
                    candidates.Add((emp.Empcod!, emp.Empcod!, "out",
                        "🚪 Pointage sortie ?",
                        $"Pensez à pointer votre sortie (prévue à {(eEnd ?? mEnd)}).",
                        eEnd ?? mEnd ?? ""));
                }
            }
        }

        if (candidates.Count == 0) return;

        // Délégué à IUserNotificationService.NotifyUserAsync : il applique les filtres
        // de préférences (category=reminder_in/reminder_out — défaut ON), les heures
        // silencieuses, persiste l'historique in-app, et envoie via Expo. Ce passage
        // évitait au précédent code la prise en compte des prefs (le user pouvait avoir
        // coupé ses rappels dans NotificationPreferencesScreen sans effet).
        using var scope = _scopeFactory.CreateScope();
        var notify = scope.ServiceProvider.GetService<IUserNotificationService>();
        if (notify is null) return;

        int totalSent = 0;
        var notifiedOwners = new List<(string Empcod, string Type)>();
        foreach (var c in candidates)
        {
            var data = new { type = c.Type == "in" ? "reminder_in" : "reminder_out", date = today.ToString("yyyy-MM-dd") };
            var sent = await notify.NotifyUserAsync(c.Uticod, c.Title, c.Body, data, ct);
            totalSent += sent;
            // On enregistre la dédup même si sent==0 : l'utilisateur a pu désactiver
            // le canal push dans ses prefs, et on ne veut pas re-tenter chaque 15 min.
            // L'historique in-app a déjà été persisté côté NotifyUserAsync.
            notifiedOwners.Add((c.Empcod, c.Type));
        }

        _log.LogInformation("Punctuality reminders for tenant {Tenant} : candidates={N} sent={Sent}",
            tenantTag, candidates.Count, totalSent);

        // Persiste la dédup en DB pour ne pas re-notifier au prochain tour ni au redémarrage.
        // Idempotent : index unique (empcod, for_date, type) — on protège l'insert avec try/catch.
        foreach (var owner in notifiedOwners.Distinct())
        {
            try
            {
                db.PushReminderLogs.Add(new PushReminderLog
                {
                    Empcod = owner.Empcod,
                    Type = owner.Type,
                    ForDate = today,
                    SentAt = DateTime.UtcNow,
                });
            }
            catch { /* noop */ }
        }
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException) { /* race ou collision sur l'index unique : tolérable */ }
    }

    private static DateTime? ParseHour(string? hhmm, DateTime day)
    {
        if (string.IsNullOrWhiteSpace(hhmm)) return null;
        var parts = hhmm.Split(':');
        if (parts.Length < 2) return null;
        if (!int.TryParse(parts[0], out var h) || !int.TryParse(parts[1], out var m)) return null;
        return new DateTime(day.Year, day.Month, day.Day, h, m, 0, DateTimeKind.Local);
    }

    private static bool IsTrue(object? v)
    {
        if (v is bool b) return b;
        if (v is string s) return s == "1" || s.Equals("true", StringComparison.OrdinalIgnoreCase) || s == "Oui";
        return false;
    }
}
