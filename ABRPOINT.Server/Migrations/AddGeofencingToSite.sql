-- =============================================================================
-- Geofencing : ajoute lat/lon/rayon sur la table site pour valider les pointages
-- contre une zone autorisée définie par l'admin/manager.
--
-- - sitlat / sitlon : coordonnées du centre de la zone (decimal 10,7 ≈ 1cm)
-- - sitrad         : rayon en mètres
-- - NULL sur les 3 colonnes = aucun geofence pour ce site (comportement legacy)
--
-- À exécuter via psql sur chaque base tenant ainsi que sur la base legacy.
-- Migré T-SQL → PostgreSQL : COL_LENGTH → ADD COLUMN IF NOT EXISTS.
-- =============================================================================

ALTER TABLE site ADD COLUMN IF NOT EXISTS sitlat DECIMAL(10, 7) NULL;
ALTER TABLE site ADD COLUMN IF NOT EXISTS sitlon DECIMAL(10, 7) NULL;
ALTER TABLE site ADD COLUMN IF NOT EXISTS sitrad INTEGER          NULL;
