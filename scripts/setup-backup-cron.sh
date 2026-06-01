#!/usr/bin/env bash
# =============================================================================
# Installe la PLANIFICATION des sauvegardes Concorde Workforce sur l'hôte Docker.
#
# Complète scripts/backup.sh (sauvegarde quotidienne) et scripts/restore-test.sh
# (test de restauration mensuel) : sans planification, ces scripts existent mais
# ne s'exécutent jamais. Ce script met en place :
#
#   1. /etc/abrpoint/backup.env       — fichier de secrets (créé si absent, 600)
#   2. Timers systemd (par défaut) OU job cron (fallback si pas de systemd) :
#        • backup        → tous les jours à 03:00
#        • restore-test  → le 1er de chaque mois à 05:00 (RGPD Art. 32)
#   3. /etc/logrotate.d/abrpoint-backup — rotation des logs.
#
# Idempotent : ré-exécutable pour mettre à jour la planification (n'écrase PAS
# /etc/abrpoint/backup.env s'il existe déjà — vos secrets sont préservés).
#
# Usage (root) :
#   sudo bash scripts/setup-backup-cron.sh
#   sudo bash scripts/setup-backup-cron.sh --run-now   # + lance un backup de test
#
# Vérifier ensuite :
#   systemctl list-timers 'abrpoint-*'
#   journalctl -u abrpoint-backup -n 50
# =============================================================================

set -euo pipefail

# Adresse d'alerte par défaut (surchargée par --email=… ou par ALERT_EMAIL dans
# /etc/abrpoint/backup.env).
ALERT_EMAIL="mohamed@concorde-work-force.com"
RUN_NOW=0
for arg in "$@"; do
  case "$arg" in
    --run-now)   RUN_NOW=1 ;;
    --email=*)   ALERT_EMAIL="${arg#--email=}" ;;
    *) echo "[ERR] argument inconnu: $arg (attendus: --run-now, --email=ADRESSE)" >&2; exit 1 ;;
  esac
done

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "[ERR] Ce script doit être lancé en root (sudo)." >&2
  exit 1
fi

# Répertoire réel de ce script → on en déduit les chemins absolus de backup.sh
# et restore-test.sh (pas de dépendance à /opt/abrpoint : on supporte une install
# dans n'importe quel dossier cloné).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SH="${SCRIPT_DIR}/backup.sh"
RESTORE_TEST_SH="${SCRIPT_DIR}/restore-test.sh"
ENV_FILE="/etc/abrpoint/backup.env"
BACKUP_LOG="/var/log/abrpoint-backup.log"
RESTORE_LOG="/var/log/abrpoint-restore-test.log"

for f in "$BACKUP_SH" "$RESTORE_TEST_SH"; do
  [[ -f "$f" ]] || { echo "[ERR] introuvable: $f" >&2; exit 1; }
  chmod +x "$f"
done

echo "═══ Installation de la planification des sauvegardes ═══"
echo "    scripts        : $SCRIPT_DIR"
echo "    fichier env    : $ENV_FILE"

# ── 1. Fichier de secrets ────────────────────────────────────────────────────
mkdir -p /etc/abrpoint
if [[ -f "$ENV_FILE" ]]; then
  echo "[1/4] $ENV_FILE existe déjà — conservé (secrets préservés)."
else
  echo "[1/4] Création de $ENV_FILE (à compléter)…"
  REPO_TEMPLATE="$(cd "$SCRIPT_DIR/.." && pwd)/.env.backup.example"
  if [[ -f "$REPO_TEMPLATE" ]]; then
    install -m 600 -o root -g root "$REPO_TEMPLATE" "$ENV_FILE"
  else
    # Template minimal si .env.backup.example n'a pas été déployé sur l'hôte.
    cat > "$ENV_FILE" <<EOF
ALERT_EMAIL=${ALERT_EMAIL}
POSTGRES_PASSWORD=CHANGE_ME_min32chars_random
POSTGRES_USER=abrpoint
DB_CONTAINER=abrpoint.database
SERVER_CONTAINER=abrpoint.server
BACKUP_DIR=/var/backups/abrpoint
BACKUP_ENC_KEY=
S3_BUCKET=
S3_PREFIX=prod/
AWS_DEFAULT_REGION=eu-west-3
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
EOF
    chmod 600 "$ENV_FILE"
  fi
  echo "    ⚠ Renseignez au minimum POSTGRES_PASSWORD dans $ENV_FILE avant la"
  echo "      prochaine exécution, sinon le backup échouera."
fi

