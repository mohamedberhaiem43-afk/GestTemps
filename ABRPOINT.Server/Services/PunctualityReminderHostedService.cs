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
            foreach (var t in tenants)
            {
                var cs = template.Replace("{DbName}", t.DbName);
                await ProcessOneAsync(cs, t.Slug, ct);
            }
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
            .UseSqlServer(connStr, sql => sql.EnableRetryOnFailure())
            .Options;

        await using var db = new ApplicationDbContext(options);

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

        // Tokens push par utilisateur
        var pushTokens = await db.PushTokens
            .AsNoTracking()
            .Where(t => t.Active)
            .ToListAsync(ct);
        var tokensByUser = pushTokens
            .GroupBy(t => t.Uticod)
            .ToDictionary(g => g.Key, g => g.Select(t => t.Token).ToList());

        // Dédup persistante via push_reminder_log : on regarde quels (empcod, type) ont déjà
        // été notifiés aujourd'hui pour ne jamais spammer, même si le serveur redémarre.
        var alreadyToday = await db.PushReminderLogs
            .AsNoTracking()
            .Where(l => l.ForDate == today)
            .Select(l => new { l.Empcod, l.Type })
            .ToListAsync(ct);
        var dedupSet = new HashSet<string>(alreadyToday.Select(a => $"{a.Empcod}|{a.Type}"));

        var messages = new List<ExpoPushMessage>();
        var messageOwners = new List<(string Empcod, string Type)>();

        var now = DateTime.Now;

        foreach (var emp in employees)
        {
            if (string.IsNullOrEmpty(emp.Poscod) || string.IsNullOrEmpty(emp.Soccod)) continue;
            if (!tokensByUser.TryGetValue(emp.Empcod ?? "", out var tokens) || tokens.Count == 0) continue;

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
                    foreach (var token in tokens)
                        messages.Add(new ExpoPushMessage(
                            token,
                            "🕒 Rappel pointage",
                            $"N'oubliez pas de pointer votre entrée (prévue à {mStart}).",
                            new { type = "reminder_in", date = today.ToString("yyyy-MM-dd") }));
                    messageOwners.Add((emp.Empcod!, "in"));
                    dedupSet.Add($"{emp.Empcod}|in");
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
                    foreach (var token in tokens)
                        messages.Add(new ExpoPushMessage(
                            token,
                            "🚪 Pointage sortie ?",
                            $"Pensez à pointer votre sortie (prévue à {(eEnd ?? mEnd)}).",
                            new { type = "reminder_out", date = today.ToString("yyyy-MM-dd") }));
                    messageOwners.Add((emp.Empcod!, "out"));
                    dedupSet.Add($"{emp.Empcod}|out");
                }
            }
        }

        if (messages.Count > 0)
        {
            using var scope = _scopeFactory.CreateScope();
            var push = scope.ServiceProvider.GetService<IExpoPushService>();
            if (push is null) return;

            var result = await push.SendAsync(messages, ct);
            _log.LogInformation("Punctuality reminders for tenant {Tenant} : sent={Sent} invalid={Invalid}",
                tenantTag, result.Sent, result.InvalidTokens.Count);

            // Persiste la dédup en DB pour ne pas re-notifier au prochain tour ni au redémarrage.
            // Idempotent : index unique (empcod, for_date, type) — on protège l'insert avec try/catch.
            foreach (var owner in messageOwners.Distinct())
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

            // Désactiver les tokens devenus invalides (DeviceNotRegistered).
            if (result.InvalidTokens.Count > 0)
            {
                var deactivate = await db.PushTokens
                    .Where(t => result.InvalidTokens.Contains(t.Token))
                    .ToListAsync(ct);
                foreach (var t in deactivate) t.Active = false;
                await db.SaveChangesAsync(ct);
            }
        }
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
