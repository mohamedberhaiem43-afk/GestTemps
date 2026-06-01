#!/usr/bin/env bash
# =============================================================================
# Backup quotidien : volume uploads_data + dump master + dump tous les tenants
#
# - Pré-requis : exécuté sur l'hôte Docker, avec accès au socket docker.
# - Sortie : fichiers dans BACKUP_DIR (env var ou /var/backups/abrpoint par défaut)
# - Rotation : conserve les 7 derniers jours quotidiens + 4 hebdo + 6 mensuels.
# - À planifier via cron : `0 3 * * * /opt/abrpoint/scripts/backup.sh >> /var/log/abrpoint-backup.log 2>&1`
#
# RGPD Art. 32 — « Sauvegardes quotidiennes chiffrées hors site (S3 EU), avec
# tests de restauration au moins mensuels » :
#   - Chaque dump est chiffré CÔTÉ CLIENT en AES-256-CBC (openssl) avant
#     d'être envoyé sur S3. La clé `BACKUP_ENC_KEY` n'est jamais stockée sur
#     S3, donc même en cas de compromission du bucket les dumps restent
#     inutilisables sans le secret.
#   - Le bucket cible DOIT être en région UE (eu-west-3 Paris ou eu-central-1
#     Frankfurt) avec versioning + Object Lock activés côté infrastructure.
#   - Le test de restauration est automatisé par scripts/restore-test.sh
#     (à planifier 0 5 1 * * pour le 1er du mois).
#
# Migré SQL Server → PostgreSQL :
#   - sqlcmd BACKUP DATABASE → pg_dump (format custom -Fc, le plus compact + portable)
#   - SA_PASSWORD → POSTGRES_PASSWORD
#   - sys.databases LIKE 'ABRPOINT%' → pg_database lookup avec préfixe tenant_ ou nom master
#
# Variables d'environnement :
#   BACKUP_DIR          Dossier de sortie local (défaut: /var/backups/abrpoint)
#   POSTGRES_PASSWORD   Mot de passe du superuser Postgres (depuis docker-compose.yml)
#   POSTGRES_USER       User Postgres (défaut: abrpoint)
#   DB_CONTAINER        Nom du conteneur Postgres (défaut: abrpoint.database)
#   SERVER_CONTAINER    Nom du conteneur backend (défaut: abrpoint.server)
#   BACKUP_ENC_KEY      Clé symétrique 32+ chars (sortie de `openssl rand -base64 48`).
#                       REQUISE : si absente, le script ne pousse pas sur S3 et n'écrit
#                       que des dumps en clair locaux (mode dev/legacy).
#   S3_BUCKET           Bucket cible (ex: abrpoint-backups-eu). Optionnel : si vide,
#                       upload distant désactivé (mode purement local).
#   S3_PREFIX           Préfixe S3 (défaut: prod/). Permet de séparer par environnement.
#   AWS_DEFAULT_REGION  Région AWS (DOIT être UE, défaut: eu-west-3).
# =============================================================================

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/abrpoint}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"
POSTGRES_USER="${POSTGRES_USER:-abrpoint}"
DB_CONTAINER="${DB_CONTAINER:-abrpoint.database}"
SERVER_CONTAINER="${SERVER_CONTAINER:-abrpoint.server}"
BACKUP_ENC_KEY="${BACKUP_ENC_KEY:-}"
S3_BUCKET="${S3_BUCKET:-}"
S3_PREFIX="${S3_PREFIX:-prod/}"
AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-eu-west-3}"
export AWS_DEFAULT_REGION
TIMESTAMP="$(date +%F_%H%M%S)"
DAY_DIR="${BACKUP_DIR}/daily/${TIMESTAMP}"

if [[ -z "$POSTGRES_PASSWORD" ]]; then
  echo "[ERR] POSTGRES_PASSWORD env var requise — abandon." >&2
  exit 1
fi

# Garde-fou région UE : on refuse d'expédier hors UE même si l'opérateur
# se trompe en passant `us-east-1` à la barre du clavier.
case "$AWS_DEFAULT_REGION" in
  eu-*) : ;;
  *)
    echo "[ERR] AWS_DEFAULT_REGION=$AWS_DEFAULT_REGION n'est pas une région UE. Abandon (RGPD)." >&2
    exit 1
    ;;
esac

