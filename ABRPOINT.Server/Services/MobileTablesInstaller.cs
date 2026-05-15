using ABRPOINT.Server.Data;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Services;

/// <summary>
/// Installe (idempotent) les tables nécessaires aux fonctionnalités mobiles : push_tokens,
/// push_reminder_log. Utilisé à la fois par le ProvisioningService (nouveaux tenants) et
/// par un endpoint admin de rattrapage pour les tenants existants.
///
/// Pas de migration EF Core : on garde des scripts SQL plats pour ne pas perturber le pipeline
/// de migrations existant et pouvoir rattraper les tenants déjà déployés sans intervention DBA.
/// </summary>
public static class MobileTablesInstaller
{
    public sealed record InstallReport(
        bool PushTokensCreated,
        bool PushReminderLogCreated,
        bool NotificationsCreated,
        bool NotificationPreferencesCreated,
        bool ChannelColumnsAdded,
        bool UserSettingsCreated,
        bool KnownDevicesCreated);

    public static async Task<InstallReport> InstallAsync(ApplicationDbContext db, CancellationToken ct = default)
    {
        var pushTokens = await EnsurePushTokensAsync(db, ct);
        var reminderLog = await EnsurePushReminderLogAsync(db, ct);
        var notifications = await EnsureNotificationsAsync(db, ct);
        var prefs = await EnsureNotificationPreferencesAsync(db, ct);
        // Migration en place pour les tenants ayant créé la table prefs avant le split push/inapp.
        var channels = await EnsurePreferenceChannelsAsync(db, ct);
        var settings = await EnsureUserSettingsAsync(db, ct);
        var knownDevices = await EnsureKnownDevicesAsync(db, ct);
        return new InstallReport(pushTokens, reminderLog, notifications, prefs, channels, settings, knownDevices);
    }

    /// <summary>
    /// Crée la table d'empreintes d'appareils connus utilisée pour l'alerte "connexion
    /// depuis un nouvel appareil". Aucune donnée brute (UA / IP complète) n'est stockée :
    /// seul un hash tronqué + un préfixe de réseau. Idempotent.
    /// </summary>
    private static async Task<bool> EnsureKnownDevicesAsync(ApplicationDbContext db, CancellationToken ct)
    {
        var existed = await TableExistsAsync(db, "known_devices", ct);
        if (existed) return false;
        await db.Database.ExecuteSqlRawAsync(@"
CREATE TABLE [known_devices] (
    [kd_id]         INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_known_devices] PRIMARY KEY,
    [uticod]        NVARCHAR(20)  NOT NULL,
    [ua_hash]       NVARCHAR(16)  NOT NULL,
    [ip_prefix]     NVARCHAR(40)  NOT NULL,
    [device_label]  NVARCHAR(150) NULL,
    [first_seen_at] DATETIME2     NOT NULL CONSTRAINT [DF_known_devices_first] DEFAULT (SYSUTCDATETIME()),
    [last_seen_at]  DATETIME2     NOT NULL CONSTRAINT [DF_known_devices_last]  DEFAULT (SYSUTCDATETIME())
);
CREATE UNIQUE INDEX [UX_known_devices_user_ua_ip] ON [known_devices]([uticod], [ua_hash], [ip_prefix]);
CREATE INDEX [IX_known_devices_uticod] ON [known_devices]([uticod]);
", ct);
        return true;
    }

