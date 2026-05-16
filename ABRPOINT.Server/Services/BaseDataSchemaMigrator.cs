using ABRPOINT.Server.Data;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Services;

/// <summary>
/// Migrations idempotentes "in place" pour les colonnes des données de base.
/// Aujourd'hui : élargit vilcod (2 → 6 chars) et villib (20 → 100 chars) pour
/// pouvoir importer les communes françaises (codes INSEE 5 chiffres + noms longs
/// comme "Saint-Remy-en-Bouzemont-Saint-Genest-et-Isson"), plus une vingtaine
/// d'autres ADD COLUMN / CREATE TABLE / CREATE INDEX.
///
/// Migré SQL Server → PostgreSQL : on remplace les requêtes catalog sys.tables /
/// sys.columns / sys.indexes par leur équivalent portable information_schema.* /
/// pg_indexes, et on s'appuie au maximum sur ADD COLUMN IF NOT EXISTS /
/// CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS (natifs PG ≥ 9.6).
///
/// Comme MobileTablesInstaller, on évite EF migrations (pipeline existant) et on
/// garde du SQL plat pour rattraper les bases déjà déployées.
/// </summary>
public static class BaseDataSchemaMigrator
{
    public sealed record MigrationReport(bool VilcodExpanded, bool VillibExpanded, bool ParmodempAdded, bool CetColumnsAdded, bool SocvilleAdded, bool VilcodFkExpanded, bool MissionTableCreated, bool NoteDeFraisMissionIdAdded, bool RttColumnsAdded, bool RagTablesCreated, bool MissionDeviseAdded, bool NoteDeFraisDeviseAdded, bool SiteGeofenceAdded, bool RefreshTokenColumnsAdded);

