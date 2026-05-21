#!/usr/bin/env bash
# =============================================================================
# Test de restauration mensuel automatisé — RGPD Art. 32
#
# « Sauvegardes quotidiennes chiffrées hors site (S3 EU), avec tests de
# restauration au moins mensuels ». Ce script :
#   1. Télécharge le backup S3 le plus récent ;
#   2. Le déchiffre dans un dossier temporaire ;
#   3. Restaure dans une base PostgreSQL JETABLE (préfixe `restoretest_`) ;
#   4. Compte les tables et lignes principales pour valider le contenu ;
#   5. Drop la base de test ;
#   6. Écrit un rapport `restore-test-<date>.log` (à archiver pour la CNIL).
#
# Le script NE touche JAMAIS à la base de production. La restauration se fait
# dans une instance Postgres dédiée (variable `TEST_DB_CONTAINER`) ou, à
# défaut, dans le conteneur principal avec un nom de base différent.
#
# Cron suggéré (1er du mois à 05:00) :
#   0 5 1 * * /opt/abrpoint/scripts/restore-test.sh \
#     >> /var/log/abrpoint-restore-test.log 2>&1
#
# Variables d'environnement (héritées de backup.sh) :
#   S3_BUCKET, S3_PREFIX, BACKUP_ENC_KEY, AWS_DEFAULT_REGION,
#   POSTGRES_PASSWORD, POSTGRES_USER, TEST_DB_CONTAINER (défaut: abrpoint.database)
# =============================================================================

set -euo pipefail

S3_BUCKET="${S3_BUCKET:-}"
S3_PREFIX="${S3_PREFIX:-prod/}"
BACKUP_ENC_KEY="${BACKUP_ENC_KEY:-}"
AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-eu-west-3}"
export AWS_DEFAULT_REGION
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"
POSTGRES_USER="${POSTGRES_USER:-abrpoint}"
TEST_DB_CONTAINER="${TEST_DB_CONTAINER:-abrpoint.database}"
REPORT_DIR="${REPORT_DIR:-/var/log/abrpoint-restore-tests}"
TIMESTAMP="$(date +%F_%H%M%S)"
WORK_DIR="$(mktemp -d -t abrpoint-restore-XXXXXX)"
trap 'rm -rf "$WORK_DIR"' EXIT

mkdir -p "$REPORT_DIR"
REPORT="$REPORT_DIR/restore-test-${TIMESTAMP}.log"
exec > >(tee -a "$REPORT") 2>&1

echo "═══ Test de restauration — $(date -Iseconds) ═══"

# ── 0. Pré-requis ─────────────────────────────────────────────────────────────
for cmd in aws openssl docker; do
  if ! command -v "$cmd" >/dev/null; then
    echo "[ERR] commande requise manquante : $cmd"
    exit 1
  fi
done
[[ -z "$S3_BUCKET"        ]] && { echo "[ERR] S3_BUCKET requis"; exit 1; }
[[ -z "$BACKUP_ENC_KEY"   ]] && { echo "[ERR] BACKUP_ENC_KEY requis"; exit 1; }
[[ -z "$POSTGRES_PASSWORD" ]] && { echo "[ERR] POSTGRES_PASSWORD requis"; exit 1; }

# ── 1. Localiser le dernier backup S3 ─────────────────────────────────────────
echo "[INFO] Énumération s3://${S3_BUCKET}/${S3_PREFIX}daily/ …"
LATEST_DIR=$(aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}daily/" \
  | awk '{print $2}' | tr -d '/' | sort | tail -1)
if [[ -z "$LATEST_DIR" ]]; then
  echo "[ERR] Aucun backup S3 trouvé sous ${S3_PREFIX}daily/"
  exit 1
fi
echo "[INFO] Backup retenu : $LATEST_DIR"

# ── 2. Téléchargement ─────────────────────────────────────────────────────────
DL_DIR="$WORK_DIR/dl"
mkdir -p "$DL_DIR"
aws s3 cp "s3://${S3_BUCKET}/${S3_PREFIX}daily/${LATEST_DIR}/" "$DL_DIR/" --recursive --only-show-errors

# ── 3. Vérification manifest ──────────────────────────────────────────────────
if [[ -f "$DL_DIR/manifest.sha256" ]]; then
  echo "[INFO] Vérification SHA-256 du manifest…"
  (cd "$DL_DIR" && sha256sum -c manifest.sha256)
fi

