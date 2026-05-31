-- =============================================================================
-- Politique de pointage hors zone : ajoute la colonne socgeohorszone sur "Societe".
--
-- - socgeohorszone : '1' = ACCEPTER les pointages hors du périmètre geofence du site
--                    (avec notification de l'employeur). '0'/NULL = REFUSER (défaut, sécurité).
--
-- Lu par PresencesController.MarkPresence ; édité via le paramètre société (SocieteModern).
--
-- ⚠ La table est mappée "Societe" (PascalCase) par EF Core → sensible à la casse en
--   PostgreSQL, DOIT être citée. « ALTER TABLE societe » (minuscule) ne matche RIEN.
--
-- AUTO-APPLIQUÉ : créé automatiquement et idempotemment par
-- BaseDataSchemaMigrator.MigrateAsync (provisioning + 1er accès de chaque tenant via
-- TenantResolverMiddleware). Conservé comme documentation / filet manuel psql.
-- =============================================================================

ALTER TABLE "Societe" ADD COLUMN IF NOT EXISTS socgeohorszone VARCHAR(1) NULL;
