#!/usr/bin/env bash
# Restauration depuis un dossier de backup généré par backup.sh.
#
# Usage : ./restore.sh /var/backups/abrpoint/daily/2026-05-10_030000
#
# - Restaure le volume uploads_data (efface le contenu existant)
# - Restaure chaque .bak SQL (REPLACE → écrase la base existante)
#
# ⚠ DESTRUCTIF : utiliser uniquement en cas de perte avérée.

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <backup_dir>" >&2
  exit 1
fi

DIR="$1"
SQL_SA_PASSWORD="${SQL_SA_PASSWORD:-}"
DB_CONTAINER="${DB_CONTAINER:-abrpoint.database}"

if [[ ! -d "$DIR" ]]; then
  echo "[ERR] Backup dir introuvable : $DIR" >&2
  exit 1
fi

if [[ -z "$SQL_SA_PASSWORD" ]]; then
  echo "[ERR] SQL_SA_PASSWORD env var requise." >&2
  exit 1
fi

read -p "Confirmer la restauration depuis $DIR ? Cela ÉCRASE les données actuelles. [yes/NO] " CONFIRM
if [[ "$CONFIRM" != "yes" ]]; then
  echo "Abandon."
  exit 0
fi

# Vérification checksum
if [[ -f "$DIR/manifest.sha256" ]]; then
  echo "[INFO] Vérification checksums…"
  (cd "$DIR" && sha256sum -c manifest.sha256)
fi

# Uploads
if [[ -f "$DIR/uploads.tar.gz" ]]; then
  echo "[INFO] Restauration uploads…"
  docker run --rm \
    -v abrpoint_uploads_data:/data \
    -v "$DIR":/backup:ro \
    alpine:3 \
    sh -c "rm -rf /data/* && tar xzf /backup/uploads.tar.gz -C /data"
fi

# SQL .bak files
for BAK in "$DIR"/*.bak; do
  [[ -f "$BAK" ]] || continue
  FILENAME=$(basename "$BAK")
  DB=$(echo "$FILENAME" | sed -E 's/_[0-9-]+_[0-9]+\.bak$//')
  echo "[INFO] Restauration $DB"
  docker cp "$BAK" "$DB_CONTAINER:/var/opt/sql-backup/$FILENAME"
  docker exec -i "$DB_CONTAINER" /opt/mssql-tools18/bin/sqlcmd \
    -S localhost -U sa -P "$SQL_SA_PASSWORD" -C \
    -Q "ALTER DATABASE [$DB] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; RESTORE DATABASE [$DB] FROM DISK = N'/var/opt/sql-backup/$FILENAME' WITH REPLACE; ALTER DATABASE [$DB] SET MULTI_USER;" \
    || echo "[WARN] Échec restauration $DB (peut-être inexistante au moment du backup)"
done

echo "[$(date -Iseconds)] ✅ Restauration terminée"
