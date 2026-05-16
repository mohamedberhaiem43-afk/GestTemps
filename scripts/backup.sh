#!/usr/bin/env bash
# =============================================================================
# Backup quotidien : volume uploads_data + dump master + dump tous les tenants
#
# - Pré-requis : exécuté sur l'hôte Docker, avec accès au socket docker.
# - Sortie : fichiers dans BACKUP_DIR (env var ou /var/backups/abrpoint par défaut)
# - Rotation : conserve les 7 derniers jours quotidiens + 4 hebdo + 6 mensuels.
# - À planifier via cron : `0 3 * * * /opt/abrpoint/scripts/backup.sh >> /var/log/abrpoint-backup.log 2>&1`
#
# Migré SQL Server → PostgreSQL :
#   - sqlcmd BACKUP DATABASE → pg_dump (format custom -Fc, le plus compact + portable)
#   - SA_PASSWORD → POSTGRES_PASSWORD
#   - sys.databases LIKE 'ABRPOINT%' → pg_database lookup avec préfixe tenant_ ou nom master
#
# Variables d'environnement :
#   BACKUP_DIR          Dossier de sortie (défaut: /var/backups/abrpoint)
#   POSTGRES_PASSWORD   Mot de passe du superuser Postgres (depuis docker-compose.yml)
#   POSTGRES_USER       User Postgres (défaut: abrpoint)
#   DB_CONTAINER        Nom du conteneur Postgres (défaut: abrpoint.database)
#   SERVER_CONTAINER    Nom du conteneur backend (défaut: abrpoint.server)
# =============================================================================

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/abrpoint}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"
POSTGRES_USER="${POSTGRES_USER:-abrpoint}"
DB_CONTAINER="${DB_CONTAINER:-abrpoint.database}"
SERVER_CONTAINER="${SERVER_CONTAINER:-abrpoint.server}"
TIMESTAMP="$(date +%F_%H%M%S)"
DAY_DIR="${BACKUP_DIR}/daily/${TIMESTAMP}"

if [[ -z "$POSTGRES_PASSWORD" ]]; then
  echo "[ERR] POSTGRES_PASSWORD env var requise — abandon." >&2
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

# ── 2. Postgres : list databases (master + tous les tenants_*) ───────────────
echo "[$(date -Iseconds)] Énumération bases Postgres"
# pg_database = catalog Postgres listant les DB du cluster. On filtre :
#   - abrpoint_master (master multi-tenant)
#   - tenant_* (bases provisionnées par tenant)
# On exclut postgres/template0/template1 (systèmes) et tout ce qui ne matche pas.
DBS=$(docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" -i "$DB_CONTAINER" \
  psql -h localhost -U "$POSTGRES_USER" -d postgres -t -A \
  -c "SELECT datname FROM pg_database WHERE datname = 'abrpoint_master' OR datname LIKE 'tenant_%' ORDER BY datname;")

if [[ -z "$DBS" ]]; then
  echo "[WARN] Aucune base abrpoint_master ni tenant_* trouvée" >&2
fi

for DB in $DBS; do
  DB="$(echo "$DB" | xargs)"
  [[ -z "$DB" ]] && continue
  DUMP_FILE="${DB}_${TIMESTAMP}.dump"
  echo "[$(date -Iseconds)] pg_dump $DB → $DUMP_FILE"
  # -Fc : format custom (compact, supporte pg_restore --jobs= en parallèle).
  # -Z 6 : compression zlib niveau 6 (équilibre vitesse/ratio).
  # --no-owner --no-acl : portable entre clusters (re-créera avec l'owner du restore).
  docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" -i "$DB_CONTAINER" \
    pg_dump -h localhost -U "$POSTGRES_USER" -d "$DB" \
    -Fc -Z 6 --no-owner --no-acl \
    > "$DAY_DIR/$DUMP_FILE"
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
