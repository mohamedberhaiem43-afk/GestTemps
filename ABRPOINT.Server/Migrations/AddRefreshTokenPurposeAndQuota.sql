-- =============================================================================
-- SEC-G2 / SEC-G6 — Étend la table refresh_tokens pour :
--   - distinguer les tokens biométriques (qui survivent au logout) des refresh
--     tokens classiques
--   - tracer l'usage récent (last_used_at) pour le quota par utilisateur
--
-- À exécuter via psql sur chaque base tenant et sur la base legacy.
-- Migré T-SQL → PostgreSQL : COL_LENGTH/sys.indexes → IF NOT EXISTS natif.
-- =============================================================================

ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS purpose      VARCHAR(20) NOT NULL DEFAULT 'Refresh';
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP   NULL;

-- Index pour les queries du quota (5 derniers RT actifs par user).
-- INCLUDE supporté nativement depuis PG 11.
CREATE INDEX IF NOT EXISTS ix_refresh_tokens_uticod_purpose_revoked
    ON refresh_tokens (uticod, purpose, revoked)
    INCLUDE (expires_at, last_used_at);
