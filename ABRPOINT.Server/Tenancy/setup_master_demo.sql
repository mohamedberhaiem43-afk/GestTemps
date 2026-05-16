/*
  Setup multi-tenant — itération 1 (test local).
  ─────────────────────────────────────────────────
  OBSOLÈTE EN FONCTIONNEMENT NORMAL : depuis le SignupController + ProvisioningService,
  les tenants sont créés à la demande au signup (CREATE DATABASE + Migrate + Seed).
  Ce script reste utile UNIQUEMENT pour seed manuellement des tenants démo en local
  sans passer par le flow HTTP (utile pour développer/débugger le tenant resolver).

  Crée :
   1. La base "abrpoint_master" (control plane). Note : créée automatiquement par
      docker-compose via POSTGRES_DB="abrpoint_master" au premier démarrage du
      conteneur — ce script ne sert que pour un Postgres lancé hors compose.
   2. La table "Tenants" (schéma compatible avec MasterDbContext / Tenant.cs).
      Note : créée automatiquement par MasterDbContext.EnsureCreatedAsync au boot.
   3. 2 tenants de démo :
        - "acme" → DbName = tenant_acme
        - "beta" → DbName = tenant_beta
   4. Crée les bases tenant_acme + tenant_beta vides (à peupler via
      ProvisioningService.RunMigrationsAsync en appelant un endpoint custom).

  Exécution :
    docker exec -it abrpoint.database psql -U abrpoint -d postgres -f /path/to/setup_master_demo.sql
  ou depuis l'hôte (port-mapping 127.0.0.1:5432 actif) :
    psql -h localhost -U abrpoint -d postgres -f setup_master_demo.sql

  Migré SQL Server → PostgreSQL :
    UNIQUEIDENTIFIER         → UUID
    NVARCHAR                 → VARCHAR (UTF-8 par défaut en PG)
    DATETIME2                → TIMESTAMP
    BIT                      → BOOLEAN
    NEWID()                  → gen_random_uuid()  (extension pgcrypto activée par défaut PG 13+)
    SYSUTCDATETIME()         → (NOW() AT TIME ZONE 'UTC')
    DATEADD(day, 14, ...)    → ... + INTERVAL '14 days'
    MERGE … WHEN MATCHED …   → INSERT … ON CONFLICT (Slug) DO UPDATE
    GO (batch terminator)    → ; (PG est un seul script, pas de batches)
    IF DB_ID(...) IS NULL    → \gset / DO bloc ; ici on utilise CREATE DATABASE IF NOT EXISTS… mais
                                CREATE DATABASE n'a PAS de IF NOT EXISTS en PG : on filtre via pg_database.
    BACKUP/RESTORE           → pg_dump -Fc / pg_restore (cf. scripts/backup.sh)
    USE [DB]                 → \c <db> (psql meta-command)
*/

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Master DB (si pas déjà créée par docker-compose POSTGRES_DB).
-- ───────────────────────────────────────────────────────────────────────────
-- PG : CREATE DATABASE ne supporte pas IF NOT EXISTS. Le workaround idiomatique :
-- shell-out conditionnel via DO bloc + dblink, OU contrôle préalable côté client.
-- Ici on assume que l'opérateur lance ce script connecté à la DB 'postgres' et
-- crée 'abrpoint_master' manuellement avant si besoin. Plus simple.
SELECT 'Si la base abrpoint_master n''existe pas, créez-la d''abord : CREATE DATABASE abrpoint_master;' AS info
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'abrpoint_master');

