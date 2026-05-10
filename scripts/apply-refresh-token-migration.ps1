# Applique AddRefreshTokenPurposeAndQuota.sql sur :
#   - la base legacy "ABRPOINT" (anciennes installations mono-tenant)
#   - chaque base tenant listée dans master.tenants
#
# À lancer depuis la racine du repo, sur le serveur où tournent les conteneurs.
# Usage : powershell -File scripts/apply-refresh-token-migration.ps1
#
# Le script copie le .sql dans le conteneur DB puis le rejoue contre chaque DB.

param(
    [string]$SqlContainer = "abrpoint.database",
    [string]$SaPassword   = $env:SA_PASSWORD,
    [string]$MasterDb     = "ABRPOINT_master",
    [string]$LegacyDb     = "ABRPOINT",
    [string]$SqlFile      = "ABRPOINT.Server/Migrations/AddRefreshTokenPurposeAndQuota.sql"
)

if (-not $SaPassword) {
    # Fallback : lit le mot de passe depuis docker-compose.yml si non passé en env.
    $SaPassword = (Select-String -Path docker-compose.yml -Pattern 'SA_PASSWORD:\s*"([^"]+)"' | Select-Object -First 1).Matches.Groups[1].Value
}
if (-not $SaPassword) { throw "SA_PASSWORD introuvable. Passez-le en variable d'environnement." }

$inContainerPath = "/var/opt/mssql/AddRefreshTokenPurposeAndQuota.sql"

Write-Host "[1/3] Copie du SQL dans $SqlContainer..."
docker cp $SqlFile "${SqlContainer}:$inContainerPath"
if ($LASTEXITCODE -ne 0) { throw "docker cp a échoué" }

function Invoke-SqlOnDb($db) {
    Write-Host "  → $db"
    docker exec $SqlContainer /opt/mssql-tools18/bin/sqlcmd `
        -S localhost -U sa -P $SaPassword -C `
        -d $db -i $inContainerPath -b
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Migration en erreur sur $db (code $LASTEXITCODE)"
    }
}

Write-Host "[2/3] Récupération de la liste des tenants depuis $MasterDb..."
$dbList = docker exec $SqlContainer /opt/mssql-tools18/bin/sqlcmd `
    -S localhost -U sa -P $SaPassword -C `
    -d $MasterDb -h -1 -W `
    -Q "SET NOCOUNT ON; SELECT db_name FROM tenants;" 2>$null

$tenantDbs = $dbList |
    Where-Object { $_ -and $_ -notmatch '^\s*$' -and $_ -notmatch 'rows affected' } |
    ForEach-Object { $_.Trim() } |
    Where-Object { $_ -ne '' }

Write-Host "[3/3] Application de la migration..."
# Base legacy (si elle existe — sinon sqlcmd renverra une erreur ignorable)
Invoke-SqlOnDb $LegacyDb
# Chaque tenant
foreach ($db in $tenantDbs) { Invoke-SqlOnDb $db }

Write-Host "Terminé."
