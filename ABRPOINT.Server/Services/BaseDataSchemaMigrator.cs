using ABRPOINT.Server.Data;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Services;

/// <summary>
/// Migrations idempotentes "in place" pour les colonnes des données de base.
/// Aujourd'hui : élargit vilcod (2 → 6 chars) et villib (20 → 100 chars) pour
/// pouvoir importer les communes françaises (codes INSEE 5 chiffres + noms longs
/// comme "Saint-Remy-en-Bouzemont-Saint-Genest-et-Isson").
///
/// Comme MobileTablesInstaller, on évite EF migrations (pipeline existant) et on
/// garde du SQL plat pour rattraper les bases déjà déployées.
/// </summary>
public static class BaseDataSchemaMigrator
{
    public sealed record MigrationReport(bool VilcodExpanded, bool VillibExpanded, bool ParmodempAdded, bool CetColumnsAdded, bool SocvilleAdded, bool VilcodFkExpanded, bool MissionTableCreated, bool NoteDeFraisMissionIdAdded, bool RttColumnsAdded, bool RagTablesCreated, bool MissionDeviseAdded, bool NoteDeFraisDeviseAdded, bool SiteGeofenceAdded, bool RefreshTokenColumnsAdded);

    public static async Task<MigrationReport> MigrateAsync(ApplicationDbContext db, CancellationToken ct = default)
    {
        var vilcod = await ExpandColumnIfNeededAsync(db, "ville", "vilcod", "NVARCHAR(6) NOT NULL", currentMaxLen: 2, targetMaxLen: 6, ct);
        var villib = await ExpandColumnIfNeededAsync(db, "ville", "villib", "NVARCHAR(100) NULL", currentMaxLen: 20, targetMaxLen: 100, ct);
        var parmodemp = await AddColumnIfMissingAsync(db, "parametre", "parmodemp", "NVARCHAR(1) NULL", ct);
        // CET (Compte Épargne Temps) : 2 colonnes Parametre + 1 colonne Solde.
        var cetDate = await AddColumnIfMissingAsync(db, "parametre", "parcetdatelim", "NVARCHAR(5) NULL", ct);
        var cetMax = await AddColumnIfMissingAsync(db, "parametre", "parcetmaxjours", "REAL NULL", ct);
        var cetSolde = await AddColumnIfMissingAsync(db, "solde", "cetjours", "REAL NULL", ct);
        var cetAdded = cetDate || cetMax || cetSolde;
        // Société : ville séparée du numéro de rue (champ socadr existant).
        var socville = await AddColumnIfMissingAsync(db, "societe", "socville", "NVARCHAR(60) NULL", ct);
        // Tables enfants qui référencent ville.vilcod : la PK a été élargie à 6 chars,
        // les FKs étaient encore à 4 → toute sauvegarde d'employé avec un vilcod
        // auto-généré (6 chiffres) ou un code INSEE (5 chiffres) échouait.
        var vilFkEmploye = await ExpandColumnIfNeededAsync(db, "employe", "vilcod", "NVARCHAR(6) NULL", currentMaxLen: 4, targetMaxLen: 6, ct);
        var vilFkContrat = await ExpandColumnIfNeededAsync(db, "contrat", "vilcod", "NVARCHAR(6) NULL", currentMaxLen: 4, targetMaxLen: 6, ct);
        var vilFkContrat2 = await ExpandColumnIfNeededAsync(db, "contrat2", "vilcod", "NVARCHAR(6) NULL", currentMaxLen: 4, targetMaxLen: 6, ct);
        var vilFkEmpaff = await ExpandColumnIfNeededAsync(db, "empaff", "vilcod", "NVARCHAR(6) NULL", currentMaxLen: 4, targetMaxLen: 6, ct);
        var vilFkExpanded = vilFkEmploye || vilFkContrat || vilFkContrat2 || vilFkEmpaff;

        // mission : ancienne table keyless (colonnes Concod/Condat/... héritées d'une vue
        // legacy de conge) → on la remplace par la vraie table métier. Détection par la
        // présence de la colonne 'id' qui n'existe pas dans le legacy. Sans clients en prod,
        // on peut DROP+CREATE sans perte de données.
        var missionTable = await EnsureMissionTableAsync(db, ct);
        // NoteDeFrais.MissionId : ajouté en NULL pour ne pas casser les lignes existantes ;
        // côté contrôleur, on exige la valeur sur les nouvelles saisies. La migration ne
        // peut pas remplir rétroactivement les missions des notes déjà saisies.
        var nfMission = await AddColumnIfMissingAsync(db, "notedefrais", "missionid", "INT NULL", ct);

        // RTT (Réduction du Temps de Travail, loi française) :
        // 4 colonnes sur employe (config par employé) + 2 colonnes sur solde (droit annuel + consommé).
        // Toutes nullables : un tenant qui n'utilise pas le RTT garde son comportement actuel
        // (EmpRttMethode = NULL → traité comme 'N' / non éligible côté service).
        var rttMethode = await AddColumnIfMissingAsync(db, "employe", "emp_rtt_methode", "NVARCHAR(1) NULL", ct);
        var rttJoursA = await AddColumnIfMissingAsync(db, "employe", "emp_rtt_jours_annuel", "REAL NULL", ct);
        var rttHeuresC = await AddColumnIfMissingAsync(db, "employe", "emp_rtt_heures_contrat", "REAL NULL", ct);
        var rttForfait = await AddColumnIfMissingAsync(db, "employe", "emp_rtt_forfait_jours", "INT NULL", ct);
        var rttSoldeJ = await AddColumnIfMissingAsync(db, "solde", "rtt_jours", "REAL NULL", ct);
        var rttSoldeU = await AddColumnIfMissingAsync(db, "solde", "rtt_utilises", "REAL NULL", ct);
        var rttColumnsAdded = rttMethode || rttJoursA || rttHeuresC || rttForfait || rttSoldeJ || rttSoldeU;

        // RAG (Retrieval-Augmented Generation) : 3 tables créées d'un coup si la première
        // n'existe pas. Le sidecar Python parle directement à Qdrant ; ces tables ne servent
        // qu'à persister les métadonnées documents/templates et le journal d'audit RGPD.
        var ragDocsCreated = await EnsureRagDocumentTableAsync(db, ct);
        var ragLettersCreated = await EnsureRagLetterTemplateTableAsync(db, ct);
        var ragLogsCreated = await EnsureRagChatLogTableAsync(db, ct);
        var ragTablesCreated = ragDocsCreated || ragLettersCreated || ragLogsCreated;

        // Devise pour les missions et notes de frais (ISO 4217 — 3 caractères).
        // NULL = devise tenant par défaut côté client (rétrocompatible avec les
        // lignes existantes saisies sans choix de devise).
        var missionDevise = await AddColumnIfMissingAsync(db, "mission", "misdevise", "NVARCHAR(3) NULL", ct);
        var nfDevise = await AddColumnIfMissingAsync(db, "notedefrais", "devise", "NVARCHAR(3) NULL", ct);

        // Geofence : zone GPS autorisée par site. NULL = pas de geofence pour ce site.
        // L'admin/manager définit ces valeurs via le formulaire Filiale ; le validateur
        // serveur (GeoZoneValidator) refuse les pointages hors rayon dès qu'au moins un
        // site du tenant a les 3 colonnes renseignées.
        var siteGeoLat = await AddColumnIfMissingAsync(db, "site", "sitlat", "DECIMAL(10,7) NULL", ct);
        var siteGeoLon = await AddColumnIfMissingAsync(db, "site", "sitlon", "DECIMAL(10,7) NULL", ct);
        var siteGeoRad = await AddColumnIfMissingAsync(db, "site", "sitrad", "INT NULL", ct);
        var siteGeofenceAdded = siteGeoLat || siteGeoLon || siteGeoRad;

        // SEC-G2 / SEC-G6 — refresh_tokens : distingue les bio-tokens des refresh classiques
        // et trace l'usage récent pour appliquer un quota par utilisateur. NOT NULL avec DEFAULT
        // pour ne pas casser les lignes existantes.
        var rtPurpose = await AddColumnIfMissingAsync(db, "refresh_tokens", "purpose",
            "VARCHAR(20) NOT NULL CONSTRAINT [DF_refresh_tokens_purpose] DEFAULT ('Refresh')", ct);
        var rtLastUsed = await AddColumnIfMissingAsync(db, "refresh_tokens", "last_used_at", "DATETIME2 NULL", ct);
        var rtIndex = await EnsureIndexAsync(db, "refresh_tokens", "ix_refresh_tokens_uticod_purpose_revoked",
            "(uticod, purpose, revoked) INCLUDE (expires_at, last_used_at)", ct);
        var refreshTokenColumnsAdded = rtPurpose || rtLastUsed || rtIndex;

        return new MigrationReport(vilcod, villib, parmodemp, cetAdded, socville, vilFkExpanded, missionTable, nfMission, rttColumnsAdded, ragTablesCreated, missionDevise, nfDevise, siteGeofenceAdded, refreshTokenColumnsAdded);
    }

