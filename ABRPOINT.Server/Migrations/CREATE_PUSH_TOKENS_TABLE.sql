/*
  Crée la table push_tokens (1 par appareil) pour stocker les tokens Expo Push.
  À exécuter sur chaque base tenant existante. Les nouveaux tenants l'auront
  automatiquement via le seed initial du ProvisioningService (à condition qu'on
  ajoute aussi cette table dans la migration EF principale).

  Idempotent : utilise IF NOT EXISTS.
*/

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'push_tokens')
BEGIN
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
        [created_at_audit] DATETIME2 NULL,
        [updated_at_audit] DATETIME2 NULL,
        [deleted_at_audit] DATETIME2 NULL
    );
    CREATE INDEX [IX_push_tokens_uticod] ON [push_tokens]([uticod]);
    CREATE UNIQUE INDEX [UX_push_tokens_token] ON [push_tokens]([token]);
    PRINT 'Table push_tokens créée.';
END
ELSE
BEGIN
    PRINT 'Table push_tokens déjà présente — rien à faire.';
END
GO