UPLOAD_ENABLED=1
if [[ -z "$S3_BUCKET" || -z "$BACKUP_ENC_KEY" ]]; then
  UPLOAD_ENABLED=0
  echo "[WARN] S3_BUCKET ou BACKUP_ENC_KEY absent → upload distant désactivé."
  echo "[WARN] Mode local uniquement (rétention 7/4/6 mois). Configurer pour conformité Art. 32."
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

# ── 1bis. Modèles de contrat/lettres édités (volume vault_templates_data) ────
# Stockés en fichiers HTML dans /app/VaultTemplates (hors Postgres), donc non
# couverts par pg_dump. Le `|| true` évite d'échouer le backup si le volume
# n'existe pas encore (ancienne installation sans le volume).
echo "[$(date -Iseconds)] Modèles VaultTemplates → vault-templates.tar.gz"
docker run --rm \
  -v abrpoint_vault_templates_data:/data:ro \
  -v "$DAY_DIR":/backup \
  alpine:3 \
  sh -c "tar czf /backup/vault-templates.tar.gz -C /data ." || \
  echo "[WARN] volume abrpoint_vault_templates_data introuvable — modèles non sauvegardés"

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
  echo "[WARN] Aucune base abrpoint_master ni tenant_* enregistrée" >&2
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

# ── 3.bis. Chiffrement AES-256-CBC + upload S3 EU ────────────────────────────
# On chiffre AVANT l'upload (chiffrement côté client) : même si le bucket est
# compromis ou que les credentials AWS fuient, les dumps restent inutilisables
# sans BACKUP_ENC_KEY. PBKDF2 100k itérations contre les attaques brute-force
# sur la passphrase.
if [[ "$UPLOAD_ENABLED" == "1" ]]; then
  if ! command -v openssl >/dev/null 2>&1; then
    echo "[ERR] openssl manquant — install: apt-get install openssl" >&2
    exit 1
  fi
  if ! command -v aws >/dev/null 2>&1; then
    echo "[ERR] aws CLI manquant — install: apt-get install awscli" >&2
    exit 1
  fi

  ENC_DIR="${DAY_DIR}.enc"
  mkdir -p "$ENC_DIR"
  echo "[$(date -Iseconds)] Chiffrement AES-256-CBC → $ENC_DIR"
  for FILE in "$DAY_DIR"/*; do
    NAME=$(basename "$FILE")
    # -salt + -pbkdf2 + -iter 100000 : durcissement contre les attaques offline
    # si la clé est devinable. -in/-out streamés, pas de duplication en RAM.
    openssl enc -aes-256-cbc -salt -pbkdf2 -iter 100000 \
      -pass env:BACKUP_ENC_KEY \
      -in "$FILE" -out "${ENC_DIR}/${NAME}.enc"
  done

  # Manifest des fichiers chiffrés (pour vérifier l'intégrité côté S3 sans
  # devoir déchiffrer pour comparer).
  (cd "$ENC_DIR" && sha256sum * > manifest.sha256)

  echo "[$(date -Iseconds)] Upload S3 → s3://${S3_BUCKET}/${S3_PREFIX}daily/${TIMESTAMP}/"
  # --only-show-errors : verbeux par fichier inutile, --no-progress pour cron.
  # Server-side encryption AES-256 en plus (defense-in-depth, même si nos
  # fichiers sont déjà chiffrés côté client).
  aws s3 cp "$ENC_DIR" "s3://${S3_BUCKET}/${S3_PREFIX}daily/${TIMESTAMP}/" \
    --recursive \
    --sse AES256 \
    --only-show-errors

  # On garde le dossier chiffré local le temps de la rotation (find ... -mtime),
  # ça évite de re-chiffrer pour un éventuel ré-upload manuel.
fi

# ── 4. Rotation : 7 quotidiens, 4 hebdo (lundi), 6 mensuels (1er du mois) ─────
echo "[$(date -Iseconds)] Rotation"
find "$BACKUP_DIR/daily" -maxdepth 1 -type d -mtime +7 -exec rm -rf {} \;
find "$BACKUP_DIR/daily" -maxdepth 1 -type d -name "*.enc" -mtime +7 -exec rm -rf {} \;
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
if [[ "$UPLOAD_ENABLED" == "1" ]]; then
  echo "[$(date -Iseconds)] ✅ Upload S3 EU terminé : s3://${S3_BUCKET}/${S3_PREFIX}daily/${TIMESTAMP}/"
fi
