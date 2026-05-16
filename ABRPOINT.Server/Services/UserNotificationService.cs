using ABRPOINT.Server.Authorization;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Models;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace ABRPOINT.Server.Services;

/// <summary>
/// Façade haut niveau au-dessus de IExpoPushService : résout les tokens push d'un utilisateur
/// (ou d'un rôle), envoie un message, désactive automatiquement les tokens devenus invalides.
///
/// Toutes les méthodes sont best-effort et fail-silent : un push qui échoue ne doit jamais
/// faire échouer l'action métier (ex: créer une demande de congé).
/// </summary>
public interface IUserNotificationService
{
    Task<int> NotifyUserAsync(string uticod, string title, string body, object? data = null, CancellationToken ct = default);
    Task<int> NotifyManagersAsync(string title, string body, object? data = null, CancellationToken ct = default);
    /// <summary>Cible explicitement les admins (Utirole=Administrator OU Utiadm=1).</summary>
    Task<int> NotifyAdminsAsync(string title, string body, object? data = null, CancellationToken ct = default);
}

public sealed class UserNotificationService : IUserNotificationService
{
    // Les controllers appellent fréquemment `_ = _notify.X(...)` (fire-and-forget) pour ne pas
    // bloquer la réponse HTTP. Or le DbContext et le push service sont tous deux scoped à la
    // requête : sans nouveau scope, l'INSERT et le HTTP push s'exécutent contre des objets
    // disposés et échouent silencieusement → bell vide en prod. On ouvre donc un scope dédié
    // pour chaque envoi : self-contained, indépendant du cycle de vie de la requête appelante.
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<UserNotificationService> _log;

    public UserNotificationService(IServiceScopeFactory scopeFactory, ILogger<UserNotificationService> log)
    {
        _scopeFactory = scopeFactory;
        _log = log;
    }

    public Task<int> NotifyUserAsync(string uticod, string title, string body, object? data = null, CancellationToken ct = default)
        => RunInScopeAsync((db, push) => SendToUsersAsync(db, push, new[] { uticod }, title, body, data, ct));

    public Task<int> NotifyManagersAsync(string title, string body, object? data = null, CancellationToken ct = default)
        => RunInScopeAsync(async (db, push) =>
        {
            var managerCode = PermissionCatalog.Roles.Manager;
            var adminCode = PermissionCatalog.Roles.Administrator;
            // Sémantiquement, cette méthode notifie « ceux qui peuvent valider » — pas
            // littéralement le rôle Manager. L'admin du tenant (Utiadm=1 ou Utirole=Administrator)
            // a évidemment les droits de validation, et c'est souvent la seule personne
            // active dans les petits comptes (TPE/PME qui démarrent). Avant ce fix, son
            // centre de notifications restait vide même quand des employés créaient des
            // demandes de congé/autorisation — bug observé en prod.
            //
            // ⚠ Filtre Utiactif assoupli : avant on testait `== "1"`, ce qui éliminait
            // silencieusement tous les utilisateurs créés via les anciens imports (valeur
            // legacy "Oui", cf. UtilisateurRepository.ToggleUtiactif) ou sans valeur saisie
            // (NULL). Résultat observé : aucune notif n'arrivait aux managers d'un tenant
            // hérité d'un dump legacy. On considère désormais ACTIF tout sauf "0" / "Non".
            // PG : LIKE est case-sensitive. Sur SQL Server (French_CI_AS) LIKE '%manager%'
            // matchait "Manager"/"MANAGER" ; sur Postgres on doit utiliser ILIKE pour la
            // même sémantique. ILIKE est une extension PG fournie par Npgsql.
            var uticods = await db.Utilisateurs
                .AsNoTracking()
                .Where(u => (u.Utiactif == null || (u.Utiactif != "0" && u.Utiactif != "Non")) &&
                            (u.Utirole == managerCode ||
                             (u.Utirole != null && EF.Functions.ILike(u.Utirole, "%manager%")) ||
                             u.Utiadm == "1" ||
                             u.Utirole == adminCode))
                .Select(u => u.Uticod!)
                .ToListAsync(ct);
            return await SendToUsersAsync(db, push, uticods, title, body, data, ct);
        });

    public Task<int> NotifyAdminsAsync(string title, string body, object? data = null, CancellationToken ct = default)
        => RunInScopeAsync(async (db, push) =>
        {
            var adminCode = PermissionCatalog.Roles.Administrator;
            // Idem (cf. NotifyManagersAsync) : Utiactif tolère "1", "Oui" et NULL.
            var uticods = await db.Utilisateurs
                .AsNoTracking()
                .Where(u => (u.Utiactif == null || (u.Utiactif != "0" && u.Utiactif != "Non")) &&
                            (u.Utiadm == "1" || u.Utirole == adminCode))
                .Select(u => u.Uticod!)
                .ToListAsync(ct);
            return await SendToUsersAsync(db, push, uticods, title, body, data, ct);
        });

