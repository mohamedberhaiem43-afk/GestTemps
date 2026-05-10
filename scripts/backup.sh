#!/usr/bin/env bash
# =============================================================================
# Backup quotidien : volume uploads_data + SQL master + tous les SQL tenants
#
# - Pré-requis : exécuté sur l'hôte Docker, avec accès au socket docker.
# - Sortie : fichiers dans BACKUP_DIR (env var ou /var/backups/abrpoint par défaut)
# - Rotation : conserve les 7 derniers jours quotidiens + 4 hebdo + 6 mensuels.
# - À planifier via cron : `0 3 * * * /opt/abrpoint/scripts/backup.sh >> /var/log/abrpoint-backup.log 2>&1`
#
# Variables d'environnement :
#   BACKUP_DIR        Dossier de sortie (défaut: /var/backups/abrpoint)
#   SQL_SA_PASSWORD   Mot de passe SA SQL Server (depuis docker-compose.yml)
#   DB_CONTAINER      Nom du conteneur SQL (défaut: abrpoint.database)
#   SERVER_CONTAINER  Nom du conteneur backend (défaut: abrpoint.server)
# =============================================================================

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/abrpoint}"
SQL_SA_PASSWORD="${SQL_SA_PASSWORD:-}"
DB_CONTAINER="${DB_CONTAINER:-abrpoint.database}"
SERVER_CONTAINER="${SERVER_CONTAINER:-abrpoint.server}"
TIMESTAMP="$(date +%F_%H%M%S)"
DAY_DIR="${BACKUP_DIR}/daily/${TIMESTAMP}"

if [[ -z "$SQL_SA_PASSWORD" ]]; then
  echo "[ERR] SQL_SA_PASSWORD env var requise — abandon." >&2
  exit 1
fi

echo "[$(date -Iseconds)] Backup démarré → $DAY_DIR"
mkdir -p "$DAY_DIR"

# ── 1. Uploads (volume Docker) ────────────────────────────────────────────────
# On passe par un conteneur jetable monté sur le volume + un bind-mount sortie.
# tar incrémental serait plus efficace mais plus fragile en restauration ;
# tar.gz complet < 5 Go reste pragmatique pour une PME.
echo "[$(date -Iseconds)] Uploads → uploads.tar.gz"
docker run --rm \
  -v abrpoint_uploads_data:/data:ro \
  -v "$DAY_DIR":/backup \
  alpine:3 \
  sh -c "tar czf /backup/uploads.tar.gz -C /data ."

# ── 2. SQL : list databases (master + tous les tenants ABRPOINT*) ─────────────
echo "[$(date -Iseconds)] Énumération bases SQL"
DBS=$(docker exec -i "$DB_CONTAINER" /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P "$SQL_SA_PASSWORD" -C -h -1 -W \
  -Q "SET NOCOUNT ON; SELECT name FROM sys.databases WHERE name LIKE 'ABRPOINT%' OR name = 'ABRPOINT_master'" \
  | tr -d '\r' | grep -v '^$' | grep -v '^---' | grep -v 'rows affected')

if [[ -z "$DBS" ]]; then
  echo "[WARN] Aucune base ABRPOINT trouvée" >&2
fi

for DB in $DBS; do
  DB="$(echo "$DB" | xargs)"
  [[ -z "$DB" ]] && continue
  BAK_FILE="/var/opt/sql-backup/${DB}_${TIMESTAMP}.bak"
  echo "[$(date -Iseconds)] BACKUP DATABASE [$DB]"
  docker exec -i "$DB_CONTAINER" /opt/mssql-tools18/bin/sqlcmd \
    -S localhost -U sa -P "$SQL_SA_PASSWORD" -C \
    -Q "BACKUP DATABASE [$DB] TO DISK = N'$BAK_FILE' WITH FORMAT, INIT, COMPRESSION, NAME = N'${DB} full'"

  # Le volume sql-backup est bind-mounté côté host → on copie depuis le mount path
  # connu (./sql-backup dans docker-compose.yml).
  cp "./sql-backup/${DB}_${TIMESTAMP}.bak" "$DAY_DIR/" || true
done

# ── 3. Checksum manifest ──────────────────────────────────────────────────────
(cd "$DAY_DIR" && sha256sum * > manifest.sha256)

# ── 4. Rotation : 7 quotidiens, 4 hebdo (lundi), 6 mensuels (1er du mois) ─────
echo "[$(date -Iseconds)] Rotation"
find "$BACKUP_DIR/daily" -maxdepth 1 -type d -mtime +7 -exec rm -rf {} \;
DOW=$(date +%u) # 1=lundi
DOM=$(date +%d)
if [[ "$DOW" == "1" ]]; then
  mkdir -p "$BACKUP_DIR/weekly"
  cp -al "$DAY_DIR" "$BACKUP_DIR/weekly/${TIMESTAMP}"
  find "$BACKUP_DIR/weekly" -maxdepth 1 -type d -mtime +28 -exec rm -rf {} \;
fi
if [[ "$DOM" == "01" ]]; then
  mkdir -p "$BACKUP_DIR/monthly"
  cp -al "$DAY_DIR" "$BACKUP_DIR/monthly/${TIMESTAMP}"
  find "$BACKUP_DIR/monthly" -maxdepth 1 -type d -mtime +180 -exec rm -rf {} \;
fi

echo "[$(date -Iseconds)] ✅ Backup terminé : $DAY_DIR"
du -sh "$DAY_DIR"
