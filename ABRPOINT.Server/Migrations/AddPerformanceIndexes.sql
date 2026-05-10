-- =============================================================================
-- Indexes de performance — recommandés par l'audit SECURITY_PERFORMANCE_AUDIT.md
-- À exécuter sur chaque base tenant (et la base legacy DefaultConnection).
--
-- Couvre les hot-paths identifiés :
--   - Lecture présences sur intervalle (état périodique, pointage du mois)
--   - Notifications non lues d'un utilisateur (badge unread sur shell)
--   - Coffre-fort par employé (chargement liste documents)
--   - Demandes de congé pendantes (dashboard manager/admin)
--   - Recherche employés par soccod (la majorité des écrans)
--
-- IDX préfixés `ix_` pour distinguer des contraintes/PK.
-- WITH (ONLINE = ON) commenté : disponible en SQL Server Enterprise/Standard
-- récents — l'activer en prod pour éviter les blocages applicatifs pendant la
-- création (sur Express, retirer la clause).
-- =============================================================================

-- 1️⃣ Présence : queries périodiques [soccod, predat] + filtre empcod
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_presence_soccod_predat' AND object_id = OBJECT_ID('presence'))
BEGIN
    CREATE NONCLUSTERED INDEX ix_presence_soccod_predat
        ON presence (soccod, predat)
        INCLUDE (empcod, preentmatup, presortmatup, preentamidiup, presortamidiup, tothre, tothsup, tothabs);
    -- WITH (ONLINE = ON);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_presence_empcod_predat' AND object_id = OBJECT_ID('presence'))
BEGIN
    CREATE NONCLUSTERED INDEX ix_presence_empcod_predat
        ON presence (empcod, predat DESC);
END
GO

-- 2️⃣ Notifications non lues par utilisateur
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_notification_uticod_isread' AND object_id = OBJECT_ID('notification'))
BEGIN
    CREATE NONCLUSTERED INDEX ix_notification_uticod_isread
        ON notification (uticod, isread)
        INCLUDE (createdat, title, category);
END
GO

-- 3️⃣ Coffre-fort par employé/société
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_documentvault_soccod_empcod_docdate' AND object_id = OBJECT_ID('documentvault'))
BEGIN
    CREATE NONCLUSTERED INDEX ix_documentvault_soccod_empcod_docdate
        ON documentvault (soccod, empcod, docdate DESC)
        INCLUDE (docname, doctype, docsize, issigned, status);
END
GO

-- 4️⃣ Demandes de congé en attente
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_demconge_soccod_condg' AND object_id = OBJECT_ID('demconge'))
BEGIN
    CREATE NONCLUSTERED INDEX ix_demconge_soccod_condg
        ON demconge (soccod, condg)
        INCLUDE (empcod, condep, conret, condat);
END
GO

-- 5️⃣ Push tokens actifs par utilisateur
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_pushtoken_uticod_active' AND object_id = OBJECT_ID('pushtoken'))
BEGIN
    CREATE NONCLUSTERED INDEX ix_pushtoken_uticod_active
        ON pushtoken (uticod, active)
        INCLUDE (token);
END
GO

-- 6️⃣ Employés par société (filtres dropdowns omniprésents)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_employe_soccod_empetat' AND object_id = OBJECT_ID('employe'))
BEGIN
    CREATE NONCLUSTERED INDEX ix_employe_soccod_empetat
        ON employe (soccod, empetat)
        INCLUDE (empcod, empmat, emplib, sercod, secncod, dircod, sitcod);
END
GO

-- 7️⃣ Demandes d'autorisation par statut
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_demandeautorisation_soccod_statut' AND object_id = OBJECT_ID('demandeautorisation'))
BEGIN
    CREATE NONCLUSTERED INDEX ix_demandeautorisation_soccod_statut
        ON demandeautorisation (soccod, statut)
        INCLUDE (empcod, condep, conret, abscod);
END
GO

-- 8️⃣ Audit log par utilisateur (lecture historique sécurité)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_auditlog_uticod_createdat' AND object_id = OBJECT_ID('auditlog'))
BEGIN
    CREATE NONCLUSTERED INDEX ix_auditlog_uticod_createdat
        ON auditlog (uticod, createdat DESC);
END
GO

PRINT 'Index de performance créés/vérifiés.';
GO