    private static async Task<bool> EnsureIndexAsync(ApplicationDbContext db, string table, string indexName, string columnsClause, CancellationToken ct)
    {
        if (!await TableExistsAsync(db, table, ct)) return false;
        var conn = db.Database.GetDbConnection();
        if (conn.State != System.Data.ConnectionState.Open) await conn.OpenAsync(ct);
        await using (var check = conn.CreateCommand())
        {
            check.CommandText = "SELECT COUNT(1) FROM sys.indexes WHERE name = @n AND object_id = OBJECT_ID(@t)";
            var pn = check.CreateParameter(); pn.ParameterName = "@n"; pn.Value = indexName; check.Parameters.Add(pn);
            var pt = check.CreateParameter(); pt.ParameterName = "@t"; pt.Value = table; check.Parameters.Add(pt);
            var exists = Convert.ToInt32(await check.ExecuteScalarAsync(ct)) > 0;
            if (exists) return false;
        }
        await db.Database.ExecuteSqlRawAsync($"CREATE NONCLUSTERED INDEX [{indexName}] ON [{table}] {columnsClause};", ct);
        return true;
    }

    private static async Task<bool> EnsureRagDocumentTableAsync(ApplicationDbContext db, CancellationToken ct)
    {
        if (await TableExistsAsync(db, "rag_document", ct)) return false;
        await db.Database.ExecuteSqlRawAsync(@"
CREATE TABLE [rag_document] (
    [id] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_rag_document] PRIMARY KEY,
    [soccod] NVARCHAR(6) NOT NULL,
    [filename] NVARCHAR(260) NOT NULL,
    [original_name] NVARCHAR(260) NOT NULL,
    [content_type] NVARCHAR(80) NOT NULL,
    [size_bytes] BIGINT NOT NULL,
    [category] NVARCHAR(20) NOT NULL CONSTRAINT [DF_rag_document_category] DEFAULT 'autre',
    [uploaded_by] NVARCHAR(20) NULL,
    [uploaded_at] DATETIME NOT NULL CONSTRAINT [DF_rag_document_uploaded_at] DEFAULT GETUTCDATE(),
    [status] NVARCHAR(12) NOT NULL CONSTRAINT [DF_rag_document_status] DEFAULT 'pending',
    [chunks_count] INT NULL,
    [error_message] NVARCHAR(500) NULL
);
CREATE INDEX [IX_rag_document_soccod_uploaded_at] ON [rag_document]([soccod], [uploaded_at] DESC);", ct);
        return true;
    }

