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

    /// <summary>
    /// Isolation par étape. Une étape qui jette (FK legacy, lock, type incompatible
    /// propre à UN tenant) NE DOIT PAS interrompre les étapes idempotentes suivantes :
    /// sinon une seule DDL en échec laissait des colonnes ultérieures (ex.
    /// presence.preacc) absentes définitivement sur ce tenant → 42703 « column does not
    /// exist » à chaque requête. On logge et on continue.
    /// </summary>
    private static async Task<T> SafeStepAsync<T>(Func<Task<T>> step, T fallback, string label)
    {
        try { return await step(); }
        catch (Exception ex)
        {
            Console.Error.WriteLine(
                $"[BaseDataSchemaMigrator] étape « {label} » ignorée (échec non bloquant) : {ex.Message}");
            return fallback;
        }
    }

    private static Task SafeStepAsync(Func<Task> step, string label) =>
        SafeStepAsync<bool>(async () => { await step(); return true; }, false, label);

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
        // Alimentation du CET par le salarié (2026-05-30) :
        //   - parametre.parcetvalidation : '1'/null = les demandes d'alimentation exigent
        //     une validation RH/admin/manager ; '0' = application immédiate.
        //   - absence.abspeutcet : '1' = ce type de congé peut alimenter le CET.
        //   - absence.absmaxcet  : plafond de jours transférables vers le CET par an pour ce type.
        await AddColumnIfMissingAsync(db, "parametre", "parcetvalidation", "VARCHAR(1) NULL", ct);
        await AddColumnIfMissingAsync(db, "absence", "abspeutcet", "VARCHAR(1) NULL", ct);
        await AddColumnIfMissingAsync(db, "absence", "absmaxcet", "REAL NULL", ct);
        // absprendcet : "1" = prendre ce type de congé puise dans la réserve CET du salarié
        // (besoin 2). Drapeau dédié plutôt qu'une valeur Abscng (la valeur 'C' est déjà
        // utilisée pour « Complément Jour/Forfait »).
        await AddColumnIfMissingAsync(db, "absence", "absprendcet", "VARCHAR(1) NULL", ct);

        // Télétravail — politique société (2026-05-30) :
        //   - parttmaxsem : quota de jours de télétravail par semaine (0/null = pas de quota).
        //   - parttprevenance : délai de prévenance minimum en jours avant le début (0/null = aucun).
        // + éligibilité par salarié (emp_teletravail_eligible : "0" = non éligible ; null/"1" = éligible).
        await AddColumnIfMissingAsync(db, "parametre", "parttmaxsem", "REAL NULL", ct);
        await AddColumnIfMissingAsync(db, "parametre", "parttprevenance", "INTEGER NULL", ct);
        await AddColumnIfMissingAsync(db, "employe", "emp_teletravail_eligible", "VARCHAR(1) NULL", ct);
        // Télétravail — paie / indemnités (2026-05-30, axe E) :
        //   - parttindemnite : indemnité forfaitaire par jour télétravaillé (montant). 0/null = aucune.
        //   - parttneutralisetr : "1" = ne pas compter le ticket-restaurant / panier les jours TT.
        await AddColumnIfMissingAsync(db, "parametre", "parttindemnite", "REAL NULL", ct);
        await AddColumnIfMissingAsync(db, "parametre", "parttneutralisetr", "VARCHAR(1) NULL", ct);
        // Mode heures sup (2026-06) : "A" = calcul automatique ; null/"V" = sur demande
        // + validation (défaut historique). Lu par HeuresSupplementaireHebdomadaireService.
        await AddColumnIfMissingAsync(db, "parametre", "parhsupmode", "VARCHAR(1) NULL", ct);
        // Société : ville séparée du numéro de rue (champ socadr existant).
        // ⚠ La table société est mappée "Societe" (PascalCase) par EF Core
        // (ApplicationDbContext.ToTable("Societe")) — PG la stocke donc sensible
        // à la casse. Passer "societe" tout en minuscules ne matche RIEN dans
        // information_schema → AddColumnIfMissingAsync return false silencieusement
        // → colonne jamais créée sur les tenants existants → SELECT s.socimg
        // explose en 42703 sur /api/Templates/preview/*. Cf. fix 2026-05-18.
        var socville = await AddColumnIfMissingAsync(db, "Societe", "socville", "VARCHAR(60) NULL", ct);
        // Société : logo (chemin /api/uploads/<uuid>.ext). Sans cette colonne, l'export
        // PDF des templates échoue en 500 dès qu'on tente le SELECT s.socimg dans
        // ReportsGenerationService.GenerateFromHtml. Migration silencieuse pour
        // rétrocompat des bases provisionnées avant l'introduction du champ.
        var socimg = await AddColumnIfMissingAsync(db, "Societe", "socimg", "VARCHAR(500) NULL", ct);
        // Société : branding personnalisé (option CustomBranding) — JSON des couleurs de base
        // de la plateforme. Lu par /Utilisateurs/me (champ "branding"). Sans cette colonne, le
        // SELECT s.Socbranding dans /me explose en 42703 sur les bases déjà provisionnées.
        // ⚠ Table "Societe" (PascalCase) — cf. note socville/socimg ci-dessus.
        await AddColumnIfMissingAsync(db, "Societe", "socbranding", "VARCHAR(1000) NULL", ct);
        // Société : politique de pointage hors zone geofence ('1' = accepter + notifier l'employeur ;
        // '0'/null = refuser, défaut). Lue par PresencesController.MarkPresence.
        await AddColumnIfMissingAsync(db, "Societe", "socgeohorszone", "VARCHAR(1) NULL", ct);
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
        var missionTable = await SafeStepAsync(() => EnsureMissionTableAsync(db, ct), false, "mission table");
        // NoteDeFrais.MissionId : ajouté en NULL pour ne pas casser les lignes existantes ;
        // côté contrôleur, on exige la valeur sur les nouvelles saisies. La migration ne
        // peut pas remplir rétroactivement les missions des notes déjà saisies.
        var nfMission = await AddColumnIfMissingAsync(db, "notedefrais", "missionid", "INTEGER NULL", ct);

        // Email collaborateur : VARCHAR(30) initial trop court (rejetait silencieusement
        // toute adresse moyennement longue, ex prenom.nom@entreprise.fr). Élargi à
        // VARCHAR(254) conformément au plafond RFC 5321. Aligné côté code par
        // [StringLength(254)] sur Employe.Empemail.
        var empemail = await ExpandColumnIfNeededAsync(db, "employe", "empemail", "VARCHAR(254)", currentMaxLen: 30, targetMaxLen: 254, makeNotNull: false, ct);

        // Jours fériés / repos : le motif (désignation) était plafonné à VARCHAR(20),
        // ce qui rejetait des libellés courants (« Commémoration de l'Armistice »…) avec
        // une 400 de validation à l'ajout. On élargit à 100 caractères.
        var fermotif = await ExpandColumnIfNeededAsync(db, "ferier", "fermotif", "VARCHAR(100)", currentMaxLen: 20, targetMaxLen: 100, makeNotNull: false, ct);

        // Service & Section — email + localisation. L'écran Structure organisationnelle
        // permet de saisir un email (service + section) et une localisation (service),
        // mais ces colonnes n'existaient pas : la « localisation » était écrite dans
        // serloc (un flag VARCHAR(1) « service externe »), ce qui faisait échouer la
        // modification en 400. On ajoute de vraies colonnes nullables ; serloc est conservé.
        await AddColumnIfMissingAsync(db, "service", "serlieu", "VARCHAR(60) NULL", ct);
        await AddColumnIfMissingAsync(db, "service", "seremail", "VARCHAR(256) NULL", ct);
        await AddColumnIfMissingAsync(db, "section", "secemail", "VARCHAR(256) NULL", ct);
        await AddColumnIfMissingAsync(db, "section", "seclieu", "VARCHAR(60) NULL", ct);

        // Service du compte utilisateur (socuser.sercod) : permet d'affecter un service à un
        // utilisateur (ex. manager) directement depuis l'écran « Utilisateur », sans qu'il
        // soit nécessairement un employé. Utilisé par GetManagerServiceCodeAsync pour scoper
        // un manager à son service (fallback sur employe.sercod pour les comptes existants).
        await AddColumnIfMissingAsync(db, "socuser", "sercod", "VARCHAR(4) NULL", ct);

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
        var ragDocsCreated = await SafeStepAsync(() => EnsureRagDocumentTableAsync(db, ct), false, "rag_document");
        var ragLettersCreated = await SafeStepAsync(() => EnsureRagLetterTemplateTableAsync(db, ct), false, "rag_letter_template");
        var ragLogsCreated = await SafeStepAsync(() => EnsureRagChatLogTableAsync(db, ct), false, "rag_chat_log");
        var ragTablesCreated = ragDocsCreated || ragLettersCreated || ragLogsCreated;

        // Devise pour les missions et notes de frais (ISO 4217 — 3 caractères).
        var missionDevise = await AddColumnIfMissingAsync(db, "mission", "misdevise", "VARCHAR(3) NULL", ct);
        var nfDevise = await AddColumnIfMissingAsync(db, "notedefrais", "devise", "VARCHAR(3) NULL", ct);

        // Geofence : zone GPS autorisée par site.
        var siteGeoLat = await AddColumnIfMissingAsync(db, "site", "sitlat", "DECIMAL(10,7) NULL", ct);
        var siteGeoLon = await AddColumnIfMissingAsync(db, "site", "sitlon", "DECIMAL(10,7) NULL", ct);
        var siteGeoRad = await AddColumnIfMissingAsync(db, "site", "sitrad", "INTEGER NULL", ct);
        var siteGeofenceAdded = siteGeoLat || siteGeoLon || siteGeoRad;

        // GPS du pointage : conservé pour la page admin "Suivi positions"
        // (audit anti-fraude + visualisation cartographique). Capté par le
        // mobile à chaque clock-in, persisté par PresencesController.MarkPresence.
        // Aligné dimensionnellement sur les colonnes geofence du Site (DECIMAL(10,7)
        // ≈ précision cm). Préacc en entier = mètres reportés par l'OS.
        await AddColumnIfMissingAsync(db, "presence", "prelat", "DECIMAL(10,7) NULL", ct);
        await AddColumnIfMissingAsync(db, "presence", "prelon", "DECIMAL(10,7) NULL", ct);
        await AddColumnIfMissingAsync(db, "presence", "preacc", "INTEGER NULL", ct);

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

        // Vérification email (2026-05) : OTP 6 chiffres envoyé au signup. BCrypt-hashé en
        // colonne uti_email_verif_code, expiré 15min après émission, anti-bruteforce via
        // compteur d'essais. Cf. Utilisateur.UtiEmailVerified / UtilisateursController.VerifyEmail.
        await AddColumnIfMissingAsync(db, "utilisateur", "uti_email_verified", "VARCHAR(1) NULL", ct);
        await AddColumnIfMissingAsync(db, "utilisateur", "uti_email_verif_code", "VARCHAR(72) NULL", ct);
        await AddColumnIfMissingAsync(db, "utilisateur", "uti_email_verif_expiry", "TIMESTAMP NULL", ct);
        await AddColumnIfMissingAsync(db, "utilisateur", "uti_email_verif_attempts", "INTEGER NULL", ct);

        // OTP de signature électronique (2026-06, Phase 3) : stockage dédié pour l'OTP
        // demandé au moment de signer (niveau de garantie « avancé »), distinct de la vérif
        // email du signup. BCrypt-hashé, expiry court, anti-bruteforce. Cf. SignatureOtpService.
        await AddColumnIfMissingAsync(db, "utilisateur", "uti_sign_otp_code", "VARCHAR(72) NULL", ct);
        await AddColumnIfMissingAsync(db, "utilisateur", "uti_sign_otp_expiry", "TIMESTAMP NULL", ct);
        await AddColumnIfMissingAsync(db, "utilisateur", "uti_sign_otp_attempts", "INTEGER NULL", ct);

        // AuditLog : capture de l'IP cliente à l'origine de l'action. 45 chars suffisent
        // pour un IPv6 complet (39) + suffixe scope éventuel. NULL pour les actions issues
        // d'un hosted service ou d'une migration design-time sans HttpContext.
        // ⚠ La table ET la colonne doivent rester en PascalCase ("IpAddress") parce que
        // EF Core génère du SQL quoté à partir du nom de propriété. Sans guillemets
        // dans l'ALTER, Postgres folde l'identifiant en minuscules → SELECT a."IpAddress"
        // échoue ensuite en 42703. On utilise donc EnsureQuotedColumnAsync ici.
        await EnsureQuotedColumnAsync(db, "AuditLog", "IpAddress", "VARCHAR(45) NULL", ct);

        // RGPD clause 13.3 — table singleton de paramétrage des durées de rétention
        // par tenant. L'admin DPO la modifie depuis l'UI (cf. RetentionPolicyController) ;
        // les hosted services lisent les valeurs au lieu d'utiliser les défauts de
        // appsettings.json. La ligne id=1 est seedée si absente.
        await SafeStepAsync(() => EnsureRetentionPolicyTableAsync(db, ct), "retention_policy");

        // Live tracking (2026-05-26) : table volatile contenant la dernière position
        // GPS connue de chaque salarié (heartbeat mobile toutes les 60s). Distincte de
        // presence.prelat/prelon qui n'a qu'un point par pointage. La table est purgée
        // par LivePositionRetentionHostedService au-delà de 30 min d'inactivité.
        await SafeStepAsync(() => EnsureLivePositionTableAsync(db, ct), "live_position");

        // Validation des heures supplémentaires (2026-05) : les demandes d'heures sup
        // créées depuis le mobile passent par /Autorisers/my-auth (table autoriser).
        // Pour permettre à l'admin/manager de valider ou refuser depuis le web, on
        // ajoute un état + métadonnées de traitement. NULL = legacy (avant fix) → traité
        // comme "Pending" côté lecture. Sans ces colonnes, l'écran de validation web
        // retournerait 42703 sur les tenants existants.
        await AddColumnIfMissingAsync(db, "autoriser", "conetat", "VARCHAR(20) NULL", ct);
        await AddColumnIfMissingAsync(db, "autoriser", "contraitepar", "VARCHAR(12) NULL", ct);
        await AddColumnIfMissingAsync(db, "autoriser", "contraitedat", "TIMESTAMP NULL", ct);
        await AddColumnIfMissingAsync(db, "autoriser", "concommentaire", "VARCHAR(500) NULL", ct);

        // Télétravail (2026-05-23) : table dédiée pour les demandes de TT employé +
        // workflow de validation manager/admin. Cycle Pending → Approved/Rejected,
        // cf. Models/Teletravail.cs. Tables indépendantes de demconge pour pouvoir
        // gérer ses propres règles métier (pas de solde à décrémenter, pas
        // d'absence type, plage en jours pleins simples).
        await SafeStepAsync(() => EnsureTeletravailTableAsync(db, ct), "teletravail");

        // Demande d'absence avec justificatif (2026-05-23) : workflow ponctuel,
        // distinct de Demconge (qui planifie + décrémente un solde). Le collaborateur
        // upload un certificat médical / convocation et le manager valide. Cf.
        // Models/DemandeAbsence.cs + DemandeAbsenceController.cs.
        await SafeStepAsync(() => EnsureDemandeAbsenceTableAsync(db, ct), "demande_absence");

        // Alimentation du CET par le salarié (2026-05-30) : demandes de transfert de
        // jours (RTT, CP…) vers le CET, avec workflow de validation optionnel (cf.
        // parametre.parcetvalidation). Table dédiée, distincte de demconge : pas de
        // dates de congé, juste un nombre de jours + un type source. Cf. CetController.
        await SafeStepAsync(() => EnsureDemAlimentationCetTableAsync(db, ct), "dem_alimentation_cet");

        // Seed CET (2026-05-30) — tenants existants : aligne la config CET sur le seed
        // de provisioning (cf. ProvisioningService.SeedInitialAsync).
        await SafeStepAsync(() => SeedCetAbsencesAsync(db, ct), "seed_cet_absences");

        // Signature électronique — workflow (2026-06, Phase 0) : 5 tables d'orchestration
        // (request/step/action/seal_log/template_map) + 3 colonnes sur documentvault pour
        // refléter l'état workflow et le sceau cryptographique. Idempotent. Cf. Models/Signature*.
        await AddColumnIfMissingAsync(db, "documentvault", "workflow_status", "VARCHAR(30) NULL", ct);
        await AddColumnIfMissingAsync(db, "documentvault", "seal_hash", "VARCHAR(64) NULL", ct);
        await AddColumnIfMissingAsync(db, "documentvault", "sealed_at", "TIMESTAMP NULL", ct);
        await SafeStepAsync(() => EnsureSignatureWorkflowTablesAsync(db, ct), "signature_workflow_tables");

        // Modèles de documents par défaut (contrat, titre/demande de congé, autorisation de
        // sortie, certificat/attestation de travail, visite médicale, attestation de salaire)
        // + liaisons signature_template_map. Seedés par société, idempotent. Permet aux tenants
        // EXISTANTS de les obtenir automatiquement au premier accès (sans appeler manuellement
        // POST /api/Roles/seed-system). Évite « parcours de signature bloqué faute de modèle ».
        await SafeStepAsync(() => SeedDefaultLetterTemplatesAsync(db, ct), "seed_default_letter_templates");

        // Tables mobiles + notifications + known_devices : on délègue à MobileTablesInstaller
        // qui sait déjà créer push_tokens, notifications, notification_preferences,
        // notification_user_settings, known_devices.
        await SafeStepAsync(() => MobileTablesInstaller.InstallAsync(db, ct), "mobile_tables");

        // Seed nations : sans données, le sélecteur "Nationalité" / "Pays" reste vide.
        await SafeStepAsync(() => SeedNationsIfEmptyAsync(db, ct), "seed_nations");

        // PERF — Indexes critiques sur les hot-paths.
        await SafeStepAsync(() => EnsurePerformanceIndexesAsync(db, ct), "performance_indexes");

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

    private static async Task<bool> EnsureRetentionPolicyTableAsync(ApplicationDbContext db, CancellationToken ct)
    {
        var created = !await TableExistsAsync(db, "retention_policy", ct);
        if (created)
        {
            await db.Database.ExecuteSqlRawAsync(@"
CREATE TABLE retention_policy (
    id                              INTEGER     PRIMARY KEY,
    audit_log_days                  INTEGER     NOT NULL DEFAULT 180,
    presence_anonymize_days         INTEGER     NOT NULL DEFAULT 365,
    presence_delete_days            INTEGER     NOT NULL DEFAULT 1825,
    refresh_token_days_after_expiry INTEGER     NOT NULL DEFAULT 30,
    known_device_inactive_days      INTEGER     NOT NULL DEFAULT 365,
    push_token_inactive_days        INTEGER     NOT NULL DEFAULT 90,
    rag_chat_log_days               INTEGER     NOT NULL DEFAULT 90,
    updated_at                      TIMESTAMP   NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    updated_by                      VARCHAR(20) NULL
);", ct);
        }
        // Seed (ou re-seed si la ligne id=1 a été effacée par erreur).
        await db.Database.ExecuteSqlRawAsync(@"
INSERT INTO retention_policy (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;", ct);
        return created;
    }

    /// <summary>
    /// Crée la table `teletravail` (demandes de télétravail) si absente. Idempotent.
    /// Schéma : PK auto-incrémentée, scope tenant via soccod, état machine sur
    /// status, métadonnées de décision sur decided_by/decided_at/decision_comment.
    /// Indexes inclus pour les hot-paths : liste pending par tenant, historique
    /// par employé.
    /// </summary>
    private static async Task<bool> EnsureTeletravailTableAsync(ApplicationDbContext db, CancellationToken ct)
    {
        var created = !await TableExistsAsync(db, "teletravail", ct);
        if (created)
        {
            await db.Database.ExecuteSqlRawAsync(@"
CREATE TABLE teletravail (
    id                SERIAL       PRIMARY KEY,
    soccod            VARCHAR(2)   NULL,
    empcod            VARCHAR(12)  NULL,
    requested_at      TIMESTAMP    NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    start_date        TIMESTAMP    NOT NULL,
    end_date          TIMESTAMP    NOT NULL,
    days_count        REAL         NULL,
    reason            VARCHAR(500) NULL,
    status            VARCHAR(20)  NOT NULL DEFAULT 'Pending',
    decided_by        VARCHAR(20)  NULL,
    decided_at        TIMESTAMP    NULL,
    decision_comment  VARCHAR(500) NULL,
    created_at        TIMESTAMP    NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);", ct);
        }
        // Index — créés en dehors du CREATE TABLE pour rester idempotents même
        // si la table existait déjà (cas d'un tenant migré manuellement).
        await db.Database.ExecuteSqlRawAsync(@"
CREATE INDEX IF NOT EXISTS ix_teletravail_soccod_status
    ON teletravail (soccod, status)
    INCLUDE (empcod, start_date, end_date);", ct);
        await db.Database.ExecuteSqlRawAsync(@"
CREATE INDEX IF NOT EXISTS ix_teletravail_empcod_start
    ON teletravail (empcod, start_date DESC);", ct);
        return created;
    }

    /// <summary>
    /// Crée la table `demande_absence` (demandes d'absence avec justificatif).
    /// Idempotent. Inclut les colonnes du justificatif (URL/filename/mime/size)
    /// et un index pour la liste des demandes Pending par tenant (hot-path UI
    /// manager / badge notification dans la sidebar).
    /// </summary>
    private static async Task<bool> EnsureDemandeAbsenceTableAsync(ApplicationDbContext db, CancellationToken ct)
    {
        var created = !await TableExistsAsync(db, "demande_absence", ct);
        if (created)
        {
            await db.Database.ExecuteSqlRawAsync(@"
CREATE TABLE demande_absence (
    id                       SERIAL        PRIMARY KEY,
    soccod                   VARCHAR(2)    NULL,
    empcod                   VARCHAR(12)   NULL,
    requested_at             TIMESTAMP     NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    start_date               TIMESTAMP     NOT NULL,
    end_date                 TIMESTAMP     NOT NULL,
    days_count               REAL          NULL,
    abscod                   VARCHAR(6)    NULL,
    reason                   VARCHAR(1000) NULL,
    justification_url        VARCHAR(500)  NULL,
    justification_filename   VARCHAR(200)  NULL,
    justification_mime       VARCHAR(100)  NULL,
    justification_size       BIGINT        NULL,
    status                   VARCHAR(20)   NOT NULL DEFAULT 'Pending',
    decided_by               VARCHAR(20)   NULL,
    decided_at               TIMESTAMP     NULL,
    decision_comment         VARCHAR(500)  NULL,
    created_at               TIMESTAMP     NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);", ct);
        }
        await db.Database.ExecuteSqlRawAsync(@"
CREATE INDEX IF NOT EXISTS ix_demande_absence_soccod_status
    ON demande_absence (soccod, status)
    INCLUDE (empcod, start_date, end_date);", ct);
        await db.Database.ExecuteSqlRawAsync(@"
CREATE INDEX IF NOT EXISTS ix_demande_absence_empcod_start
    ON demande_absence (empcod, start_date DESC);", ct);
        return created;
    }

    /// <summary>
    /// Seed CET pour les tenants déjà provisionnés (le seed de provisioning ne couvre que
    /// les nouveaux). Idempotent :
    ///   1. marque les types Congé payé ("0") et RTT ("R") comme « peut alimenter le CET »
    ///      là où le drapeau n'a jamais été défini (NULL) — pour qu'ils apparaissent dans
    ///      l'écran d'alimentation salarié sans config manuelle ;
    ///   2. crée un type d'absence « CET » (Abscng='E', Absprendcet='1') par société qui n'en
    ///      a pas — pour poser un congé financé par le CET.
    /// ⚠ La table société est mappée "Societe" (PascalCase) par EF Core — on garde les
    /// guillemets dans le FROM pour matcher l'identifiant réel en base.
    /// </summary>
    private static async Task SeedCetAbsencesAsync(ApplicationDbContext db, CancellationToken ct)
    {
        try
        {
            if (!await TableExistsAsync(db, "absence", ct)) return;

            await db.Database.ExecuteSqlRawAsync(
                "UPDATE absence SET abspeutcet = '1' WHERE abspeutcet IS NULL AND abscng IN ('0','R');", ct);

            if (await TableExistsAsync(db, "Societe", ct))
            {
                await db.Database.ExecuteSqlRawAsync(@"
INSERT INTO absence (abscod, soccod, abslib, abscng, abspayer, absunite, absprendcet)
SELECT 'CET', s.soccod, 'Congé CET', 'E', 'O', 'J', '1'
FROM ""Societe"" s
WHERE NOT EXISTS (
    SELECT 1 FROM absence a WHERE a.soccod = s.soccod AND (a.abscng = 'E' OR a.abscod = 'CET')
);", ct);
            }
        }
        catch
        {
            // Best-effort : un échec de seed (table société absente, course au démarrage…)
            // ne doit jamais empêcher l'application de démarrer. Retenté au prochain boot.
        }
    }

    /// <summary>
    /// Seede les modèles de documents par défaut + liaisons signature pour CHAQUE société du
    /// tenant (idempotent, délégué à <see cref="ABRPOINT.Server.Provisioning.DefaultLetterTemplateSeeder"/>).
    /// Best-effort : un échec ne doit jamais empêcher le démarrage (réessayé au prochain boot).
    /// </summary>
    private static async Task SeedDefaultLetterTemplatesAsync(ApplicationDbContext db, CancellationToken ct)
    {
        try
        {
            if (!await TableExistsAsync(db, "rag_letter_template", ct)) return;
            if (!await TableExistsAsync(db, "signature_template_map", ct)) return;

            var soccods = await db.Societes
                .Where(s => s.Soccod != null)
                .Select(s => s.Soccod!)
                .ToListAsync(ct);
            foreach (var soccod in soccods)
                await ABRPOINT.Server.Provisioning.DefaultLetterTemplateSeeder.SeedAsync(db, soccod, ct);
        }
        catch
        {
            // Best-effort : course au démarrage, table société absente, etc. — retenté au prochain boot.
        }
    }

    private static async Task<bool> EnsureDemAlimentationCetTableAsync(ApplicationDbContext db, CancellationToken ct)
    {
        var created = !await TableExistsAsync(db, "dem_alimentation_cet", ct);
        if (created)
        {
            await db.Database.ExecuteSqlRawAsync(@"
CREATE TABLE dem_alimentation_cet (
    id               SERIAL        PRIMARY KEY,
    soccod           VARCHAR(6)    NULL,
    empcod           VARCHAR(12)   NULL,
    abscod           VARCHAR(4)    NULL,
    nbjours          REAL          NOT NULL DEFAULT 0,
    annee            VARCHAR(4)    NULL,
    datedemande      TIMESTAMP     NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    statut           VARCHAR(12)   NOT NULL DEFAULT 'pending',
    validepar        VARCHAR(12)   NULL,
    datevalidation   TIMESTAMP     NULL,
    motifrefus       VARCHAR(200)  NULL
);", ct);
        }
        await db.Database.ExecuteSqlRawAsync(@"
CREATE INDEX IF NOT EXISTS ix_dem_alimentation_cet_soccod_statut
    ON dem_alimentation_cet (soccod, statut)
    INCLUDE (empcod, abscod, nbjours, annee);", ct);
        await db.Database.ExecuteSqlRawAsync(@"
CREATE INDEX IF NOT EXISTS ix_dem_alimentation_cet_empcod
    ON dem_alimentation_cet (soccod, empcod, datedemande DESC);", ct);
        return created;
    }

    /// <summary>
    /// Crée les 5 tables du workflow de signature électronique si absentes. Idempotent
    /// (CREATE TABLE guardé par TableExistsAsync, index en IF NOT EXISTS). Tables en
    /// snake_case lowercase (PAS l'exception PascalCase "Societe"). Cf. Models/Signature*.
    /// </summary>
    private static async Task EnsureSignatureWorkflowTablesAsync(ApplicationDbContext db, CancellationToken ct)
    {
        if (!await TableExistsAsync(db, "signature_request", ct))
        {
            await db.Database.ExecuteSqlRawAsync(@"
CREATE TABLE signature_request (
    id                INTEGER     GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    soccod            VARCHAR(6)  NOT NULL,
    source_type       VARCHAR(40) NOT NULL,
    source_id         VARCHAR(40) NULL,
    documentvault_id  INTEGER     NULL,
    requested_by      VARCHAR(12) NOT NULL,
    workflow_status   VARCHAR(30) NOT NULL DEFAULT 'awaiting_signatures',
    current_step      INTEGER     NOT NULL DEFAULT 1,
    created_at        TIMESTAMP   NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    completed_at      TIMESTAMP   NULL
);", ct);
        }
        await db.Database.ExecuteSqlRawAsync(@"
CREATE INDEX IF NOT EXISTS ix_signature_request_soccod_status
    ON signature_request (soccod, workflow_status) INCLUDE (source_type, source_id, documentvault_id);", ct);

        if (!await TableExistsAsync(db, "signature_step", ct))
        {
            await db.Database.ExecuteSqlRawAsync(@"
CREATE TABLE signature_step (
    id                INTEGER     GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    request_id        INTEGER     NOT NULL,
    step_order        INTEGER     NOT NULL,
    signer_empcod     VARCHAR(12) NOT NULL,
    signer_role       VARCHAR(20) NOT NULL DEFAULT 'employee',
    placeholder_key   VARCHAR(40) NULL,
    status            VARCHAR(20) NOT NULL DEFAULT 'pending',
    delegated_to      VARCHAR(12) NULL
);", ct);
        }
        await db.Database.ExecuteSqlRawAsync(@"
CREATE INDEX IF NOT EXISTS ix_signature_step_request_order
    ON signature_step (request_id, step_order);", ct);

        if (!await TableExistsAsync(db, "signature_action", ct))
        {
            await db.Database.ExecuteSqlRawAsync(@"
CREATE TABLE signature_action (
    id                INTEGER      GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    request_id        INTEGER      NOT NULL,
    step_id           INTEGER      NOT NULL,
    signer_empcod     VARCHAR(12)  NOT NULL,
    action            VARCHAR(20)  NOT NULL DEFAULT 'signed',
    signature_path    VARCHAR(500) NULL,
    certificate_id    VARCHAR(60)  NULL,
    auth_method       VARCHAR(20)  NULL,
    ip_address        VARCHAR(64)  NULL,
    user_agent        VARCHAR(256) NULL,
    motif             VARCHAR(500) NULL,
    signed_at         TIMESTAMP    NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);", ct);
        }
        await db.Database.ExecuteSqlRawAsync(@"
CREATE INDEX IF NOT EXISTS ix_signature_action_request
    ON signature_action (request_id, signed_at);", ct);

        if (!await TableExistsAsync(db, "signature_seal_log", ct))
        {
            await db.Database.ExecuteSqlRawAsync(@"
CREATE TABLE signature_seal_log (
    id                INTEGER     GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    request_id        INTEGER     NOT NULL,
    documentvault_id  INTEGER     NOT NULL,
    seal_hash         VARCHAR(64) NOT NULL,
    prev_seal_hash    VARCHAR(64) NULL,
    sealed_by         VARCHAR(12) NOT NULL,
    sealed_at         TIMESTAMP   NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);", ct);
        }
        await db.Database.ExecuteSqlRawAsync(@"
CREATE INDEX IF NOT EXISTS ix_signature_seal_log_request
    ON signature_seal_log (request_id, sealed_at);", ct);

        if (!await TableExistsAsync(db, "signature_template_map", ct))
        {
            await db.Database.ExecuteSqlRawAsync(@"
CREATE TABLE signature_template_map (
    id                INTEGER      GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    soccod            VARCHAR(6)   NULL,
    source_type       VARCHAR(40)  NOT NULL,
    template_kind     VARCHAR(20)  NOT NULL,
    template_ref      VARCHAR(255) NOT NULL
);", ct);
        }
        await db.Database.ExecuteSqlRawAsync(@"
CREATE INDEX IF NOT EXISTS ix_signature_template_map_lookup
    ON signature_template_map (source_type, soccod);", ct);
    }

    private static async Task<bool> EnsureLivePositionTableAsync(ApplicationDbContext db, CancellationToken ct)
    {
        var created = !await TableExistsAsync(db, "live_position", ct);
        if (created)
        {
            // PK composite (soccod, empcod) — une seule ligne par salarié, upsert à
            // chaque heartbeat. Pas d'historique conservé : la sémantique « live »
            // n'a besoin que de la dernière position connue ; les historiques de
            // pointage restent dans presence.{prelat,prelon}.
            await db.Database.ExecuteSqlRawAsync(@"
CREATE TABLE live_position (
    soccod         VARCHAR(4)    NOT NULL,
    empcod         VARCHAR(12)   NOT NULL,
    lat            DECIMAL(10,7) NOT NULL,
    lon            DECIMAL(10,7) NOT NULL,
    acc            INTEGER       NULL,
    updated_at     TIMESTAMP     NOT NULL,
    session_id     VARCHAR(64)   NULL,
    battery_level  INTEGER       NULL,
    PRIMARY KEY (soccod, empcod)
);", ct);
            // Index sur updated_at — la requête GET /Presences/live-positions filtre
            // par fraîcheur et la purge supprime sur ce même critère.
            await db.Database.ExecuteSqlRawAsync(@"
CREATE INDEX IF NOT EXISTS ix_live_position_updated_at ON live_position (updated_at);", ct);
        }
        return created;
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
    ///
    /// ⚠ Casse PG : un identifiant non-quoté est fold en minuscules. Les tables EF
    /// mappées avec ToTable("Pascal") sont stockées avec leur casse exacte et
    /// doivent être référencées entre double-quotes dans l'ALTER. Sinon
    /// `ALTER TABLE Societe …` échoue en 42P01 (relation "societe" does not exist).
    /// </summary>
    private static async Task<bool> AddColumnIfMissingAsync(ApplicationDbContext db, string table, string column, string columnDef, CancellationToken ct)
    {
        if (!await TableExistsAsync(db, table, ct)) return false;
        // Lookup explicite pour pouvoir retourner true/false (ADD COLUMN IF NOT EXISTS ne
        // dit pas si quelque chose a été ajouté, seulement qu'il n'a pas crashé).
        if (await ColumnExistsAsync(db, table, column, ct)) return false;
        var quotedTable = table.Any(char.IsUpper) ? $"\"{table}\"" : table;
        try
        {
            await db.Database.ExecuteSqlRawAsync($"ALTER TABLE {quotedTable} ADD COLUMN IF NOT EXISTS {column} {columnDef};", ct);
            return true;
        }
        catch (Exception ex)
        {
            // Best-effort : un échec isolé (lock, droits) ne doit pas avorter les colonnes suivantes.
            Console.Error.WriteLine($"[BaseDataSchemaMigrator] ADD COLUMN {table}.{column} ignoré : {ex.Message}");
            return false;
        }
    }

    /// <summary>
    /// Variante de AddColumnIfMissingAsync qui force le PascalCase via double-quoting
    /// du nom de colonne. Utilisée pour les colonnes mappées par EF Core qui génère
    /// du SQL quoté (ex. AuditLog.IpAddress). Si une colonne lowercase existe déjà
    /// (créée par erreur sans quotes), on la renomme vers le nom PascalCase au lieu
    /// d'en créer une seconde — évite la double colonne ipaddress/IpAddress.
    /// </summary>
    private static async Task<bool> EnsureQuotedColumnAsync(ApplicationDbContext db, string table, string column, string columnDef, CancellationToken ct)
    {
        if (!await TableExistsAsync(db, table, ct)) return false;
        var quotedTable = table.Any(char.IsUpper) ? $"\"{table}\"" : table;

        // 1. La colonne PascalCase existe déjà ? On a fini.
        if (await ColumnExistsExactAsync(db, table, column, ct)) return false;

        // 2. Une colonne lowercase rescapée d'une migration antérieure sans quotes ?
        //    Si oui, on la renomme — le data déjà capturé est préservé.
        var lower = column.ToLowerInvariant();
        try
        {
            if (!string.Equals(lower, column, StringComparison.Ordinal)
                && await ColumnExistsExactAsync(db, table, lower, ct))
            {
                await db.Database.ExecuteSqlRawAsync(
                    $"ALTER TABLE {quotedTable} RENAME COLUMN {lower} TO \"{column}\";", ct);
                return true;
            }

            // 3. Création propre avec identifiant quoté pour préserver la casse.
            await db.Database.ExecuteSqlRawAsync(
                $"ALTER TABLE {quotedTable} ADD COLUMN IF NOT EXISTS \"{column}\" {columnDef};", ct);
            return true;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[BaseDataSchemaMigrator] colonne quotée {table}.\"{column}\" ignorée : {ex.Message}");
            return false;
        }
    }

    /// <summary>
    /// Variante de ColumnExistsAsync qui respecte la casse exacte du nom passé,
    /// nécessaire pour différencier "IpAddress" de "ipaddress" dans information_schema.
    /// </summary>
    private static async Task<bool> ColumnExistsExactAsync(ApplicationDbContext db, string table, string column, CancellationToken ct)
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
        // ⚠ Cet ALTER « dur » peut jeter (FK dépendante, vue matérialisée, lock) sur certains
        // tenants. On l'isole pour ne pas avorter le reste de la migration (ex. presence.preacc
        // plus loin). Sans ce try/catch, un échec ville/employe.vilcod laissait des colonnes
        // ultérieures non créées → 42703 récurrent.
        try
        {
            await db.Database.ExecuteSqlRawAsync($"ALTER TABLE {table} ALTER COLUMN {column} TYPE {newType};", ct);
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[BaseDataSchemaMigrator] ALTER COLUMN TYPE {table}.{column} ignoré : {ex.Message}");
            return false;
        }
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
