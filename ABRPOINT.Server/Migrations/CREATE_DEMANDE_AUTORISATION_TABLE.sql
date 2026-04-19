-- Migration: Create demande_autorisation table
-- Date: 2026-04-18

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'demande_autorisation')
BEGIN
    CREATE TABLE demande_autorisation (
        id                  INT IDENTITY(1,1) PRIMARY KEY,
        soccod              VARCHAR(2) NOT NULL,
        empcod              VARCHAR(12) NOT NULL,
        concod              VARCHAR(10) NULL,
        condat              DATETIME NULL,
        condep              DATETIME NULL,
        conret              DATETIME NULL,
        connbjour           FLOAT NULL,
        conmotif            VARCHAR(200) NULL,
        statut              VARCHAR(20) NOT NULL DEFAULT 'En attente',
        date_demande        DATETIME NULL,
        traite_par          VARCHAR(12) NULL,
        date_traitement     DATETIME NULL,
        commentaire         VARCHAR(500) NULL,
    );

    PRINT 'Table demande_autorisation créée avec succès.';
END
ELSE
BEGIN
    PRINT 'La table demande_autorisation existe déjà.';
END
GO