-- =============================================================================
-- Migration : ajout des champs RTT (Réduction du Temps de Travail, loi française)
-- Migré T-SQL → PostgreSQL :
--   - dbo.employe → employe (PG n'utilise pas de schéma "dbo")
--   - nvarchar(1) → VARCHAR(1)
--   - real → REAL (existe identique en PG, 4 bytes IEEE 754)
--   - int → INTEGER
-- =============================================================================
-- Tables impactées : employe, solde
-- Idempotent : ADD COLUMN IF NOT EXISTS pour pouvoir être ré-exécuté sans erreur.
-- À exécuter sur chaque base tenant.

-- 1. Champs de configuration RTT par employé
--    emp_rtt_methode :
--      'N' = non éligible (défaut implicite si NULL)
--      'M' = saisie manuelle (s'appuie sur emp_rtt_jours_annuel)
--      'H' = calcul horaire   (s'appuie sur emp_rtt_heures_contrat)
--      'F' = forfait jours    (s'appuie sur emp_rtt_forfait_jours)
ALTER TABLE employe ADD COLUMN IF NOT EXISTS emp_rtt_methode        VARCHAR(1) NULL;
ALTER TABLE employe ADD COLUMN IF NOT EXISTS emp_rtt_jours_annuel   REAL       NULL;
ALTER TABLE employe ADD COLUMN IF NOT EXISTS emp_rtt_heures_contrat REAL       NULL;
ALTER TABLE employe ADD COLUMN IF NOT EXISTS emp_rtt_forfait_jours  INTEGER    NULL;

-- 2. Solde RTT par employé / année
ALTER TABLE solde ADD COLUMN IF NOT EXISTS rtt_jours    REAL NULL;
ALTER TABLE solde ADD COLUMN IF NOT EXISTS rtt_utilises REAL NULL;
