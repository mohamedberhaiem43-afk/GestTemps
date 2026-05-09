-- =============================================================================
-- Geofencing : ajoute lat/lon/rayon sur la table site pour valider les pointages
-- contre une zone autorisée définie par l'admin/manager.
--
-- - sitlat / sitlon : coordonnées du centre de la zone (decimal 10,7 ≈ 1cm)
-- - sitrad         : rayon en mètres
-- - NULL sur les 3 colonnes = aucun geofence pour ce site (comportement legacy)
--
-- À exécuter sur chaque base tenant ainsi que sur la base legacy (DefaultConnection).
-- =============================================================================

IF COL_LENGTH('site', 'sitlat') IS NULL
BEGIN
    ALTER TABLE site ADD sitlat DECIMAL(10, 7) NULL;
END
GO

IF COL_LENGTH('site', 'sitlon') IS NULL
BEGIN
    ALTER TABLE site ADD sitlon DECIMAL(10, 7) NULL;
END
GO

IF COL_LENGTH('site', 'sitrad') IS NULL
BEGIN
    ALTER TABLE site ADD sitrad INT NULL;
END
GO
