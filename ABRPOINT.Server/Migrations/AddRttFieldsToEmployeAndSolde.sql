-- =============================================================================
-- Migration : ajout des champs RTT (Réduction du Temps de Travail, loi française)
-- =============================================================================
-- Tables impactées : employe, solde
-- Idempotent : utilise IF NOT EXISTS pour pouvoir être ré-exécuté sans erreur.
-- À exécuter sur chaque base tenant.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Champs de configuration RTT par employé
--    EmpRttMethode :
--      'N' = non éligible (défaut implicite si NULL)
--      'M' = saisie manuelle (s'appuie sur emp_rtt_jours_annuel)
--      'H' = calcul horaire    (s'appuie sur emp_rtt_heures_contrat)
--      'F' = forfait jours     (s'appuie sur emp_rtt_forfait_jours)
-- ─────────────────────────────────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.employe') AND name = 'emp_rtt_methode')
BEGIN
    ALTER TABLE dbo.employe ADD emp_rtt_methode nvarchar(1) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.employe') AND name = 'emp_rtt_jours_annuel')
BEGIN
    ALTER TABLE dbo.employe ADD emp_rtt_jours_annuel real NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.employe') AND name = 'emp_rtt_heures_contrat')
BEGIN
    ALTER TABLE dbo.employe ADD emp_rtt_heures_contrat real NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.employe') AND name = 'emp_rtt_forfait_jours')
BEGIN
    ALTER TABLE dbo.employe ADD emp_rtt_forfait_jours int NULL;
END
GO

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Solde RTT par employé / année
--    Le mécanisme de "perte au 31 décembre" est implicite : table solde déjà
--    indexée par (Empcod, Soccod) avec colonne `annee`. Une nouvelle ligne
--    pour l'année N+1 démarre naturellement à 0 ; le job de clôture peut
--    également remettre ces deux colonnes à 0 sur la ligne courante.
-- ─────────────────────────────────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.solde') AND name = 'rtt_jours')
BEGIN
    ALTER TABLE dbo.solde ADD rtt_jours real NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.solde') AND name = 'rtt_utilises')
BEGIN
    ALTER TABLE dbo.solde ADD rtt_utilises real NULL;
END
GO

PRINT 'Migration AddRttFieldsToEmployeAndSolde appliquée.';
