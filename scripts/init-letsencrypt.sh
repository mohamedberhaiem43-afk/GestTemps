#!/usr/bin/env bash
# =============================================================================
# Bootstrap Let's Encrypt — émission initiale des certificats SANS jamais
# commenter le bloc SSL dans nginx.conf.
#
# LE PROBLÈME RÉSOLU (œuf & poule) :
#   nginx refuse de démarrer si un `ssl_certificate` pointe vers un fichier absent.
#   Au 1er déploiement, les certs Let's Encrypt n'existent pas encore → si un bloc
#   HTTPS est actif, nginx crashe (et coupe TOUS les domaines). Mais certbot
#   --webroot a besoin que nginx tourne pour servir le challenge ACME. D'où la
#   vieille danse « commenter le bloc → déployer → émettre → décommenter ».
#
# LA SOLUTION (pattern standard docker-nginx-certbot) :
#   1. Le service `init-certs` (docker-compose.app.yml) crée, AVANT nginx, un
#      certificat AUTO-SIGNÉ TEMPORAIRE pour chaque domaine dont le vrai cert
#      n'existe pas encore. nginx démarre alors normalement, tous les blocs
#      HTTPS actifs (y compris blog.).
#   2. Ce script émet ensuite les VRAIS certificats via certbot --webroot et
#      recharge nginx. Les faux certs sont remplacés à chaud.
#   => Le bloc SSL reste décommenté EN PERMANENCE. Plus jamais d'édition manuelle.
#
# UTILISATION (sur l'hôte Docker, depuis la racine du repo) :
#   ./scripts/init-letsencrypt.sh
#
# Idempotent : un domaine qui a déjà un VRAI certificat (renewal/<dom>.conf
# présent) est sauté. Pour forcer la ré-émission : LE_FORCE=1 ./scripts/init-letsencrypt.sh
#
# Variables d'environnement :
#   LE_EMAIL    E-mail d'enregistrement Let's Encrypt (défaut: contact@concorde-tech.fr)
#   LE_STAGING  1 = environnement de TEST LE (certs non fiables mais sans rate-limit).
#               À utiliser pour valider la chaîne avant le vrai run. Défaut: 0.
#   LE_FORCE    1 = ré-émettre même si un vrai cert existe déjà. Défaut: 0.
# =============================================================================
set -euo pipefail

COMPOSE="docker compose -f docker-compose.app.yml"
EMAIL="${LE_EMAIL:-contact@concorde-tech.fr}"
STAGING="${LE_STAGING:-0}"
FORCE="${LE_FORCE:-0}"

# Domaines à certifier. Chaque entrée = "primaire[,alt1,alt2...]".
# Le certificat est stocké sous live/<primaire>/ et couvre tous les domaines listés
# (cert SAN). Le bloc HTTPS www. réutilise le cert du domaine principal.
CERTS=(
  "concorde-work-force.com,www.concorde-work-force.com"
  "blog.concorde-work-force.com"
)

staging_flag=""
[ "$STAGING" = "1" ] && { staging_flag="--staging"; echo "⚠  Mode STAGING : certificats de TEST (non fiables navigateur)."; }

# certbot dans le compose a un entrypoint "/bin/sh -c" (boucle de renouvellement).
# Pour les commandes ponctuelles ci-dessous on l'override explicitement.
certbot_run() { $COMPOSE run --rm --entrypoint certbot certbot "$@"; }
sh_in_certbot() { $COMPOSE run --rm --entrypoint /bin/sh certbot -c "$1"; }

echo "==> 1/3 Démarrage de nginx (init-certs pose les certs temporaires si besoin)…"
# `up -d nginx-proxy` déclenche automatiquement init-certs (depends_on:
# service_completed_successfully) AVANT de lancer nginx.
$COMPOSE up -d nginx-proxy

echo "==> 2/3 Émission des vrais certificats Let's Encrypt…"
for entry in "${CERTS[@]}"; do
  primary="${entry%%,*}"

  # Construit les arguments -d pour chaque domaine de l'entrée.
  d_args=()
  IFS=',' read -ra domains <<< "$entry"
  for d in "${domains[@]}"; do d_args+=("-d" "$d"); done

  # Saut idempotent : certbot ne crée renewal/<primary>.conf QUE pour un vrai cert
  # (jamais pour le faux cert auto-signé d'init-certs).
  if [ "$FORCE" != "1" ] && sh_in_certbot "test -f /etc/letsencrypt/renewal/$primary.conf" 2>/dev/null; then
    echo "    • $primary : vrai certificat déjà présent — saut (LE_FORCE=1 pour forcer)."
    continue
  fi

  echo "    • Émission pour : $entry"
  # Supprime le faux cert pour laisser certbot construire une arborescence propre
  # (live/ + archive/ + renewal/). Sans ça, certbot refuserait d'écraser le dossier.
  sh_in_certbot "rm -rf /etc/letsencrypt/live/$primary /etc/letsencrypt/archive/$primary /etc/letsencrypt/renewal/$primary.conf"

  certbot_run certonly --webroot -w /var/www/certbot \
    $staging_flag "${d_args[@]}" \
    --email "$EMAIL" --agree-tos --non-interactive
done

echo "==> 3/3 Rechargement de nginx avec les vrais certificats…"
$COMPOSE exec nginx-proxy nginx -t
$COMPOSE exec nginx-proxy nginx -s reload

echo "✅ Terminé. Certificats en place, bloc SSL blog actif, aucune édition de nginx.conf nécessaire."
echo "   Le renouvellement est automatique (service 'certbot', boucle 12h)."