# Garantir la présence d'ALERT_EMAIL dans le fichier d'env (installs existantes
# créées avant l'ajout des alertes) — sans écraser une valeur déjà renseignée.
if ! grep -q '^ALERT_EMAIL=' "$ENV_FILE"; then
  echo "ALERT_EMAIL=${ALERT_EMAIL}" >> "$ENV_FILE"
  echo "    + ALERT_EMAIL=${ALERT_EMAIL} ajouté à $ENV_FILE"
fi

# ── 1bis. Mailer + script d'alerte (envoi email si échec) ────────────────────
# Le script ci-dessous est appelé par OnFailure= (systemd) ou par le wrapper
# cron. Il lit ALERT_EMAIL depuis $ENV_FILE et envoie un mail avec les derniers
# logs de l'unité en échec.
if ! command -v mail >/dev/null 2>&1; then
  echo "[1bis] Aucun mailer 'mail' détecté → tentative d'installation (bsd-mailx)…"
  if command -v apt-get >/dev/null 2>&1; then
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq bsd-mailx >/dev/null 2>&1 \
      || echo "    ⚠ Installation de bsd-mailx impossible — installez un mailer + relais SMTP pour recevoir les alertes."
  else
    echo "    ⚠ apt indisponible — installez 'mailx'/'mailutils' + un relais SMTP manuellement."
  fi
fi

ALERT_SCRIPT="/usr/local/bin/abrpoint-backup-alert.sh"
echo "[1bis] Déploiement du script d'alerte → $ALERT_SCRIPT"
cat > "$ALERT_SCRIPT" <<EOF
#!/usr/bin/env bash
# Auto-généré par setup-backup-cron.sh — envoie un email quand une sauvegarde
# ou un test de restauration échoue. \$1 = nom de l'unité/job en échec.
set -uo pipefail
UNIT="\${1:-abrpoint-backup}"
ENV_FILE="${ENV_FILE}"
ALERT_EMAIL="${ALERT_EMAIL}"
# Surcharge éventuelle depuis le fichier d'env (sans casser le script s'il manque).
if [[ -f "\$ENV_FILE" ]]; then set -a; . "\$ENV_FILE" 2>/dev/null || true; set +a; fi
ALERT_EMAIL="\${ALERT_EMAIL:-${ALERT_EMAIL}}"
HOST="\$(hostname -f 2>/dev/null || hostname)"
SUBJECT="[ABRPOINT] ÉCHEC \${UNIT} sur \${HOST}"
BODY="\$( {
  echo "Échec détecté : \${UNIT}"
  echo "Hôte          : \${HOST}"
  echo "Date          : \$(date -Iseconds)"
  echo
  echo "─── Derniers logs ───"
  if command -v journalctl >/dev/null 2>&1; then
    journalctl -u "\${UNIT}" -n 60 --no-pager 2>/dev/null || true
  fi
  for L in /var/log/abrpoint-backup.log /var/log/abrpoint-restore-test.log; do
    [[ -f "\$L" ]] && { echo; echo "─── tail \$L ───"; tail -n 30 "\$L"; }
  done
} )"
if command -v mail >/dev/null 2>&1; then
  printf '%s\n' "\$BODY" | mail -s "\$SUBJECT" "\$ALERT_EMAIL"
else
  logger -t abrpoint-backup "ALERTE \${UNIT} mais mailer absent — mail non envoyé à \${ALERT_EMAIL}"
  exit 1
fi
EOF
chmod 755 "$ALERT_SCRIPT"

# ── 2. Planification : systemd timers (préféré) ou cron (fallback) ───────────
if [[ -d /run/systemd/system ]] && command -v systemctl >/dev/null 2>&1; then
  echo "[2/4] systemd détecté → installation des timers."

  cat > /etc/systemd/system/abrpoint-backup.service <<EOF
[Unit]
Description=ABRPOINT — sauvegarde quotidienne (Postgres + volumes)
Wants=network-online.target docker.service
After=network-online.target docker.service
# Email d'alerte si le backup échoue (%n = abrpoint-backup.service).
OnFailure=abrpoint-alert@%n.service

[Service]
Type=oneshot
EnvironmentFile=${ENV_FILE}
ExecStart=${BACKUP_SH}
# Logs consultables via : journalctl -u abrpoint-backup
StandardOutput=append:${BACKUP_LOG}
StandardError=append:${BACKUP_LOG}
EOF

  cat > /etc/systemd/system/abrpoint-backup.timer <<'EOF'
[Unit]
Description=ABRPOINT — planification sauvegarde quotidienne 03:00

[Timer]
OnCalendar=*-*-* 03:00:00
Persistent=true
RandomizedDelaySec=300

[Install]
WantedBy=timers.target
EOF

  cat > /etc/systemd/system/abrpoint-restore-test.service <<EOF
