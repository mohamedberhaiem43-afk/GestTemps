-- =============================================================================
-- Branding personnalisé : ajoute la colonne socbranding sur la table "Societe" pour
-- stocker les couleurs de base de la plateforme choisies par le tenant (option
-- « Branding personnalisé », incluse dans Premium ou via addon CustomBranding).
--
-- - socbranding : JSON des couleurs, ex.
--     {"primary":"#0040a1","background":"#f7f9fb","title":"#1e293b"}
--   NULL = thème par défaut (aucune personnalisation).
--
-- ⚠ La table est mappée "Societe" (PascalCase) par EF Core (ApplicationDbContext
--   .ToTable("Societe")) → en PostgreSQL elle est sensible à la casse et DOIT être
--   citée. Un « ALTER TABLE societe » (minuscule) ne matche RIEN.
--
-- AUTO-APPLIQUÉ : ce script est désormais redondant — la colonne est créée
-- automatiquement et idempotemment par BaseDataSchemaMigrator.MigrateAsync (au
-- provisioning d'un nouveau tenant ET au 1er accès de chaque tenant existant, via
-- TenantResolverMiddleware). Conservé comme documentation / filet manuel psql.
-- =============================================================================

ALTER TABLE "Societe" ADD COLUMN IF NOT EXISTS socbranding VARCHAR(1000) NULL;