# ── 4. Déchiffrement AES-256-CBC ──────────────────────────────────────────────
DEC_DIR="$WORK_DIR/dec"
mkdir -p "$DEC_DIR"
echo "[INFO] Déchiffrement…"
for FILE in "$DL_DIR"/*.enc; do
  [[ -f "$FILE" ]] || continue
  NAME=$(basename "$FILE" .enc)
  openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 \
    -pass env:BACKUP_ENC_KEY \
    -in "$FILE" -out "$DEC_DIR/$NAME"
done

# ── 5. Restauration dans une base jetable ─────────────────────────────────────
RESTORED_OK=0
RESTORED_TOTAL=0
for DUMP in "$DEC_DIR"/*.dump; do
  [[ -f "$DUMP" ]] || continue
  RESTORED_TOTAL=$((RESTORED_TOTAL + 1))

  FILENAME=$(basename "$DUMP")
  ORIG_DB=$(echo "$FILENAME" | sed -E 's/_[0-9-]+_[0-9]+\.dump$//')
  TEST_DB="restoretest_${ORIG_DB}_${TIMESTAMP}"
  TEST_DB=$(echo "$TEST_DB" | cut -c1-63) # PG limite 63 chars

  echo "[INFO] Restauration $ORIG_DB → $TEST_DB"
  docker cp "$DUMP" "$TEST_DB_CONTAINER:/tmp/$FILENAME"

  # Crée la base de test
  docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" -i "$TEST_DB_CONTAINER" \
    psql -h localhost -U "$POSTGRES_USER" -d postgres \
    -c "DROP DATABASE IF EXISTS \"$TEST_DB\" WITH (FORCE);" >/dev/null 2>&1 || true
  docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" -i "$TEST_DB_CONTAINER" \
    psql -h localhost -U "$POSTGRES_USER" -d postgres \
    -c "CREATE DATABASE \"$TEST_DB\";" >/dev/null

  # Restore. On capture le code de retour ; pg_restore peut renvoyer 1 sur
  # warnings non-bloquants (objets déjà existants), on regarde la sortie.
  if docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" -i "$TEST_DB_CONTAINER" \
      pg_restore -h localhost -U "$POSTGRES_USER" -d "$TEST_DB" \
      --no-owner --no-acl \
      "/tmp/$FILENAME" 2>&1; then
    echo "[OK]  Restauration $TEST_DB réussie"
  else
    echo "[WARN] pg_restore $TEST_DB a renvoyé une erreur, vérification du contenu…"
  fi

  # Sanity check : compte les tables et la table utilisateurs si présente.
  TABLE_COUNT=$(docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" -i "$TEST_DB_CONTAINER" \
    psql -h localhost -U "$POSTGRES_USER" -d "$TEST_DB" -t -A \
    -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null || echo 0)
  USER_COUNT=$(docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" -i "$TEST_DB_CONTAINER" \
    psql -h localhost -U "$POSTGRES_USER" -d "$TEST_DB" -t -A \
    -c "SELECT COUNT(*) FROM utilisateurs;" 2>/dev/null || echo "n/a")

  echo "        Tables: $TABLE_COUNT — Utilisateurs: $USER_COUNT"
  if [[ "$TABLE_COUNT" -gt 0 ]]; then
    RESTORED_OK=$((RESTORED_OK + 1))
  fi

  # Cleanup : drop la DB de test (on ne garde rien après le test).
  docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" -i "$TEST_DB_CONTAINER" \
    psql -h localhost -U "$POSTGRES_USER" -d postgres \
    -c "DROP DATABASE IF EXISTS \"$TEST_DB\" WITH (FORCE);" >/dev/null
  docker exec -i "$TEST_DB_CONTAINER" rm -f "/tmp/$FILENAME" >/dev/null || true
done

# ── 6. Verdict ────────────────────────────────────────────────────────────────
echo ""
echo "═══ Verdict ═══"
echo "  Source S3      : s3://${S3_BUCKET}/${S3_PREFIX}daily/${LATEST_DIR}/"
echo "  Dumps restaurés: $RESTORED_OK / $RESTORED_TOTAL"
echo "  Rapport        : $REPORT"

if [[ "$RESTORED_OK" -lt "$RESTORED_TOTAL" || "$RESTORED_TOTAL" -eq 0 ]]; then
  echo "❌ ÉCHEC — au moins une base n'a pas été restaurée correctement"
  exit 2
fi

echo "✅ Test de restauration mensuel : OK"