\c abrpoint_master

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Table "Tenants" (compatible avec ABRPOINT.Server.Tenancy.Tenant).
-- ───────────────────────────────────────────────────────────────────────────
-- Casse PascalCase conservée via "double quotes" — sinon PG folde en lowercase
-- et EF Core ne retrouverait pas ses colonnes (mappées en PascalCase par défaut).
CREATE TABLE IF NOT EXISTS "Tenants" (
    "Id"                   UUID         NOT NULL PRIMARY KEY,
    "Slug"                 VARCHAR(30)  NOT NULL,
    "CompanyName"          VARCHAR(150) NOT NULL,
    "DbName"               VARCHAR(63)  NOT NULL,                  -- 63 = NAMEDATALEN max PG (vs 64 SQL Server)
    "Status"               VARCHAR(20)  NOT NULL,
    "AdminEmail"           VARCHAR(150) NULL,
    "CreatedAt"            TIMESTAMP    NOT NULL,
    "TrialEndsAt"          TIMESTAMP    NULL,
    "StripeCustomerId"     VARCHAR(64)  NULL,
    "StripeSubscriptionId" VARCHAR(64)  NULL,
    "Region"               VARCHAR(20)  NOT NULL DEFAULT 'eu-fr',
    "OnboardingCompleted"  BOOLEAN      NOT NULL DEFAULT FALSE,
    "LegacySoccod"         VARCHAR(6)   NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "UX_Tenants_Slug"             ON "Tenants"("Slug");
CREATE INDEX        IF NOT EXISTS "IX_Tenants_StripeCustomerId" ON "Tenants"("StripeCustomerId");

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Seed 2 tenants démo (idempotent via ON CONFLICT).
-- ───────────────────────────────────────────────────────────────────────────
-- PG : `INSERT ... ON CONFLICT (col) DO UPDATE` est l'équivalent direct du MERGE
-- SQL Server (plus simple à lire, et atomique sans le piège classique du MERGE
-- sur conflit de clé). gen_random_uuid() vient de pgcrypto (built-in PG 13+).
INSERT INTO "Tenants" ("Id", "Slug", "CompanyName", "DbName", "Status", "AdminEmail", "CreatedAt", "TrialEndsAt", "Region", "OnboardingCompleted", "LegacySoccod")
VALUES
    (gen_random_uuid(), 'acme', 'ACME Corp (démo)', 'tenant_acme', 'Trialing', 'admin@acme.test',
        (NOW() AT TIME ZONE 'UTC'), (NOW() AT TIME ZONE 'UTC') + INTERVAL '14 days', 'eu-fr', FALSE, 'AC'),
    (gen_random_uuid(), 'beta', 'BETA SAS (démo)',  'tenant_beta', 'Trialing', 'admin@beta.test',
        (NOW() AT TIME ZONE 'UTC'), (NOW() AT TIME ZONE 'UTC') + INTERVAL '14 days', 'eu-fr', FALSE, 'BE')
ON CONFLICT ("Slug") DO UPDATE SET
    "CompanyName"  = EXCLUDED."CompanyName",
    "DbName"       = EXCLUDED."DbName",
    "Status"       = EXCLUDED."Status",
    "AdminEmail"   = EXCLUDED."AdminEmail",
    "LegacySoccod" = EXCLUDED."LegacySoccod";

SELECT 'Tenants seedés :' AS info;
SELECT "Slug", "DbName", "Status", "LegacySoccod" FROM "Tenants";

-- ───────────────────────────────────────────────────────────────────────────
-- 4. Bases tenant_acme + tenant_beta — à créer MANUELLEMENT depuis psql
--    connecté à 'postgres' (CREATE DATABASE ne marche pas dans un script
--    multi-statement attaché à autre chose que 'postgres').
-- ───────────────────────────────────────────────────────────────────────────
SELECT 'Pour créer les bases tenant_acme + tenant_beta, reconnectez-vous à "postgres" et lancez :' AS info;
SELECT 'CREATE DATABASE tenant_acme;' AS sql;
SELECT 'CREATE DATABASE tenant_beta;' AS sql;
SELECT 'Puis pour appliquer le schéma : dotnet ef database update --connection "Host=...;Database=tenant_acme;..."' AS info;

/*
  PEUPLER LE SCHÉMA D'UN TENANT VIA SQL DIRECT (alternative à dotnet ef) :

    # Dump le schéma d'un tenant existant (sans data)
    docker exec abrpoint.database pg_dump -h localhost -U abrpoint -d tenant_template \
      --schema-only --no-owner --no-acl > tenant_schema.sql

    # Restore dans une nouvelle base
    docker exec -i abrpoint.database psql -h localhost -U abrpoint -d tenant_acme < tenant_schema.sql

  Pour distinguer les données et valider l'isolation tenant :

    \c tenant_beta
    UPDATE societe SET soclib = 'BETA SAS' WHERE soccod = (SELECT soccod FROM societe LIMIT 1);
    DELETE FROM employe WHERE empcod NOT IN (SELECT empcod FROM employe LIMIT 3);
*/