    private static async Task<bool> EnsureRagLetterTemplateTableAsync(ApplicationDbContext db, CancellationToken ct)
    {
        if (await TableExistsAsync(db, "rag_letter_template", ct)) return false;
        await db.Database.ExecuteSqlRawAsync(@"
CREATE TABLE [rag_letter_template] (
    [id] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_rag_letter_template] PRIMARY KEY,
    [soccod] NVARCHAR(6) NOT NULL,
    [name] NVARCHAR(120) NOT NULL,
    [description] NVARCHAR(500) NULL,
    [body_html] NVARCHAR(MAX) NOT NULL,
    [placeholders_json] NVARCHAR(MAX) NULL,
    [category] NVARCHAR(20) NULL,
    [created_at] DATETIME NOT NULL CONSTRAINT [DF_rag_letter_template_created_at] DEFAULT GETUTCDATE(),
    [updated_at] DATETIME NULL
);
CREATE INDEX [IX_rag_letter_template_soccod_name] ON [rag_letter_template]([soccod], [name]);", ct);
        return true;
    }

    private static async Task<bool> EnsureRagChatLogTableAsync(ApplicationDbContext db, CancellationToken ct)
    {
        if (await TableExistsAsync(db, "rag_chat_log", ct)) return false;
        await db.Database.ExecuteSqlRawAsync(@"
CREATE TABLE [rag_chat_log] (
    [id] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_rag_chat_log] PRIMARY KEY,
    [soccod] NVARCHAR(6) NOT NULL,
    [uticod] NVARCHAR(20) NULL,
    [category] NVARCHAR(20) NOT NULL CONSTRAINT [DF_rag_chat_log_category] DEFAULT 'chat',
    [question] NVARCHAR(1000) NULL,
    [answer] NVARCHAR(MAX) NULL,
    [sources_json] NVARCHAR(MAX) NULL,
    [tokens_in] INT NULL,
    [tokens_out] INT NULL,
    [latency_ms] INT NULL,
    [created_at] DATETIME NOT NULL CONSTRAINT [DF_rag_chat_log_created_at] DEFAULT GETUTCDATE(),
    [feedback_score] TINYINT NULL,
    [feedback_comment] NVARCHAR(500) NULL
);
CREATE INDEX [IX_rag_chat_log_soccod_created_at] ON [rag_chat_log]([soccod], [created_at] DESC);", ct);
        return true;
    }

