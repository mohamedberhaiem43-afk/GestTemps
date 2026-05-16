# Applique AddRefreshTokenPurposeAndQuota.sql sur :
#   - la base legacy "abrpoint" (anciennes installations mono-tenant, si elle existe)
#   - chaque base tenant listée dans abrpoint_master."Tenants"."DbName"
#
# À lancer depuis la racine du repo, sur le serveur où tournent les conteneurs.
# Usage : powershell -File scripts/apply-refresh-token-migration.ps1
#
# Migré SQL Server → PostgreSQL :
#   - sqlcmd → psql (inclus dans l'image postgres:16-alpine)
#   - SA_PASSWORD → POSTGRES_PASSWORD
#   - SELECT db_name FROM tenants → SELECT "DbName" FROM "Tenants" (PascalCase quoting)
#
# Le script copie le .sql dans le conteneur DB puis le rejoue contre chaque DB.

param(
    [string]$PgContainer = "abrpoint.database",
    [string]$PgUser      = $env:POSTGRES_USER,
    [string]$PgPassword  = $env:POSTGRES_PASSWORD,
    [string]$MasterDb    = "abrpoint_master",
    [string]$LegacyDb    = "abrpoint",
    [string]$SqlFile     = "ABRPOINT.Server/Migrations/AddRefreshTokenPurposeAndQuota.sql"
)

if (-not $PgUser) {
    # Fallback : lit le user depuis docker-compose.yml. Défaut "abrpoint" si non trouvé.
    $PgUser = (Select-String -Path docker-compose.yml -Pattern 'POSTGRES_USER:\s*"([^"]+)"' | Select-Object -First 1).Matches.Groups[1].Value
    if (-not $PgUser) { $PgUser = 'abrpoint' }
}
if (-not $PgPassword) {
    # Fallback : valeur littérale dans compose (devrait être surchargée par .env en prod).
    $PgPassword = (Select-String -Path docker-compose.yml -Pattern 'POSTGRES_PASSWORD:\s*"\$\{POSTGRES_PASSWORD:-([^}]+)\}"' | Select-Object -First 1).Matches.Groups[1].Value
}
if (-not $PgPassword) { throw "POSTGRES_PASSWORD introuvable. Passez-le en variable d'environnement." }

$inContainerPath = "/tmp/AddRefreshTokenPurposeAndQuota.sql"

Write-Host "[1/3] Copie du SQL dans $PgContainer..."
docker cp $SqlFile "${PgContainer}:$inContainerPath"
if ($LASTEXITCODE -ne 0) { throw "docker cp a échoué" }

function Invoke-SqlOnDb($db) {
    Write-Host "  → $db"
    # PGPASSWORD est l'env-var standard psql pour l'auth non-interactive.
    # -v ON_ERROR_STOP=1 fait sortir psql avec un code != 0 à la première erreur
    # (équivalent du -b de sqlcmd).
    docker exec -e PGPASSWORD=$PgPassword $PgContainer `
        psql -h localhost -U $PgUser -d $db -v ON_ERROR_STOP=1 -f $inContainerPath
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Migration en erreur sur $db (code $LASTEXITCODE)"
    }
}

Write-Host "[2/3] Récupération de la liste des tenants depuis $MasterDb..."
# -t (tuples-only) supprime l'en-tête et le footer ; -A (unaligned) supprime
# les espaces de padding ; "Tenants" et "DbName" entre guillemets pour conserver
# la casse PascalCase héritée d'EF.
$dbList = docker exec -e PGPASSWORD=$PgPassword $PgContainer `
    psql -h localhost -U $PgUser -d $MasterDb -t -A `
    -c 'SELECT "DbName" FROM "Tenants";' 2>$null

$tenantDbs = $dbList |
    Where-Object { $_ -and $_ -notmatch '^\s*$' } |
    ForEach-Object { $_.Trim() } |
    Where-Object { $_ -ne '' }

Write-Host "[3/3] Application de la migration..."
# Base legacy (si elle existe — sinon psql renverra une erreur ignorable)
Invoke-SqlOnDb $LegacyDb
# Chaque tenant
foreach ($db in $tenantDbs) { Invoke-SqlOnDb $db }

Write-Host "Terminé."
