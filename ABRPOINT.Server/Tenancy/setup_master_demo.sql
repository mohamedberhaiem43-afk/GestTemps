/*
  Setup multi-tenant — itération 1 (test local).
  ─────────────────────────────────────────────────
  Crée :
   1. La base "ABRPOINT_master" (control plane).
   2. La table dbo.Tenants (schéma compatible avec MasterDbContext / Tenant.cs).
   3. 2 tenants de démo :
        - "acme" → DbName = ABRPOINT          (= la base existante, pour ne pas perdre les données)
        - "beta" → DbName = ABRPOINT_beta     (à créer ensuite, voir étape 4)
   4. Crée ABRPOINT_beta vide pour valider l'isolation.

  Exécution :
   - Ouvrir SSMS / Azure Data Studio connecté à localhost.
   - Exécuter ce script.
   - Pour ABRPOINT_beta : si vous voulez un schéma identique à ABRPOINT, faire un
     BACKUP / RESTORE WITH MOVE de ABRPOINT (cf. bloc commenté en bas).
*/

-- 1. Master DB
IF DB_ID('ABRPOINT_master') IS NULL
BEGIN
    CREATE DATABASE [ABRPOINT_master] COLLATE French_CI_AS;
END
GO

USE [ABRPOINT_master];
GO

-- 2. Table Tenants (compatible avec ABRPOINT.Server.Tenancy.Tenant)
IF OBJECT_ID('dbo.Tenants') IS NULL
BEGIN
    CREATE TABLE dbo.Tenants (
        Id                   UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Tenants PRIMARY KEY,
        Slug                 NVARCHAR(30)     NOT NULL,
        CompanyName          NVARCHAR(150)    NOT NULL,
        DbName               NVARCHAR(64)     NOT NULL,
        Status               NVARCHAR(20)     NOT NULL,
        AdminEmail           NVARCHAR(150)    NULL,
        CreatedAt            DATETIME2        NOT NULL,
        TrialEndsAt          DATETIME2        NULL,
        StripeCustomerId     NVARCHAR(64)     NULL,
        StripeSubscriptionId NVARCHAR(64)     NULL,
        Region               NVARCHAR(20)     NOT NULL CONSTRAINT DF_Tenants_Region DEFAULT 'eu-fr',
        OnboardingCompleted  BIT              NOT NULL CONSTRAINT DF_Tenants_OnbDone DEFAULT 0,
        LegacySoccod         NVARCHAR(6)      NULL
    );
    CREATE UNIQUE INDEX UX_Tenants_Slug ON dbo.Tenants(Slug);
    CREATE INDEX IX_Tenants_StripeCustomerId ON dbo.Tenants(StripeCustomerId);
END
GO

-- 3. Seed 2 tenants démo (idempotent)
MERGE dbo.Tenants AS T
USING (VALUES
    ('acme', 'ACME Corp (démo)',  'ABRPOINT',      'Trialing', 'admin@acme.test', 'AC'),
    ('beta', 'BETA SAS (démo)',   'ABRPOINT_beta', 'Trialing', 'admin@beta.test', 'BE')
) AS S(Slug, CompanyName, DbName, Status, AdminEmail, LegacySoccod)
ON T.Slug = S.Slug
WHEN MATCHED THEN
    UPDATE SET
        CompanyName  = S.CompanyName,
        DbName       = S.DbName,
        Status       = S.Status,
        AdminEmail   = S.AdminEmail,
        LegacySoccod = S.LegacySoccod
WHEN NOT MATCHED THEN
    INSERT (Id, Slug, CompanyName, DbName, Status, AdminEmail, CreatedAt, TrialEndsAt, Region, OnboardingCompleted, LegacySoccod)
    VALUES (NEWID(), S.Slug, S.CompanyName, S.DbName, S.Status, S.AdminEmail, SYSUTCDATETIME(), DATEADD(day, 14, SYSUTCDATETIME()), 'eu-fr', 0, S.LegacySoccod);
GO

PRINT 'Tenants seedés :';
SELECT Slug, DbName, Status, LegacySoccod FROM dbo.Tenants;
GO

-- 4. Créer ABRPOINT_beta vide (à compléter par BACKUP/RESTORE de ABRPOINT si vous voulez le même schéma).
IF DB_ID('ABRPOINT_beta') IS NULL
BEGIN
    CREATE DATABASE [ABRPOINT_beta] COLLATE French_CI_AS;
    PRINT 'ABRPOINT_beta créée (vide). Pour la peupler avec le schéma ABRPOINT, lancez :';
    PRINT '   BACKUP DATABASE [ABRPOINT] TO DISK = ''C:\Temp\abrpoint.bak'' WITH COPY_ONLY, INIT;';
    PRINT '   RESTORE DATABASE [ABRPOINT_beta] FROM DISK = ''C:\Temp\abrpoint.bak''';
    PRINT '       WITH MOVE ''ABRPOINT''     TO ''C:\...\ABRPOINT_beta.mdf'',';
    PRINT '            MOVE ''ABRPOINT_log'' TO ''C:\...\ABRPOINT_beta_log.ldf'', REPLACE;';
END
GO

/*
  EXEMPLE DE RESTORE (à adapter aux chemins MDF/LDF de votre instance) :

  USE master;
  ALTER DATABASE [ABRPOINT_beta] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
  DROP DATABASE [ABRPOINT_beta];

  BACKUP DATABASE [ABRPOINT]
    TO DISK = N'C:\Temp\abrpoint.bak'
    WITH COPY_ONLY, INIT, COMPRESSION;

  RESTORE FILELISTONLY FROM DISK = N'C:\Temp\abrpoint.bak'; -- repérez les LogicalNames

  RESTORE DATABASE [ABRPOINT_beta] FROM DISK = N'C:\Temp\abrpoint.bak'
    WITH FILE = 1,
         MOVE N'ABRPOINT'     TO N'<chemin>\ABRPOINT_beta.mdf',
         MOVE N'ABRPOINT_log' TO N'<chemin>\ABRPOINT_beta_log.ldf',
         REPLACE, RECOVERY;

  -- Distinguer la donnée pour valider l'isolation :
  USE ABRPOINT_beta;
  UPDATE dbo.societe SET soclib = 'BETA SAS' WHERE soccod = (SELECT TOP 1 soccod FROM dbo.societe);
  DELETE FROM dbo.employe WHERE empcod NOT IN (SELECT TOP 3 empcod FROM dbo.employe);
*/