    private static async Task<bool> EnsureMissionTableAsync(ApplicationDbContext db, CancellationToken ct)
    {
        var tableExists = await TableExistsAsync(db, "mission", ct);
        var hasIdColumn = tableExists && await ColumnExistsAsync(db, "mission", "id", ct);
        // Si la table existe avec le bon schéma (colonne id), rien à faire.
        if (tableExists && hasIdColumn) return false;
        // Si la table existe mais sans 'id', c'est le legacy keyless — on le drop.
        if (tableExists)
            await db.Database.ExecuteSqlRawAsync("DROP TABLE [mission];", ct);

        await db.Database.ExecuteSqlRawAsync(@"
CREATE TABLE [mission] (
    [id] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_mission] PRIMARY KEY,
    [soccod] NVARCHAR(6) NOT NULL,
    [empcod] NVARCHAR(12) NOT NULL,
    [misobj] NVARCHAR(150) NOT NULL,
    [misdest] NVARCHAR(150) NULL,
    [misdatedeb] DATETIME NOT NULL,
    [misdatefin] DATETIME NOT NULL,
    [misnote] NVARCHAR(500) NULL,
    [misetat] NVARCHAR(20) NOT NULL CONSTRAINT [DF_mission_misetat] DEFAULT 'Pending',
    [misbudget] FLOAT NULL,
    [misdevise] NVARCHAR(3) NULL,
    [abscod] NVARCHAR(4) NOT NULL,
    [created_at] DATETIME NULL,
    [deleted_at] DATETIME NULL,
    [retention_date] DATETIME NULL
);
CREATE INDEX [IX_mission_soccod_empcod] ON [mission]([soccod], [empcod]);", ct);
        return true;
    }

