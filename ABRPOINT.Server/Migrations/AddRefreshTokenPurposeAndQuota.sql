-- =============================================================================
-- SEC-G2 / SEC-G6 — Étend la table refresh_tokens pour :
--   - distinguer les tokens biométriques (qui survivent au logout) des refresh
--     tokens classiques
--   - tracer l'usage récent (last_used_at) pour le quota par utilisateur
--
-- À exécuter sur chaque base tenant et sur la base legacy.
-- =============================================================================

IF COL_LENGTH('refresh_tokens', 'purpose') IS NULL
BEGIN
    ALTER TABLE refresh_tokens ADD purpose VARCHAR(20) NOT NULL CONSTRAINT DF_refresh_tokens_purpose DEFAULT 'Refresh';
END
GO

IF COL_LENGTH('refresh_tokens', 'last_used_at') IS NULL
BEGIN
    ALTER TABLE refresh_tokens ADD last_used_at DATETIME2 NULL;
END
GO

-- Index pour les queries du quota (5 derniers RT actifs par user)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_refresh_tokens_uticod_purpose_revoked' AND object_id = OBJECT_ID('refresh_tokens'))
BEGIN
    CREATE NONCLUSTERED INDEX ix_refresh_tokens_uticod_purpose_revoked
        ON refresh_tokens (uticod, purpose, revoked)
        INCLUDE (expires_at, last_used_at);
END
GO

PRINT 'refresh_tokens étendue (purpose + last_used_at + index quota).';
GO