    public static async Task<MigrationReport> MigrateAsync(ApplicationDbContext db, CancellationToken ct = default)
    {
        // Toutes les définitions de colonnes sont en syntaxe PostgreSQL :
        //   NVARCHAR(n) → VARCHAR(n) ; NVARCHAR(MAX) → TEXT ;
        //   DATETIME / DATETIME2 → TIMESTAMP ;
        //   INT → INTEGER ; FLOAT → DOUBLE PRECISION ; TINYINT → SMALLINT ;
        //   GETUTCDATE() → (NOW() AT TIME ZONE 'UTC').
        var vilcod = await ExpandColumnIfNeededAsync(db, "ville", "vilcod", "VARCHAR(6)", currentMaxLen: 2, targetMaxLen: 6, makeNotNull: true, ct);
        var villib = await ExpandColumnIfNeededAsync(db, "ville", "villib", "VARCHAR(100)", currentMaxLen: 20, targetMaxLen: 100, makeNotNull: false, ct);
        var parmodemp = await AddColumnIfMissingAsync(db, "parametre", "parmodemp", "VARCHAR(1) NULL", ct);
        // CET (Compte Épargne Temps) : 2 colonnes Parametre + 1 colonne Solde.
        var cetDate = await AddColumnIfMissingAsync(db, "parametre", "parcetdatelim", "VARCHAR(5) NULL", ct);
        var cetMax = await AddColumnIfMissingAsync(db, "parametre", "parcetmaxjours", "REAL NULL", ct);
        var cetSolde = await AddColumnIfMissingAsync(db, "solde", "cetjours", "REAL NULL", ct);
        var cetAdded = cetDate || cetMax || cetSolde;
        // Société : ville séparée du numéro de rue (champ socadr existant).
        var socville = await AddColumnIfMissingAsync(db, "societe", "socville", "VARCHAR(60) NULL", ct);
        // Société : logo (chemin /api/uploads/<uuid>.ext). Sans cette colonne, l'export
        // PDF des templates échoue en 500 dès qu'on tente le SELECT s.socimg dans
        // ReportsGenerationService.GenerateFromHtml. Migration silencieuse pour
        // rétrocompat des bases provisionnées avant l'introduction du champ.
        var socimg = await AddColumnIfMissingAsync(db, "societe", "socimg", "VARCHAR(500) NULL", ct);
        // Tables enfants qui référencent ville.vilcod : la PK a été élargie à 6 chars,
        // les FKs étaient encore à 4 → toute sauvegarde d'employé avec un vilcod
        // auto-généré (6 chiffres) ou un code INSEE (5 chiffres) échouait.
        var vilFkEmploye = await ExpandColumnIfNeededAsync(db, "employe", "vilcod", "VARCHAR(6)", currentMaxLen: 4, targetMaxLen: 6, makeNotNull: false, ct);
        var vilFkContrat = await ExpandColumnIfNeededAsync(db, "contrat", "vilcod", "VARCHAR(6)", currentMaxLen: 4, targetMaxLen: 6, makeNotNull: false, ct);
        var vilFkContrat2 = await ExpandColumnIfNeededAsync(db, "contrat2", "vilcod", "VARCHAR(6)", currentMaxLen: 4, targetMaxLen: 6, makeNotNull: false, ct);
        var vilFkEmpaff = await ExpandColumnIfNeededAsync(db, "empaff", "vilcod", "VARCHAR(6)", currentMaxLen: 4, targetMaxLen: 6, makeNotNull: false, ct);
        var vilFkExpanded = vilFkEmploye || vilFkContrat || vilFkContrat2 || vilFkEmpaff;

        // mission : ancienne table keyless (colonnes Concod/Condat/... héritées d'une vue
        // legacy de conge) → on la remplace par la vraie table métier. Détection par la
        // présence de la colonne 'id' qui n'existe pas dans le legacy. Sans clients en prod,
        // on peut DROP+CREATE sans perte de données.
        var missionTable = await EnsureMissionTableAsync(db, ct);
        // NoteDeFrais.MissionId : ajouté en NULL pour ne pas casser les lignes existantes ;
        // côté contrôleur, on exige la valeur sur les nouvelles saisies. La migration ne
        // peut pas remplir rétroactivement les missions des notes déjà saisies.
        var nfMission = await AddColumnIfMissingAsync(db, "notedefrais", "missionid", "INTEGER NULL", ct);

        // RTT (Réduction du Temps de Travail, loi française) :
        // 4 colonnes sur employe + 2 colonnes sur solde. Toutes nullables.
        var rttMethode = await AddColumnIfMissingAsync(db, "employe", "emp_rtt_methode", "VARCHAR(1) NULL", ct);
        var rttJoursA = await AddColumnIfMissingAsync(db, "employe", "emp_rtt_jours_annuel", "REAL NULL", ct);
        var rttHeuresC = await AddColumnIfMissingAsync(db, "employe", "emp_rtt_heures_contrat", "REAL NULL", ct);
        var rttForfait = await AddColumnIfMissingAsync(db, "employe", "emp_rtt_forfait_jours", "INTEGER NULL", ct);
        var rttSoldeJ = await AddColumnIfMissingAsync(db, "solde", "rtt_jours", "REAL NULL", ct);
        var rttSoldeU = await AddColumnIfMissingAsync(db, "solde", "rtt_utilises", "REAL NULL", ct);
        var rttColumnsAdded = rttMethode || rttJoursA || rttHeuresC || rttForfait || rttSoldeJ || rttSoldeU;

        // RAG (Retrieval-Augmented Generation) : 3 tables de métadonnées.
        var ragDocsCreated = await EnsureRagDocumentTableAsync(db, ct);
        var ragLettersCreated = await EnsureRagLetterTemplateTableAsync(db, ct);
        var ragLogsCreated = await EnsureRagChatLogTableAsync(db, ct);
        var ragTablesCreated = ragDocsCreated || ragLettersCreated || ragLogsCreated;

        // Devise pour les missions et notes de frais (ISO 4217 — 3 caractères).
        var missionDevise = await AddColumnIfMissingAsync(db, "mission", "misdevise", "VARCHAR(3) NULL", ct);
        var nfDevise = await AddColumnIfMissingAsync(db, "notedefrais", "devise", "VARCHAR(3) NULL", ct);

        // Geofence : zone GPS autorisée par site.
        var siteGeoLat = await AddColumnIfMissingAsync(db, "site", "sitlat", "DECIMAL(10,7) NULL", ct);
        var siteGeoLon = await AddColumnIfMissingAsync(db, "site", "sitlon", "DECIMAL(10,7) NULL", ct);
        var siteGeoRad = await AddColumnIfMissingAsync(db, "site", "sitrad", "INTEGER NULL", ct);
        var siteGeofenceAdded = siteGeoLat || siteGeoLon || siteGeoRad;

        // SEC-G2 / SEC-G6 — refresh_tokens.
        var rtPurpose = await AddColumnIfMissingAsync(db, "refresh_tokens", "purpose",
            "VARCHAR(20) NOT NULL DEFAULT 'Refresh'", ct);
        var rtLastUsed = await AddColumnIfMissingAsync(db, "refresh_tokens", "last_used_at", "TIMESTAMP NULL", ct);
        var rtIndex = await EnsureIndexAsync(db, "refresh_tokens", "ix_refresh_tokens_uticod_purpose_revoked",
            "(uticod, purpose, revoked) INCLUDE (expires_at, last_used_at)", ct);
        var refreshTokenColumnsAdded = rtPurpose || rtLastUsed || rtIndex;

        // Account lockout (2026-05) : verrouillage progressif après échecs de login répétés.
        await AddColumnIfMissingAsync(db, "utilisateur", "uti_failed_logins", "INTEGER NULL", ct);
        await AddColumnIfMissingAsync(db, "utilisateur", "uti_lockout_until", "TIMESTAMP NULL", ct);

        // Tables mobiles + notifications + known_devices : on délègue à MobileTablesInstaller
        // qui sait déjà créer push_tokens, notifications, notification_preferences,
        // notification_user_settings, known_devices.
        await MobileTablesInstaller.InstallAsync(db, ct);

        // Seed nations : sans données, le sélecteur "Nationalité" / "Pays" reste vide.
        await SeedNationsIfEmptyAsync(db, ct);

        // PERF — Indexes critiques sur les hot-paths.
        await EnsurePerformanceIndexesAsync(db, ct);

        return new MigrationReport(vilcod, villib, parmodemp, cetAdded, socville, vilFkExpanded, missionTable, nfMission, rttColumnsAdded, ragTablesCreated, missionDevise, nfDevise, siteGeofenceAdded, refreshTokenColumnsAdded);
    }