    private static async Task<bool> EnsureUserSettingsAsync(ApplicationDbContext db, CancellationToken ct)
    {
        var existed = await TableExistsAsync(db, "notification_user_settings", ct);
        if (existed)
        {
            // Migration in-place : ajoute quiet_mode si absent (introduit après le 1er déploiement).
            var hasMode = await ColumnExistsAsync(db, "notification_user_settings", "quiet_mode", ct);
            if (!hasMode)
            {
                await db.Database.ExecuteSqlRawAsync(
                    "ALTER TABLE [notification_user_settings] ADD [quiet_mode] NVARCHAR(20) NOT NULL CONSTRAINT [DF_nus_quiet_mode] DEFAULT ('manual');", ct);
            }
            // BaseEntity attend created_at / deleted_at / retention_date sur toutes les entités —
            // ces colonnes étaient absentes du CREATE initial. On les ajoute en place pour les
            // bases déjà créées sans les casser.
            await EnsureBaseEntityColumnsAsync(db, "notification_user_settings", "nus", ct);
            return false;
        }
        await db.Database.ExecuteSqlRawAsync(@"
CREATE TABLE [notification_user_settings] (
    [uticod]        NVARCHAR(20) NOT NULL CONSTRAINT [PK_notification_user_settings] PRIMARY KEY,
    [quiet_enabled] BIT          NOT NULL CONSTRAINT [DF_nus_quiet_enabled] DEFAULT (0),
    [quiet_mode]    NVARCHAR(20) NOT NULL CONSTRAINT [DF_nus_quiet_mode]    DEFAULT ('manual'),
    [quiet_start]   NVARCHAR(5)  NOT NULL CONSTRAINT [DF_nus_quiet_start]   DEFAULT ('22:00'),
    [quiet_end]     NVARCHAR(5)  NOT NULL CONSTRAINT [DF_nus_quiet_end]     DEFAULT ('07:00'),
    [updated_at]    DATETIME2    NOT NULL CONSTRAINT [DF_nus_updated_at]    DEFAULT (SYSUTCDATETIME()),
    -- Colonnes héritées de BaseEntity. EF Core les attend sur chaque entité —
    -- on les ajoute ici pour éviter un crash sur SaveChanges.
    [created_at]    DATETIME     NULL,
    [deleted_at]    DATETIME     NULL,
    [retention_date] DATETIME    NULL,
    [created_at_audit] DATETIME2 NULL,
    [updated_at_audit] DATETIME2 NULL,
    [deleted_at_audit] DATETIME2 NULL
);
", ct);
        return true;
    }

    /// <summary>
    /// Ajoute idempotemment les 3 colonnes BaseEntity (created_at, deleted_at, retention_date)
    /// si elles ne sont pas présentes. Utilisé pour rattraper les tables créées avant que
    /// BaseEntity ne soit appliqué partout.
    /// </summary>
    private static async Task EnsureBaseEntityColumnsAsync(ApplicationDbContext db, string table, string prefix, CancellationToken ct)
    {
        if (!await ColumnExistsAsync(db, table, "created_at", ct))
            await db.Database.ExecuteSqlRawAsync($"ALTER TABLE [{table}] ADD [created_at] DATETIME NULL;", ct);
        if (!await ColumnExistsAsync(db, table, "deleted_at", ct))
            await db.Database.ExecuteSqlRawAsync($"ALTER TABLE [{table}] ADD [deleted_at] DATETIME NULL;", ct);
        if (!await ColumnExistsAsync(db, table, "retention_date", ct))
            await db.Database.ExecuteSqlRawAsync($"ALTER TABLE [{table}] ADD [retention_date] DATETIME NULL;", ct);
        _ = prefix; // réservé pour une future contrainte DEFAULT nommée si nécessaire
    }

    /// <summary>
    /// Ajoute idempotemment les colonnes push_enabled / inapp_enabled à notification_preferences
    /// si elles n'existent pas (migration en place pour les tenants déjà créés avec la 1ère version).
    /// </summary>
    private static async Task<bool> EnsurePreferenceChannelsAsync(ApplicationDbContext db, CancellationToken ct)
    {
        var pushExists = await ColumnExistsAsync(db, "notification_preferences", "push_enabled", ct);
        var inappExists = await ColumnExistsAsync(db, "notification_preferences", "inapp_enabled", ct);
        if (pushExists && inappExists) return false;

        if (!pushExists)
        {
            await db.Database.ExecuteSqlRawAsync(
                "ALTER TABLE [notification_preferences] ADD [push_enabled] BIT NOT NULL CONSTRAINT [DF_np_push_enabled] DEFAULT (1);", ct);
        }
        if (!inappExists)
        {
            await db.Database.ExecuteSqlRawAsync(
                "ALTER TABLE [notification_preferences] ADD [inapp_enabled] BIT NOT NULL CONSTRAINT [DF_np_inapp_enabled] DEFAULT (1);", ct);
        }
        // Aligne les nouvelles colonnes avec l'ancien master switch : si enabled=0 → push=0 et inapp=0.
        await db.Database.ExecuteSqlRawAsync(
            "UPDATE [notification_preferences] SET [push_enabled] = 0, [inapp_enabled] = 0 WHERE [enabled] = 0;", ct);
        return true;
    }

    private static async Task<bool> ColumnExistsAsync(ApplicationDbContext db, string tableName, string columnName, CancellationToken ct)
    {
        var conn = db.Database.GetDbConnection();
        if (conn.State != System.Data.ConnectionState.Open) await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT COUNT(1) FROM sys.columns c JOIN sys.tables t ON c.object_id = t.object_id WHERE t.name = @t AND c.name = @c";
        var pT = cmd.CreateParameter(); pT.ParameterName = "@t"; pT.Value = tableName; cmd.Parameters.Add(pT);
        var pC = cmd.CreateParameter(); pC.ParameterName = "@c"; pC.Value = columnName; cmd.Parameters.Add(pC);
        var result = await cmd.ExecuteScalarAsync(ct);
        return Convert.ToInt32(result) > 0;
    }

    private static async Task<bool> EnsureNotificationPreferencesAsync(ApplicationDbContext db, CancellationToken ct)
    {
        var existed = await TableExistsAsync(db, "notification_preferences", ct);
        if (existed)
        {
            // Rattrapage pour les tenants déployés avant l'ajout des colonnes BaseEntity.
            await EnsureBaseEntityColumnsAsync(db, "notification_preferences", "np", ct);
            return false;
        }
        await db.Database.ExecuteSqlRawAsync(@"
CREATE TABLE [notification_preferences] (
    [np_id]         INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_notification_preferences] PRIMARY KEY,
    [uticod]        NVARCHAR(20) NOT NULL,
    [category]      NVARCHAR(50) NOT NULL,
    [enabled]       BIT          NOT NULL CONSTRAINT [DF_np_enabled] DEFAULT (1),
    [push_enabled]  BIT          NOT NULL CONSTRAINT [DF_np_push_enabled] DEFAULT (1),
    [inapp_enabled] BIT          NOT NULL CONSTRAINT [DF_np_inapp_enabled] DEFAULT (1),
    [updated_at]    DATETIME2    NOT NULL CONSTRAINT [DF_np_updated_at] DEFAULT (SYSUTCDATETIME()),
    -- Colonnes héritées de BaseEntity (EF Core les attend sur chaque entité).
    [created_at]    DATETIME     NULL,
    [deleted_at]    DATETIME     NULL,
    [retention_date] DATETIME    NULL,
    [created_at_audit] DATETIME2 NULL,
    [updated_at_audit] DATETIME2 NULL,
    [deleted_at_audit] DATETIME2 NULL
);
CREATE UNIQUE INDEX [UX_np_user_category] ON [notification_preferences]([uticod], [category]);
", ct);
        return true;
    }

    private static async Task<bool> EnsureNotificationsAsync(ApplicationDbContext db, CancellationToken ct)
    {
        var existed = await TableExistsAsync(db, "notifications", ct);
        if (existed) return false;
        await db.Database.ExecuteSqlRawAsync(@"
CREATE TABLE [notifications] (
    [notif_id]   INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_notifications] PRIMARY KEY,
    [uticod]     NVARCHAR(20)  NOT NULL,
    [soccod]     NVARCHAR(15)  NULL,
    [title]      NVARCHAR(150) NOT NULL,
    [body]       NVARCHAR(500) NOT NULL,
    [category]   NVARCHAR(50)  NULL,
    [data_json]  NVARCHAR(MAX) NULL,
    [read_at]    DATETIME2     NULL,
    [created_at] DATETIME2     NOT NULL CONSTRAINT [DF_notifications_created] DEFAULT (SYSUTCDATETIME()),
    [deleted_at] DATETIME2     NULL,
    [created_at_audit] DATETIME2 NULL,
    [updated_at_audit] DATETIME2 NULL,
    [deleted_at_audit] DATETIME2 NULL
);
CREATE INDEX [IX_notifications_uticod_created] ON [notifications]([uticod], [created_at] DESC);
CREATE INDEX [IX_notifications_uticod_read] ON [notifications]([uticod]) WHERE [read_at] IS NULL;
", ct);
        return true;
    }

    private static async Task<bool> EnsurePushTokensAsync(ApplicationDbContext db, CancellationToken ct)
    {
        var existed = await TableExistsAsync(db, "push_tokens", ct);
        if (existed)
        {
            // Tenants déployés avant l'application de BaseEntity à PushToken : la table
            // n'a ni deleted_at ni retention_date, et EF Core ajoute toujours le filtre
            // global "WHERE deleted_at IS NULL" → SQL Server renvoie 207 (Invalid column
            // name) et toutes les notifications cassent (`/api/roles/test-push/...` ainsi
            // que l'envoi automatique sur acceptation/refus de demandes).
            await EnsureBaseEntityColumnsAsync(db, "push_tokens", "pt", ct);
            return false;
        }
        await db.Database.ExecuteSqlRawAsync(@"
CREATE TABLE [push_tokens] (
    [pt_id]        INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_push_tokens] PRIMARY KEY,
    [uticod]       NVARCHAR(20)  NOT NULL,
    [soccod]       NVARCHAR(15)  NULL,
    [token]        NVARCHAR(200) NOT NULL,
    [platform]     NVARCHAR(20)  NULL,
    [device_id]    NVARCHAR(100) NULL,
    [created_at]   DATETIME2     NOT NULL CONSTRAINT [DF_push_tokens_created]   DEFAULT (SYSUTCDATETIME()),
    [last_seen_at] DATETIME2     NOT NULL CONSTRAINT [DF_push_tokens_last_seen] DEFAULT (SYSUTCDATETIME()),
    [active]       BIT           NOT NULL CONSTRAINT [DF_push_tokens_active]    DEFAULT (1),
    -- Colonnes héritées de BaseEntity (EF Core les attend pour le filtre global soft-delete).
    [deleted_at]   DATETIME      NULL,
    [retention_date] DATETIME    NULL,
    [created_at_audit] DATETIME2 NULL,
    [updated_at_audit] DATETIME2 NULL,
    [deleted_at_audit] DATETIME2 NULL
);
CREATE INDEX [IX_push_tokens_uticod] ON [push_tokens]([uticod]);
CREATE UNIQUE INDEX [UX_push_tokens_token] ON [push_tokens]([token]);
", ct);
        return true;
    }

    private static async Task<bool> EnsurePushReminderLogAsync(ApplicationDbContext db, CancellationToken ct)
    {
        var existed = await TableExistsAsync(db, "push_reminder_log", ct);
        if (existed)
        {
            // Même rattrapage que push_tokens : PushReminderLog hérite aussi de BaseEntity.
            await EnsureBaseEntityColumnsAsync(db, "push_reminder_log", "prl", ct);
            return false;
        }
        await db.Database.ExecuteSqlRawAsync(@"
CREATE TABLE [push_reminder_log] (
    [prl_id]   INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_push_reminder_log] PRIMARY KEY,
    [empcod]   NVARCHAR(20) NOT NULL,
    [soccod]   NVARCHAR(15) NULL,
    [type]     NVARCHAR(10) NOT NULL,
    [for_date] DATETIME2    NOT NULL,
    [sent_at]  DATETIME2    NOT NULL CONSTRAINT [DF_push_reminder_log_sent_at] DEFAULT (SYSUTCDATETIME()),
    -- Colonnes BaseEntity, cf. commentaire dans push_tokens.
    [created_at] DATETIME   NULL,
    [deleted_at] DATETIME   NULL,
    [retention_date] DATETIME NULL,
    [created_at_audit] DATETIME2 NULL,
    [updated_at_audit] DATETIME2 NULL,
    [deleted_at_audit] DATETIME2 NULL
);
CREATE UNIQUE INDEX [UX_push_reminder_log] ON [push_reminder_log]([empcod], [for_date], [type]);
", ct);
        return true;
    }

    private static async Task<bool> TableExistsAsync(ApplicationDbContext db, string tableName, CancellationToken ct)
    {
        var conn = db.Database.GetDbConnection();
        if (conn.State != System.Data.ConnectionState.Open) await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT COUNT(1) FROM sys.tables WHERE name = @name";
        var p = cmd.CreateParameter();
        p.ParameterName = "@name";
        p.Value = tableName;
        cmd.Parameters.Add(p);
        var result = await cmd.ExecuteScalarAsync(ct);
        return Convert.ToInt32(result) > 0;
    }
}
