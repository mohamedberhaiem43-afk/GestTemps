#!/usr/bin/env bash
# =============================================================================
# Seed d'un compte admin de TEST — SANS Stripe.
#
# Crée un tenant complet (société + base dédiée + admin "AD") via l'endpoint
# self-service /api/signup, qui fonctionne déjà sans paiement : tout nouveau
# tenant entre en essai « Trialing » 30 jours sans carte bancaire, et le billing
# Stripe est best-effort (no-op si Stripe non configuré, cf. SignupController).
#
# Le script :
#   1. attend que l'app réponde,
#   2. résout le captcha arithmétique anti-bot automatiquement,
#   3. POST /api/signup (pays MA → SIRET validé en format seul, aucun appel
#      externe : fonctionne sur un serveur de test isolé sans Internet),
#   4. flippe uti_email_verified='1' dans la base du tenant — sinon la connexion
#      est refusée tant que l'OTP email n'est pas validé (et sans SMTP l'OTP
#      n'est jamais reçu).
#
# Pré-requis : exécuté sur l'hôte Docker, stack démarrée via
#   docker compose -f docker-compose.test.yml --env-file .env.test up -d
#
# Usage :
#   ./scripts/seed-test-admin.sh
#   (lit .env.test ; les valeurs SEED_* / APP_PORT / POSTGRES_USER y sont définies)
# =============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."

COMPOSE_FILE="docker-compose.test.yml"
ENV_FILE="${ENV_FILE:-.env.test}"

# Charge .env.test si présent (export auto des variables).
if [ -f "$ENV_FILE" ]; then
  set -a; . "$ENV_FILE"; set +a
fi

APP_PORT="${APP_PORT:-8088}"
POSTGRES_USER="${POSTGRES_USER:-abrpoint}"
BASE_URL="${BASE_URL:-http://localhost:${APP_PORT}}"

SEED_SLUG="${SEED_SLUG:-demo}"
SEED_COMPANY="${SEED_COMPANY:-Société Démo}"
SEED_ADMIN_EMAIL="${SEED_ADMIN_EMAIL:-admin@demo.test}"
SEED_ADMIN_PASSWORD="${SEED_ADMIN_PASSWORD:-Demo!Passw0rd2026}"
SEED_ADMIN_FIRSTNAME="${SEED_ADMIN_FIRSTNAME:-Admin}"
SEED_ADMIN_LASTNAME="${SEED_ADMIN_LASTNAME:-Démo}"

# SIRET « Maroc » : 15 chiffres, validé en format uniquement (pas d'appel API).
# Pseudo-aléatoire pour éviter le conflit d'unicité si on relance le script.
SEED_SIRET="${SEED_SIRET:-$(printf '1%014d' "$(( (RANDOM*RANDOM) % 100000000000000 ))")}"

log()  { printf '\033[1;34m[seed]\033[0m %s\n' "$*"; }
err()  { printf '\033[1;31m[seed] ERREUR:\033[0m %s\n' "$*" >&2; }
psqlx() { docker compose -f "$COMPOSE_FILE" exec -T abrpoint.database psql -U "$POSTGRES_USER" "$@"; }

# ── 1. Attente de l'app ────────────────────────────────────────────────────
log "Attente de l'API sur ${BASE_URL} ..."
for i in $(seq 1 60); do
  if curl -fsS -o /dev/null "${BASE_URL}/api/signup/captcha" 2>/dev/null; then
    break
  fi
  if [ "$i" = 60 ]; then err "L'API ne répond pas après 60 tentatives. La stack est-elle démarrée ?"; exit 1; fi
  sleep 3
done