    /// <summary>
    /// PERF — Crée les index identifiés par l'audit performance, si absents.
    /// CREATE INDEX IF NOT EXISTS est natif depuis PG 9.5, donc plus besoin de
    /// vérifier dans pg_indexes manuellement. INCLUDE (cols...) supporté depuis PG 11.
    /// </summary>
    private static async Task EnsurePerformanceIndexesAsync(ApplicationDbContext db, CancellationToken ct)
    {
        var indexes = new (string Table, string CreateSql)[]
        {
            ("presence",
                "CREATE INDEX IF NOT EXISTS ix_presence_soccod_predat ON presence (soccod, predat) INCLUDE (empcod, preentmatup, presortmatup, preentamidiup, presortamidiup, tothre, tothsup, tothabs);"),
            ("presence",
                "CREATE INDEX IF NOT EXISTS ix_presence_empcod_predat ON presence (empcod, predat DESC);"),
            ("notification",
                "CREATE INDEX IF NOT EXISTS ix_notification_uticod_isread ON notification (uticod, isread) INCLUDE (createdat, title, category);"),
            ("documentvault",
                "CREATE INDEX IF NOT EXISTS ix_documentvault_soccod_empcod_docdate ON documentvault (soccod, empcod, docdate DESC) INCLUDE (docname, doctype, docsize, issigned, status);"),
            ("demconge",
                "CREATE INDEX IF NOT EXISTS ix_demconge_soccod_condg ON demconge (soccod, condg) INCLUDE (empcod, condep, conret, condat);"),
            ("pushtoken",
                "CREATE INDEX IF NOT EXISTS ix_pushtoken_uticod_active ON pushtoken (uticod, active) INCLUDE (token);"),
            ("employe",
                "CREATE INDEX IF NOT EXISTS ix_employe_soccod_empetat ON employe (soccod, empetat) INCLUDE (empcod, empmat, emplib, sercod, secncod, dircod, sitcod);"),
            ("demandeautorisation",
                "CREATE INDEX IF NOT EXISTS ix_demandeautorisation_soccod_statut ON demandeautorisation (soccod, statut) INCLUDE (empcod, condep, conret, abscod);"),
            ("auditlog",
                "CREATE INDEX IF NOT EXISTS ix_auditlog_uticod_createdat ON auditlog (uticod, createdat DESC);"),
            // SEC — Refresh tokens : la rotation et le logout filtrent uticod + revoked + expires_at.
            ("refreshtokens",
                "CREATE INDEX IF NOT EXISTS ix_refresh_tokens_uticod_revoked_expires ON refreshtokens (uticod, revoked, expiresat);"),
        };

        foreach (var (table, createSql) in indexes)
        {
            try
            {
                if (!await TableExistsAsync(db, table, ct)) continue;
                await db.Database.ExecuteSqlRawAsync(createSql, ct);
            }
            catch
            {
                // Best-effort : on n'interrompt jamais l'app pour un index manquant.
                // Le scan complet reste fonctionnel ; on retentera au prochain boot.
            }
        }
    }

