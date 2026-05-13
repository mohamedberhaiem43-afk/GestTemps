-- ─────────────────────────────────────────────────────────────────────────
-- Hotfix : applique manuellement les changements de schéma 2026-05 pour les
-- bases de tenants existantes si la migration in-place n'a pas pu s'exécuter
-- (cf. BaseDataSchemaMigrator + MobileTablesInstaller).
--
-- À EXÉCUTER SUR CHAQUE BASE DE TENANT (tenant_xxx_yyyyyyyy) qui retourne 500
-- sur POST /api/Utilisateurs/connect. Idempotent : peut être relancé sans risque.
-- ─────────────────────────────────────────────────────────────────────────

-- 1. Account lockout (utilisateur)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'uti_failed_logins' AND Object_ID = Object_ID(N'utilisateur'))
BEGIN
    ALTER TABLE [utilisateur] ADD [uti_failed_logins] INT NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'uti_lockout_until' AND Object_ID = Object_ID(N'utilisateur'))
BEGIN
    ALTER TABLE [utilisateur] ADD [uti_lockout_until] DATETIME2 NULL;
END
GO

-- 2. Known devices (anti-suspicious-login)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'known_devices')
BEGIN
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
END
GO