    /// <summary>
    /// Ajoute une colonne à une table existante si elle n'y est pas encore. Idempotent : en cas
    /// d'absence de la table ou si la colonne existe déjà, ne fait rien et retourne false.
    /// </summary>
    private static async Task<bool> AddColumnIfMissingAsync(ApplicationDbContext db, string table, string column, string columnDef, CancellationToken ct)
    {
        if (!await TableExistsAsync(db, table, ct)) return false;
        if (await ColumnExistsAsync(db, table, column, ct)) return false;
        await db.Database.ExecuteSqlRawAsync($"ALTER TABLE [{table}] ADD [{column}] {columnDef};", ct);
        return true;
    }

    private static async Task<bool> ColumnExistsAsync(ApplicationDbContext db, string table, string column, CancellationToken ct)
    {
        var conn = db.Database.GetDbConnection();
        if (conn.State != System.Data.ConnectionState.Open) await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = @"SELECT COUNT(1) FROM sys.columns c JOIN sys.tables t ON c.object_id = t.object_id WHERE t.name = @t AND c.name = @c";
        var pT = cmd.CreateParameter(); pT.ParameterName = "@t"; pT.Value = table; cmd.Parameters.Add(pT);
        var pC = cmd.CreateParameter(); pC.ParameterName = "@c"; pC.Value = column; cmd.Parameters.Add(pC);
        var result = await cmd.ExecuteScalarAsync(ct);
        return Convert.ToInt32(result) > 0;
    }

    private static async Task<bool> ExpandColumnIfNeededAsync(
        ApplicationDbContext db,
        string table,
        string column,
        string newDefinition,
        int currentMaxLen,
        int targetMaxLen,
        CancellationToken ct)
    {
        if (!await TableExistsAsync(db, table, ct)) return false;
        var len = await GetColumnMaxLengthAsync(db, table, column, ct);
        // sys.columns max_length pour NVARCHAR = 2 * char_count ; -1 = MAX.
        var actualChars = len switch
        {
            -1 => int.MaxValue,
            > 0 => len / 2,
            _ => 0
        };
        if (actualChars >= targetMaxLen) return false;

        // Pour SQL Server : ALTER COLUMN ne casse pas une PK NVARCHAR(2) → NVARCHAR(6) tant qu'on garde NOT NULL.
        await db.Database.ExecuteSqlRawAsync($"ALTER TABLE [{table}] ALTER COLUMN [{column}] {newDefinition};", ct);
        return true;
    }

    private static async Task<bool> TableExistsAsync(ApplicationDbContext db, string tableName, CancellationToken ct)
    {
        var conn = db.Database.GetDbConnection();
        if (conn.State != System.Data.ConnectionState.Open) await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT COUNT(1) FROM sys.tables WHERE name = @name";
        var p = cmd.CreateParameter(); p.ParameterName = "@name"; p.Value = tableName; cmd.Parameters.Add(p);
        var result = await cmd.ExecuteScalarAsync(ct);
        return Convert.ToInt32(result) > 0;
    }

    private static async Task<int> GetColumnMaxLengthAsync(ApplicationDbContext db, string table, string column, CancellationToken ct)
    {
        var conn = db.Database.GetDbConnection();
        if (conn.State != System.Data.ConnectionState.Open) await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = @"SELECT c.max_length FROM sys.columns c JOIN sys.tables t ON c.object_id = t.object_id WHERE t.name = @t AND c.name = @c";
        var pT = cmd.CreateParameter(); pT.ParameterName = "@t"; pT.Value = table; cmd.Parameters.Add(pT);
        var pC = cmd.CreateParameter(); pC.ParameterName = "@c"; pC.Value = column; cmd.Parameters.Add(pC);
        var result = await cmd.ExecuteScalarAsync(ct);
        if (result == null || result == DBNull.Value) return 0;
        return Convert.ToInt32(result);
    }
}