    /// <summary>
    /// Insère une liste minimale de pays (ISO 3166-1 alpha-3, libellé FR) si la table
    /// est vide. Cibles commerciales en priorité : France, Belgique, Maghreb,
    /// Afrique francophone. Idempotent — un INSERT n'est tenté que si COUNT = 0.
    /// </summary>
    private static async Task SeedNationsIfEmptyAsync(ApplicationDbContext db, CancellationToken ct)
    {
        if (!await TableExistsAsync(db, "nation", ct)) return;

        var conn = db.Database.GetDbConnection();
        if (conn.State != System.Data.ConnectionState.Open) await conn.OpenAsync(ct);

        await using (var count = conn.CreateCommand())
        {
            count.CommandText = "SELECT COUNT(1) FROM nation";
            var n = Convert.ToInt32(await count.ExecuteScalarAsync(ct));
            if (n > 0) return; // déjà initialisé → on ne touche pas (laisse l'admin gérer)
        }

        // Liste compacte couvrant les marchés cibles. Libellés ≤ 20 chars (contrainte
        // Natlib StringLength=20). Pour étendre, l'admin passe par DonneesDeBase/Pays.
        var nations = new (string Code, string Label)[]
        {
            ("FRA", "France"), ("BEL", "Belgique"), ("CHE", "Suisse"), ("LUX", "Luxembourg"), ("MCO", "Monaco"),
            ("ESP", "Espagne"), ("ITA", "Italie"), ("DEU", "Allemagne"), ("PRT", "Portugal"), ("GBR", "Royaume-Uni"),
            ("NLD", "Pays-Bas"), ("USA", "États-Unis"), ("CAN", "Canada"), ("MAR", "Maroc"), ("DZA", "Algérie"),
            ("TUN", "Tunisie"), ("EGY", "Égypte"), ("SEN", "Sénégal"), ("CIV", "Côte d'Ivoire"), ("CMR", "Cameroun"),
            ("GAB", "Gabon"), ("MLI", "Mali"), ("BFA", "Burkina Faso"), ("NER", "Niger"), ("TCD", "Tchad"),
            ("COG", "Congo"), ("COD", "RD Congo"), ("MDG", "Madagascar"), ("MUS", "Maurice"), ("BEN", "Bénin"),
            ("TGO", "Togo"), ("GIN", "Guinée"), ("MRT", "Mauritanie"), ("LBN", "Liban"), ("TUR", "Turquie"),
            ("CHN", "Chine"), ("JPN", "Japon"), ("IND", "Inde"), ("BRA", "Brésil"), ("ARG", "Argentine"),
        };

        await using var insert = conn.CreateCommand();
        // Postgres accepte le INSERT INTO ... VALUES (...), (...) multi-row : 1 round-trip,
        // pas de transaction explicite nécessaire (seed idempotent).
        var values = string.Join(",", Enumerable.Range(0, nations.Length).Select(i => $"(@c{i}, @l{i})"));
        insert.CommandText = $"INSERT INTO nation (natcod, natlib) VALUES {values}";
        for (int i = 0; i < nations.Length; i++)
        {
            var pc = insert.CreateParameter(); pc.ParameterName = $"@c{i}"; pc.Value = nations[i].Code; insert.Parameters.Add(pc);
            var pl = insert.CreateParameter(); pl.ParameterName = $"@l{i}"; pl.Value = nations[i].Label; insert.Parameters.Add(pl);
        }
        await insert.ExecuteNonQueryAsync(ct);
    }

