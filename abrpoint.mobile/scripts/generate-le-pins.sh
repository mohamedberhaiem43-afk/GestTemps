#!/usr/bin/env bash
# =============================================================================
# Télécharge les CAs Let's Encrypt officielles depuis letsencrypt.org et calcule
# les pins SHA-256 SPKI (Subject Public Key Info) au format Base64.
#
# Ce script automatise l'ensemble du processus pour `network_security_config.xml`
# (Android) et `app.json:NSPinnedCAIdentities` (iOS) :
#
#   1. Téléchargement des certs racine et intermédiaires depuis l'URL publique
#      Let's Encrypt (HTTPS — chaîne de confiance auto-vérifiable au moment
#      de l'exécution).
#   2. Calcul du hash SPKI SHA-256 en Base64 (le format standard pour le pinning).
#   3. Affichage formaté : blocs XML pour Android, valeurs pour iOS.
#
# Pourquoi ce script et pas des valeurs hardcodées :
#   - Une erreur d'un caractère dans un pin → app entièrement bloquée.
#   - Les pins sont publics et stables sur les roots (ISRG Root X1/X2) mais
#     l'opérateur doit pouvoir les vérifier indépendamment avant un build prod.
#   - Les intermédiaires (R10/R11/E5/E6) tournent et doivent être ré-extraits
#     périodiquement.
#
# Usage : ./generate-le-pins.sh
#         ./generate-le-pins.sh --include-leaf  # ajoute le leaf du domaine
# =============================================================================

set -euo pipefail

DOMAIN="${DOMAIN:-concorde-work-force.com}"
INCLUDE_LEAF=0
if [[ "${1:-}" == "--include-leaf" ]]; then
  INCLUDE_LEAF=1
fi

if ! command -v openssl >/dev/null 2>&1; then
  echo "[ERR] openssl non installé." >&2
  exit 1
fi
if ! command -v curl >/dev/null 2>&1; then
  echo "[ERR] curl non installé." >&2
  exit 1
fi

TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

# CAs publiées par Let's Encrypt — URLs stables (depuis letsencrypt.org/certificates/)
# ISRG Root X1 : RSA, racine principale LE depuis 2015, valide jusqu'en 2035.
# ISRG Root X2 : ECDSA, racine secondaire LE depuis 2020, valide jusqu'en 2035.
# R10/R11      : intermédiaires RSA actuels (signés par ISRG Root X1), valides 5 ans.
# E5/E6        : intermédiaires ECDSA actuels (signés par ISRG Root X2), valides 5 ans.
declare -A CA_URLS=(
  ["isrgrootx1"]="https://letsencrypt.org/certs/isrgrootx1.pem"
  ["isrg-root-x2"]="https://letsencrypt.org/certs/isrg-root-x2.pem"
  ["lets-encrypt-r10"]="https://letsencrypt.org/certs/2024/r10.pem"
  ["lets-encrypt-r11"]="https://letsencrypt.org/certs/2024/r11.pem"
  ["lets-encrypt-e5"]="https://letsencrypt.org/certs/2024/e5.pem"
  ["lets-encrypt-e6"]="https://letsencrypt.org/certs/2024/e6.pem"
)

compute_pin() {
  local pem_file="$1"
  openssl x509 -in "$pem_file" -pubkey -noout \
    | openssl pkey -pubin -outform der \
    | openssl dgst -sha256 -binary \
    | base64
}

echo "🔐 Calcul des pins SPKI SHA-256 pour Let's Encrypt"
echo "──────────────────────────────────────────────────────────────────"

declare -A PINS
for name in isrgrootx1 isrg-root-x2 lets-encrypt-r10 lets-encrypt-r11 lets-encrypt-e5 lets-encrypt-e6; do
  url="${CA_URLS[$name]}"
  pem="$TMPDIR/${name}.pem"
  if curl -fsSL "$url" -o "$pem"; then
    pin=$(compute_pin "$pem")
    PINS[$name]="$pin"
    subject=$(openssl x509 -in "$pem" -noout -subject | sed 's/subject= //')
    printf "  ✅ %-22s %s\n     %s\n" "$name" "$pin" "$subject"
  else
    echo "  ❌ Échec téléchargement $name"
  fi
