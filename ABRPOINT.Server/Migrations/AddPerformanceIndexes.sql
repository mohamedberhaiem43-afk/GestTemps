-- =============================================================================
-- Indexes de performance — recommandés par l'audit SECURITY_PERFORMANCE_AUDIT.md
-- À exécuter sur chaque base tenant (et la base legacy DefaultConnection).
--
-- Migré T-SQL → PostgreSQL :
--   - sys.indexes lookup → CREATE INDEX IF NOT EXISTS (natif depuis PG 9.5)
--   - NONCLUSTERED → omis (Postgres n'a pas de clustered index ; les B-Tree
--     standards sont équivalents en pratique)
--   - INCLUDE (cols...) → supporté nativement depuis PG 11 (covering index)
--   - WITH (ONLINE = ON) → CONCURRENTLY (équivalent Postgres, à utiliser en prod
--     pour ne pas verrouiller la table pendant la création)
--
-- Pour exécuter en prod sans bloquer : remplacer chaque "CREATE INDEX" par
-- "CREATE INDEX CONCURRENTLY" (incompatible avec un seul transaction-block,
-- donc à exécuter ligne par ligne via psql -1=false).
-- =============================================================================

-- 1️⃣ Présence : queries périodiques [soccod, predat] + filtre empcod
CREATE INDEX IF NOT EXISTS ix_presence_soccod_predat
    ON presence (soccod, predat)
    INCLUDE (empcod, preentmatup, presortmatup, preentamidiup, presortamidiup, tothre, tothsup, tothabs);

CREATE INDEX IF NOT EXISTS ix_presence_empcod_predat
    ON presence (empcod, predat DESC);

-- 2️⃣ Notifications non lues par utilisateur
CREATE INDEX IF NOT EXISTS ix_notification_uticod_isread
    ON notification (uticod, isread)
    INCLUDE (createdat, title, category);

-- 3️⃣ Coffre-fort par employé/société
CREATE INDEX IF NOT EXISTS ix_documentvault_soccod_empcod_docdate
    ON documentvault (soccod, empcod, docdate DESC)
    INCLUDE (docname, doctype, docsize, issigned, status);

-- 4️⃣ Demandes de congé en attente
CREATE INDEX IF NOT EXISTS ix_demconge_soccod_condg
    ON demconge (soccod, condg)
    INCLUDE (empcod, condep, conret, condat);

-- 5️⃣ Push tokens actifs par utilisateur
CREATE INDEX IF NOT EXISTS ix_pushtoken_uticod_active
    ON pushtoken (uticod, active)
    INCLUDE (token);

-- 6️⃣ Employés par société (filtres dropdowns omniprésents)
CREATE INDEX IF NOT EXISTS ix_employe_soccod_empetat
    ON employe (soccod, empetat)
    INCLUDE (empcod, empmat, emplib, sercod, secncod, dircod, sitcod);

-- 7️⃣ Demandes d'autorisation par statut
CREATE INDEX IF NOT EXISTS ix_demandeautorisation_soccod_statut
    ON demandeautorisation (soccod, statut)
    INCLUDE (empcod, condep, conret, abscod);

-- 8️⃣ Audit log par utilisateur (lecture historique sécurité)
CREATE INDEX IF NOT EXISTS ix_auditlog_uticod_createdat
    ON auditlog (uticod, createdat DESC);