    private async Task<int> RunInScopeAsync(Func<ApplicationDbContext, IExpoPushService, Task<int>> work)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var push = scope.ServiceProvider.GetRequiredService<IExpoPushService>();
            return await work(db, push);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Notification dispatch failed (silently swallowed).");
            return 0;
        }
    }

    private async Task<int> SendToUsersAsync(ApplicationDbContext _db, IExpoPushService _push, IEnumerable<string> uticods, string title, string body, object? data, CancellationToken ct)
    {
        var allRecipients = uticods.Where(c => !string.IsNullOrEmpty(c)).Distinct().ToList();
        if (allRecipients.Count == 0) return 0;

        var category = ExtractCategory(data);

        // 1. Filtre par préférences utilisateur. Convention : absence de ligne = activé (opt-in).
        //    Push et in-app sont 2 canaux indépendants : un user peut couper le push mais garder
        //    l'historique consultable dans le centre.
        var inappRecipients = allRecipients;
        var pushRecipients = allRecipients;
        if (!string.IsNullOrEmpty(category))
        {
            var prefs = await _db.NotificationPreferences
                .AsNoTracking()
                .Where(p => p.Category == category && allRecipients.Contains(p.Uticod))
                .Select(p => new { p.Uticod, p.Enabled, p.PushEnabled, p.InappEnabled })
                .ToListAsync(ct);
            if (prefs.Count > 0)
            {
                var inappBlocked = new HashSet<string>(
                    prefs.Where(p => !p.Enabled || !p.InappEnabled).Select(p => p.Uticod),
                    StringComparer.OrdinalIgnoreCase);
                var pushBlocked = new HashSet<string>(
                    prefs.Where(p => !p.Enabled || !p.PushEnabled).Select(p => p.Uticod),
                    StringComparer.OrdinalIgnoreCase);
                inappRecipients = allRecipients.Where(u => !inappBlocked.Contains(u)).ToList();
                pushRecipients = allRecipients.Where(u => !pushBlocked.Contains(u)).ToList();
            }
        }
        if (inappRecipients.Count == 0 && pushRecipients.Count == 0) return 0;

        // 2. Persiste une row Notification par destinataire qui a le canal in-app activé.
        try
        {
            var json = data != null ? JsonSerializer.Serialize(data) : null;
            foreach (var uticod in inappRecipients)
            {
                _db.Notifications.Add(new Notification
                {
                    Uticod = uticod,
                    Title = Truncate(title, 150),
                    Body = Truncate(body, 500),
                    Category = category,
                    DataJson = json,
                    CreatedAt = DateTime.UtcNow,
                });
            }
            if (inappRecipients.Count > 0) await _db.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Notification history persistence failed (continuing with push).");
        }

        // 3. Filtre les heures silencieuses (mode manual ou auto_poste) via QuietHoursResolver.
        //    L'in-app reste préservé (l'utilisateur retrouve la notif au matin dans son centre).
        if (pushRecipients.Count > 0)
        {
            var now = DateTime.Now; // TZ Europe/Paris (cf. Program.cs)
            var resolver = new QuietHoursResolver(_db);
            var muted = new List<string>();
            foreach (var user in pushRecipients)
            {
                var state = await resolver.EvaluateAsync(user, now, ct);
                if (state.IsSilent) muted.Add(user);
            }
            if (muted.Count > 0)
            {
                var mutedSet = new HashSet<string>(muted, StringComparer.OrdinalIgnoreCase);
                pushRecipients = pushRecipients.Where(u => !mutedSet.Contains(u)).ToList();
            }
        }
        if (pushRecipients.Count == 0) return 0;

        var tokens = await _db.PushTokens
            .Where(t => t.Active && pushRecipients.Contains(t.Uticod))
            .Select(t => t.Token)
            .ToListAsync(ct);
        if (tokens.Count == 0) return 0;

        try
        {
            var messages = tokens.Select(tok => new ExpoPushMessage(tok, title, body, data));
            var result = await _push.SendAsync(messages, ct);

            if (result.InvalidTokens.Count > 0)
            {
                var stale = await _db.PushTokens
                    .Where(t => result.InvalidTokens.Contains(t.Token))
                    .ToListAsync(ct);
                foreach (var t in stale) t.Active = false;
                await _db.SaveChangesAsync(ct);
            }
            return result.Sent;
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Push notification failed (silently swallowed) — users={Count}", pushRecipients.Count);
            return 0;
        }
    }

    private static string? ExtractCategory(object? data)
    {
        if (data is null) return null;
        // Convention : tous nos hooks émettent un champ `type` dans le payload data.
        var json = JsonSerializer.SerializeToElement(data);
        if (json.ValueKind == JsonValueKind.Object && json.TryGetProperty("type", out var t) && t.ValueKind == JsonValueKind.String)
            return t.GetString();
        return null;
    }

    private static string Truncate(string? s, int max)
    {
        if (string.IsNullOrEmpty(s)) return string.Empty;
        return s.Length <= max ? s : s[..max];
    }

}