[Unit]
Description=ABRPOINT — test de restauration mensuel (RGPD Art. 32)
Wants=network-online.target docker.service
After=network-online.target docker.service
OnFailure=abrpoint-alert@%n.service

[Service]
Type=oneshot
EnvironmentFile=${ENV_FILE}
ExecStart=${RESTORE_TEST_SH}
StandardOutput=append:${RESTORE_LOG}
StandardError=append:${RESTORE_LOG}
EOF

  cat > /etc/systemd/system/abrpoint-restore-test.timer <<'EOF'
[Unit]
Description=ABRPOINT — planification test de restauration (1er du mois 05:00)

[Timer]
OnCalendar=*-*-01 05:00:00
Persistent=true
RandomizedDelaySec=300

[Install]
WantedBy=timers.target
EOF

  # Unité d'alerte templatée : déclenchée par OnFailure=. %i = nom de l'unité
  # en échec (passé en argument au script d'alerte).
  cat > /etc/systemd/system/abrpoint-alert@.service <<EOF
[Unit]
Description=ABRPOINT — alerte email échec de %i

[Service]
Type=oneshot
ExecStart=${ALERT_SCRIPT} %i
EOF

  systemctl daemon-reload
  systemctl enable --now abrpoint-backup.timer abrpoint-restore-test.timer
  echo "    ✅ Timers activés."
  SCHEDULER="systemd"
else
  echo "[2/4] systemd absent → installation d'un job cron."
  command -v crontab >/dev/null 2>&1 || { echo "[ERR] ni systemd ni cron — abandon." >&2; exit 1; }
  # cron.d : on source le fichier d'env avant chaque exécution (set -a exporte
  # toutes les variables aux scripts). Champ "user" = root (accès socket docker).
  cat > /etc/cron.d/abrpoint-backup <<EOF
# Auto-généré par setup-backup-cron.sh — NE PAS éditer à la main.
SHELL=/bin/bash
# Sauvegarde quotidienne 03:00 — alerte email via le script d'alerte si échec.
0 3 * * * root set -a; . ${ENV_FILE}; ${BACKUP_SH} >> ${BACKUP_LOG} 2>&1 || ${ALERT_SCRIPT} abrpoint-backup
# Test de restauration mensuel — 1er du mois 05:00.
0 5 1 * * root set -a; . ${ENV_FILE}; ${RESTORE_TEST_SH} >> ${RESTORE_LOG} 2>&1 || ${ALERT_SCRIPT} abrpoint-restore-test
EOF
  chmod 644 /etc/cron.d/abrpoint-backup
  echo "    ✅ /etc/cron.d/abrpoint-backup installé."
  SCHEDULER="cron"
fi

# ── 3. Rotation des logs ─────────────────────────────────────────────────────
echo "[3/4] Configuration logrotate…"
cat > /etc/logrotate.d/abrpoint-backup <<EOF
${BACKUP_LOG} ${RESTORE_LOG} {
    weekly
    rotate 12
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
EOF

# ── 4. Validation / exécution immédiate optionnelle ──────────────────────────
echo "[4/4] Terminé."
if [[ "$RUN_NOW" == "1" ]]; then
  echo "    Lancement d'un backup de validation…"
  if [[ "$SCHEDULER" == "systemd" ]]; then
    systemctl start abrpoint-backup.service && echo "    ✅ Backup déclenché (voir: journalctl -u abrpoint-backup -n 50)."
  else
    ( set -a; . "$ENV_FILE"; "$BACKUP_SH" ) && echo "    ✅ Backup exécuté."
  fi
fi

echo
echo "═══ Vérifications ═══"
if [[ "$SCHEDULER" == "systemd" ]]; then
  echo "  • Prochaines exécutions :  systemctl list-timers 'abrpoint-*'"
  echo "  • Logs backup          :  journalctl -u abrpoint-backup -n 50   (ou ${BACKUP_LOG})"
  echo "  • Lancer maintenant    :  sudo systemctl start abrpoint-backup.service"
  echo "  • Désactiver           :  sudo systemctl disable --now abrpoint-backup.timer"
else
  echo "  • Planification        :  cat /etc/cron.d/abrpoint-backup"
  echo "  • Logs backup          :  tail -F ${BACKUP_LOG}"
fi
echo "  • Secrets              :  sudo nano ${ENV_FILE}   (POSTGRES_PASSWORD requis)"
echo "  • Sauvegardes locales  :  ls -lh /var/backups/abrpoint/daily/"
echo "  • Alerte échec → email :  ${ALERT_EMAIL}"
echo "  • Tester l'alerte mail :  sudo ${ALERT_SCRIPT} abrpoint-backup"
echo "    (nécessite un mailer 'mail' + relais SMTP fonctionnel sur l'hôte)"