    /// <summary>
    /// Crée un index s'il n'existe pas. Utilise CREATE INDEX IF NOT EXISTS natif PG
    /// — pas besoin de lookup dans pg_indexes avant.
    /// </summary>
    private static async Task<bool> EnsureIndexAsync(ApplicationDbContext db, string table, string indexName, string columnsClause, CancellationToken ct)
    {
        if (!await TableExistsAsync(db, table, ct)) return false;
        try
        {
            await db.Database.ExecuteSqlRawAsync(
                $"CREATE INDEX IF NOT EXISTS {indexName} ON {table} {columnsClause};", ct);
            return true;
        }
        catch
        {
            return false;
        }
    }

    private static async Task<bool> EnsureRagDocumentTableAsync(ApplicationDbContext db, CancellationToken ct)
    {
        if (await TableExistsAsync(db, "rag_document", ct)) return false;
        await db.Database.ExecuteSqlRawAsync(@"
CREATE TABLE rag_document (
    id            INTEGER       GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    soccod        VARCHAR(6)    NOT NULL,
    filename      VARCHAR(260)  NOT NULL,
    original_name VARCHAR(260)  NOT NULL,
    content_type  VARCHAR(80)   NOT NULL,
    size_bytes    BIGINT        NOT NULL,
    category      VARCHAR(20)   NOT NULL DEFAULT 'autre',
    uploaded_by   VARCHAR(20)   NULL,
    uploaded_at   TIMESTAMP     NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    status        VARCHAR(12)   NOT NULL DEFAULT 'pending',
    chunks_count  INTEGER       NULL,
    error_message VARCHAR(500)  NULL
);
CREATE INDEX ix_rag_document_soccod_uploaded_at ON rag_document(soccod, uploaded_at DESC);", ct);
        return true;
    }

    private static async Task<bool> EnsureRagLetterTemplateTableAsync(ApplicationDbContext db, CancellationToken ct)
    {
        if (await TableExistsAsync(db, "rag_letter_template", ct)) return false;
        await db.Database.ExecuteSqlRawAsync(@"
CREATE TABLE rag_letter_template (
    id                INTEGER      GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    soccod            VARCHAR(6)   NOT NULL,
    name              VARCHAR(120) NOT NULL,
    description       VARCHAR(500) NULL,
    body_html         TEXT         NOT NULL,
    placeholders_json TEXT         NULL,
    category          VARCHAR(20)  NULL,
    created_at        TIMESTAMP    NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    updated_at        TIMESTAMP    NULL
);
CREATE INDEX ix_rag_letter_template_soccod_name ON rag_letter_template(soccod, name);", ct);
        return true;
    }

    private static async Task<bool> EnsureRagChatLogTableAsync(ApplicationDbContext db, CancellationToken ct)
    {
        if (await TableExistsAsync(db, "rag_chat_log", ct)) return false;
        await db.Database.ExecuteSqlRawAsync(@"
CREATE TABLE rag_chat_log (
    id               BIGINT        GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    soccod           VARCHAR(6)    NOT NULL,
    uticod           VARCHAR(20)   NULL,
    category         VARCHAR(20)   NOT NULL DEFAULT 'chat',
    question         VARCHAR(1000) NULL,
    answer           TEXT          NULL,
    sources_json     TEXT          NULL,
    tokens_in        INTEGER       NULL,
    tokens_out       INTEGER       NULL,
    latency_ms       INTEGER       NULL,
    created_at       TIMESTAMP     NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    feedback_score   SMALLINT      NULL,
    feedback_comment VARCHAR(500)  NULL
);
CREATE INDEX ix_rag_chat_log_soccod_created_at ON rag_chat_log(soccod, created_at DESC);", ct);
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
            await db.Database.ExecuteSqlRawAsync("DROP TABLE mission;", ct);

        await db.Database.ExecuteSqlRawAsync(@"
CREATE TABLE mission (
    id            INTEGER          GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    soccod        VARCHAR(6)       NOT NULL,
    empcod        VARCHAR(12)      NOT NULL,
    misobj        VARCHAR(150)     NOT NULL,
    misdest       VARCHAR(150)     NULL,
    misdatedeb    TIMESTAMP        NOT NULL,
    misdatefin    TIMESTAMP        NOT NULL,
    misnote       VARCHAR(500)     NULL,
    misetat       VARCHAR(20)      NOT NULL DEFAULT 'Pending',
    misbudget     DOUBLE PRECISION NULL,
    misdevise     VARCHAR(3)       NULL,
    abscod        VARCHAR(4)       NOT NULL,
    created_at    TIMESTAMP        NULL,
    deleted_at    TIMESTAMP        NULL,
    retention_date TIMESTAMP       NULL
);
CREATE INDEX ix_mission_soccod_empcod ON mission(soccod, empcod);", ct);
        return true;
    }

    /// <summary>
    /// Ajoute une colonne à une table existante si elle n'y est pas encore. Idempotent.
    /// Postgres supporte ADD COLUMN IF NOT EXISTS natif depuis 9.6, donc plus besoin de
    /// vérifier dans information_schema.columns avant.
    /// </summary>
    private static async Task<bool> AddColumnIfMissingAsync(ApplicationDbContext db, string table, string column, string columnDef, CancellationToken ct)
    {
        if (!await TableExistsAsync(db, table, ct)) return false;
        // Lookup explicite pour pouvoir retourner true/false (ADD COLUMN IF NOT EXISTS ne
        // dit pas si quelque chose a été ajouté, seulement qu'il n'a pas crashé).
        if (await ColumnExistsAsync(db, table, column, ct)) return false;
        await db.Database.ExecuteSqlRawAsync($"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {column} {columnDef};", ct);
        return true;
    }

    /// <summary>
    /// Lookup colonne via information_schema (équivalent portable de sys.columns).
    /// Postgres folde les identifiants non-quoted en lowercase — on suppose ici que
    /// table_name et column_name sont déjà en lowercase (ce qui est le cas pour tout
    /// le schéma legacy).
    /// </summary>
    private static async Task<bool> ColumnExistsAsync(ApplicationDbContext db, string table, string column, CancellationToken ct)
    {
        var conn = db.Database.GetDbConnection();
        if (conn.State != System.Data.ConnectionState.Open) await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = @"SELECT COUNT(1) FROM information_schema.columns
                            WHERE table_schema = current_schema()
                              AND table_name   = @t
                              AND column_name  = @c";
        var pT = cmd.CreateParameter(); pT.ParameterName = "@t"; pT.Value = table; cmd.Parameters.Add(pT);
        var pC = cmd.CreateParameter(); pC.ParameterName = "@c"; pC.Value = column; cmd.Parameters.Add(pC);
        var result = await cmd.ExecuteScalarAsync(ct);
        return Convert.ToInt32(result) > 0;
    }

    /// <summary>
    /// Élargit une colonne VARCHAR(n) → VARCHAR(m) si m > n actuel. Postgres a une syntaxe
    /// ALTER COLUMN différente de SQL Server : "ALTER COLUMN col TYPE varchar(m)" sans la
    /// répétition de NOT NULL/NULL (on garde la nullabilité existante). makeNotNull est
    /// utilisé pour ajouter / retirer la contrainte NOT NULL séparément si besoin.
    /// </summary>
    private static async Task<bool> ExpandColumnIfNeededAsync(
        ApplicationDbContext db,
        string table,
        string column,
        string newType,
        int currentMaxLen,
        int targetMaxLen,
        bool makeNotNull,
        CancellationToken ct)
    {
        if (!await TableExistsAsync(db, table, ct)) return false;
        var len = await GetColumnMaxLengthAsync(db, table, column, ct);
        // information_schema.columns.character_maximum_length = NULL pour TEXT (assimilé
        // illimité), entier pour VARCHAR(n). 0 = colonne non-string ou introuvable.
        var actualChars = len ?? int.MaxValue;
        if (actualChars >= targetMaxLen) return false;

        // PG : ALTER COLUMN col TYPE x ; pas de USING nécessaire pour un VARCHAR plus long.
        await db.Database.ExecuteSqlRawAsync($"ALTER TABLE {table} ALTER COLUMN {column} TYPE {newType};", ct);
        // NOT NULL est géré séparément si demandé. PG : SET NOT NULL / DROP NOT NULL.
        if (makeNotNull)
        {
            try
            {
                await db.Database.ExecuteSqlRawAsync($"ALTER TABLE {table} ALTER COLUMN {column} SET NOT NULL;", ct);
            }
            catch { /* déjà NOT NULL ou échec silencieux — pas critique */ }
        }
        return true;
    }

    private static async Task<bool> TableExistsAsync(ApplicationDbContext db, string tableName, CancellationToken ct)
    {
        var conn = db.Database.GetDbConnection();
        if (conn.State != System.Data.ConnectionState.Open) await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = @"SELECT COUNT(1) FROM information_schema.tables
                            WHERE table_schema = current_schema()
                              AND table_name   = @name";
        var p = cmd.CreateParameter(); p.ParameterName = "@name"; p.Value = tableName; cmd.Parameters.Add(p);
        var result = await cmd.ExecuteScalarAsync(ct);
        return Convert.ToInt32(result) > 0;
    }

    /// <summary>
    /// Retourne la taille maximale d'une colonne VARCHAR / CHAR depuis information_schema,
    /// ou null si la colonne est TEXT (illimitée), n'existe pas, ou n'est pas string.
    /// </summary>
    private static async Task<int?> GetColumnMaxLengthAsync(ApplicationDbContext db, string table, string column, CancellationToken ct)
    {
        var conn = db.Database.GetDbConnection();
        if (conn.State != System.Data.ConnectionState.Open) await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = @"SELECT character_maximum_length FROM information_schema.columns
                            WHERE table_schema = current_schema()
                              AND table_name   = @t
                              AND column_name  = @c";
        var pT = cmd.CreateParameter(); pT.ParameterName = "@t"; pT.Value = table; cmd.Parameters.Add(pT);
        var pC = cmd.CreateParameter(); pC.ParameterName = "@c"; pC.Value = column; cmd.Parameters.Add(pC);
        var result = await cmd.ExecuteScalarAsync(ct);
        if (result == null || result == DBNull.Value) return null;
        return Convert.ToInt32(result);
    }
}