# ── 2. Captcha ──────────────────────────────────────────────────────────────
log "Résolution du captcha anti-bot ..."
CAPTCHA_JSON="$(curl -fsS "${BASE_URL}/api/signup/captcha")"
CHALLENGE_ID="$(printf '%s' "$CAPTCHA_JSON" | sed -n 's/.*"challengeId":"\([^"]*\)".*/\1/p')"
QUESTION="$(printf '%s' "$CAPTCHA_JSON" | sed -n 's/.*"question":"\([^"]*\)".*/\1/p')"
if [ -z "$CHALLENGE_ID" ] || [ -z "$QUESTION" ]; then err "Captcha illisible : $CAPTCHA_JSON"; exit 1; fi

A="$(printf '%s' "$QUESTION" | awk '{print $1}')"
OP="$(printf '%s' "$QUESTION" | awk '{print $2}')"
B="$(printf '%s' "$QUESTION" | awk '{print $3}')"
case "$OP" in
  "+")            ANSWER=$(( A + B )) ;;
  "×"|"x"|"*")    ANSWER=$(( A * B )) ;;   # × = U+00D7
  *)              ANSWER=$(( A - B )) ;;   # − = U+2212 (ou '-')
esac
log "Captcha : ${QUESTION} = ${ANSWER}"

# ── 3. Signup (sans Stripe) ──────────────────────────────────────────────────
log "Création du tenant '${SEED_SLUG}' (essai 30j, sans Stripe) ..."
PAYLOAD=$(cat <<JSON
{
  "slug": "${SEED_SLUG}",
  "companyName": "${SEED_COMPANY}",
  "adminFirstName": "${SEED_ADMIN_FIRSTNAME}",
  "adminLastName": "${SEED_ADMIN_LASTNAME}",
  "adminEmail": "${SEED_ADMIN_EMAIL}",
  "adminPassword": "${SEED_ADMIN_PASSWORD}",
  "country": "MA",
  "siret": "${SEED_SIRET}",
  "captchaChallengeId": "${CHALLENGE_ID}",
  "captchaAnswer": ${ANSWER}
}
JSON
)

HTTP_CODE="$(curl -sS -o /tmp/seed_signup_resp.json -w '%{http_code}' \
  -X POST "${BASE_URL}/api/signup" \
  -H 'Content-Type: application/json' \
  -d "$PAYLOAD")"
RESP="$(cat /tmp/seed_signup_resp.json)"

case "$HTTP_CODE" in
  201) log "Tenant créé." ;;
  409)
    # Slug/email/SIRET déjà pris : on suppose un re-run → on continue jusqu'au
    # flip email-verified pour garantir un compte connectable.
    log "Le tenant existe déjà (HTTP 409) — on revalide simplement le compte." ;;
  429)
    # Rate limit signup (3/h/IP). Le tenant a peut-être déjà été créé lors d'un
    # run précédent : on tente quand même le flip email-verified ci-dessous.
    log "Rate limit signup atteint (HTTP 429) — on tente la revalidation du compte existant." ;;
  *)
    err "Signup échoué (HTTP ${HTTP_CODE}): ${RESP}"
    err "Astuce : si le code parle de mot de passe compromis (HIBP), changez SEED_ADMIN_PASSWORD dans .env.test."
    exit 1 ;;
esac

# ── 4. Validation email forcée (sinon login refusé) ──────────────────────────
log "Résolution de la base du tenant dans le master ..."
DB_NAME="$(psqlx -d abrpoint_master -tAc \
  "SELECT \"DbName\" FROM \"Tenants\" WHERE \"Slug\"='${SEED_SLUG}' ORDER BY \"CreatedAt\" DESC LIMIT 1;" \
  | tr -d '[:space:]')"
if [ -z "$DB_NAME" ]; then err "Base du tenant introuvable pour le slug '${SEED_SLUG}'."; exit 1; fi
log "Base tenant : ${DB_NAME}"

log "Validation de l'email de l'admin (uti_email_verified=1) ..."
psqlx -d "$DB_NAME" -c \
  "UPDATE utilisateur SET uti_email_verified='1', uti_failed_logins=0, uti_lockout_until=NULL WHERE uticod='AD';" >/dev/null

# Bonus : statut Trialing → Active pour éviter tout rappel d'essai pendant les tests.
psqlx -d abrpoint_master -c \
  "UPDATE \"Tenants\" SET \"Status\"='Active' WHERE \"Slug\"='${SEED_SLUG}' AND \"Status\"='Trialing';" >/dev/null || true

# ── Récap ────────────────────────────────────────────────────────────────────
printf '\n\033[1;32m✓ Compte admin de test prêt — connexion sans Stripe.\033[0m\n\n'
printf '  URL          : %s/login\n'   "$BASE_URL"
printf '  Email        : %s\n'          "$SEED_ADMIN_EMAIL"
printf '  Mot de passe : %s\n'          "$SEED_ADMIN_PASSWORD"
printf '  Tenant slug  : %s\n\n'        "$SEED_SLUG"
printf 'La page de login résout le tenant à partir de l'\''email (aucun sous-domaine\n'
printf 'requis) et stocke le slug dans localStorage('\''tenantSlug'\''). Connectez-vous\n'
printf 'simplement avec l'\''email + mot de passe ci-dessus.\n\n'