done

# Leaf cert du domaine (utile pour vérifier que la chaîne est bien LE)
if [[ "$INCLUDE_LEAF" == "1" ]]; then
  echo
  echo "🌐 Leaf cert de ${DOMAIN}"
  leaf_pem="$TMPDIR/leaf.pem"
  echo | openssl s_client -showcerts -connect "${DOMAIN}:443" -servername "${DOMAIN}" 2>/dev/null \
    | awk '/BEGIN CERTIFICATE/{f=1} f{print} /END CERTIFICATE/{f=0; exit}' > "$leaf_pem" || true
  if [[ -s "$leaf_pem" ]]; then
    leaf_pin=$(compute_pin "$leaf_pem")
    issuer=$(openssl x509 -in "$leaf_pem" -noout -issuer | sed 's/issuer= //')
    echo "  Pin leaf : $leaf_pin"
    echo "  Issuer   : $issuer"
    echo
    echo "  ⚠️  PAS recommandé pour le pinning : le leaf tourne tous les 90j."
    echo "      Préférer pinner les CAs (racines + intermédiaires) ci-dessus."
  else
    echo "  ❌ Impossible de récupérer le leaf (domaine injoignable ?)"
  fi
fi

echo
echo "──────────────────────────────────────────────────────────────────"
echo "📋 Blocs à coller :"
echo
echo "──── network_security_config.xml (Android) ────"
cat <<XML
<pin-set expiration="2035-09-15">
    <!-- ISRG Root X1 (RSA, primary) — racine LE valide jusqu'en 2035-09 -->
    <pin digest="SHA-256">${PINS[isrgrootx1]:-???}</pin>
    <!-- ISRG Root X2 (ECDSA, backup) — racine LE valide jusqu'en 2035-09 -->
    <pin digest="SHA-256">${PINS[isrg-root-x2]:-???}</pin>
    <!-- Intermédiaire R10 (RSA) — signé par X1, rotation 5 ans -->
    <pin digest="SHA-256">${PINS[lets-encrypt-r10]:-???}</pin>
    <!-- Intermédiaire R11 (RSA, backup) -->
    <pin digest="SHA-256">${PINS[lets-encrypt-r11]:-???}</pin>
    <!-- Intermédiaire E5 (ECDSA) — signé par X2 -->
    <pin digest="SHA-256">${PINS[lets-encrypt-e5]:-???}</pin>
    <!-- Intermédiaire E6 (ECDSA, backup) -->
    <pin digest="SHA-256">${PINS[lets-encrypt-e6]:-???}</pin>
</pin-set>
XML

echo
echo "──── app.json iOS NSPinnedDomains.NSPinnedCAIdentities ────"
echo "[NSPinnedDomains.\"concorde-work-force.com\".NSPinnedCAIdentities]"
echo "  \"SPKI-SHA256-BASE64\": \"${PINS[isrgrootx1]:-???}\"        # ISRG Root X1"
echo "  \"SPKI-SHA256-BASE64\": \"${PINS[isrg-root-x2]:-???}\"      # ISRG Root X2"
echo "  \"SPKI-SHA256-BASE64\": \"${PINS[lets-encrypt-r10]:-???}\"   # LE R10"
echo "  \"SPKI-SHA256-BASE64\": \"${PINS[lets-encrypt-r11]:-???}\"   # LE R11"
echo "  \"SPKI-SHA256-BASE64\": \"${PINS[lets-encrypt-e5]:-???}\"    # LE E5"
echo "  \"SPKI-SHA256-BASE64\": \"${PINS[lets-encrypt-e6]:-???}\"    # LE E6"
echo
echo "──────────────────────────────────────────────────────────────────"
echo "🛡️  Recommandations :"
echo "  - Pinner les 2 ROOTS (X1 + X2) en priorité : valides jusqu'en 2035."
echo "  - Pinner les 4 intermédiaires en backup : tournent tous les 5 ans."
echo "  - NE PAS pinner le leaf (--include-leaf juste pour vérifier la chaîne)."
echo "  - Régénérer ce fichier annuellement et vérifier les changements."
