#!/usr/bin/env bash
# Restauration depuis un dossier de backup généré par backup.sh.
#
# Usage : ./restore.sh /var/backups/abrpoint/daily/2026-05-10_030000
#
# - Restaure le volume uploads_data (efface le contenu existant)
# - Restaure chaque .dump Postgres (DROP DATABASE + CREATE + pg_restore --clean)
#
# ⚠ DESTRUCTIF : utiliser uniquement en cas de perte avérée.
#
# Migré SQL Server → PostgreSQL :
#   - sqlcmd RESTORE DATABASE → pg_restore -d <db> --clean
#   - ALTER DATABASE SINGLE_USER → DROP DATABASE WITH (FORCE) (PG 13+)
#   - SA_PASSWORD → POSTGRES_PASSWORD ; sa → abrpoint user
#   - .bak → .dump (format custom -Fc utilisé par backup.sh)

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <backup_dir>" >&2
  exit 1
fi

DIR="$1"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"
POSTGRES_USER="${POSTGRES_USER:-abrpoint}"
DB_CONTAINER="${DB_CONTAINER:-abrpoint.database}"

if [[ ! -d "$DIR" ]]; then
  echo "[ERR] Backup dir introuvable : $DIR" >&2
  exit 1
fi

if [[ -z "$POSTGRES_PASSWORD" ]]; then
  echo "[ERR] POSTGRES_PASSWORD env var requise." >&2
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

# Postgres .dump files (format custom de pg_dump -Fc)
for DUMP in "$DIR"/*.dump; do
  [[ -f "$DUMP" ]] || continue
  FILENAME=$(basename "$DUMP")
  # Extrait le nom de la DB en strippant le suffixe _<timestamp>.dump
  DB=$(echo "$FILENAME" | sed -E 's/_[0-9-]+_[0-9]+\.dump$//')
  echo "[INFO] Restauration $DB ← $FILENAME"

  # 1) Copie le dump dans le conteneur Postgres.
  docker cp "$DUMP" "$DB_CONTAINER:/tmp/$FILENAME"

  # 2) DROP DATABASE (+ FORCE pour tuer les connexions actives, équivalent
  #    SINGLE_USER WITH ROLLBACK IMMEDIATE). Postgres 13+. Connexion à 'postgres'
  #    (DB système toujours présente) car on ne peut pas drop la DB sur laquelle
  #    on est connecté.
  docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" -i "$DB_CONTAINER" \
    psql -h localhost -U "$POSTGRES_USER" -d postgres \
    -c "DROP DATABASE IF EXISTS \"$DB\" WITH (FORCE);" \
    || echo "[WARN] DROP $DB a échoué (ignoré, sera recréée)"

  # 3) CREATE DATABASE vide.
  docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" -i "$DB_CONTAINER" \
    psql -h localhost -U "$POSTGRES_USER" -d postgres \
    -c "CREATE DATABASE \"$DB\";"

  # 4) pg_restore. --no-owner --no-acl pour rester portable entre clusters (utile
  #    si on restore depuis un backup d'un autre cluster avec d'autres rôles).
  #    --clean : drop les objets avant de les recréer (no-op ici puisque DB neuve).
  docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" -i "$DB_CONTAINER" \
    pg_restore -h localhost -U "$POSTGRES_USER" -d "$DB" \
    --no-owner --no-acl \
    "/tmp/$FILENAME" \
    || echo "[WARN] Échec restauration $DB"

  # Nettoyage du fichier dans le conteneur (sinon le tmpfs grossit)
  docker exec -i "$DB_CONTAINER" rm -f "/tmp/$FILENAME" || true
done

echo "[$(date -Iseconds)] ✅ Restauration terminée"
