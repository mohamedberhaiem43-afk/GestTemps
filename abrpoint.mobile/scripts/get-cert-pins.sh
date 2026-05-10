#!/usr/bin/env bash
# =============================================================================
# Calcule les pins SHA-256 SPKI (Subject Public Key Info) d'un domaine pour
# le certificate pinning Android (network_security_config.xml) et iOS
# (NSPinnedDomains dans Info.plist via app.json).
#
# On pin la chaîne complète : leaf + intermédiaire(s) + root. En prod il est
# recommandé de pinner les INTERMÉDIAIRES et la ROOT (pas le leaf qui tourne
# tous les 90 jours avec Let's Encrypt) — la liste ci-dessous est triée du
# leaf à la racine, copier les hashs des positions 2+ uniquement.
#
# Usage : ./get-cert-pins.sh concorde-work-force.com [443]
# =============================================================================

set -euo pipefail

DOMAIN="${1:-concorde-work-force.com}"
PORT="${2:-443}"

if ! command -v openssl >/dev/null 2>&1; then
  echo "[ERR] openssl non installé." >&2
  exit 1
fi

echo "🔍 Récupération de la chaîne TLS pour ${DOMAIN}:${PORT}..."
echo

CHAIN=$(echo | openssl s_client -showcerts -connect "${DOMAIN}:${PORT}" -servername "${DOMAIN}" 2>/dev/null \
  | awk '/-----BEGIN CERTIFICATE-----/,/-----END CERTIFICATE-----/')

if [[ -z "$CHAIN" ]]; then
  echo "[ERR] Impossible de récupérer la chaîne." >&2
  exit 1
fi

# Sépare chaque cert en blocs et calcule pour chacun le hash SPKI.
TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

echo "$CHAIN" | awk '
  /-----BEGIN CERTIFICATE-----/ { i++; }
  { print > sprintf("'$TMPDIR'/cert%02d.pem", i) }
'

i=0
for f in "$TMPDIR"/cert*.pem; do
  i=$((i+1))
  SUBJECT=$(openssl x509 -in "$f" -noout -subject | sed 's/subject= //')
  ISSUER=$(openssl x509 -in "$f" -noout -issuer | sed 's/issuer= //')
  PIN=$(openssl x509 -in "$f" -pubkey -noout \
    | openssl pkey -pubin -outform der \
    | openssl dgst -sha256 -binary \
    | base64)

  echo "──────────────────────────────────────────────────────────────"
  echo "  Cert #${i}"
  echo "  Subject : $SUBJECT"
  echo "  Issuer  : $ISSUER"
  echo "  Pin     : $PIN"
  echo
  echo "  Android XML :"
  echo "    <pin digest=\"SHA-256\">$PIN</pin>"
  echo
  echo "  iOS Info.plist (NSPinnedLeafIdentities / NSPinnedCAIdentities) :"
  echo "    SPKI-SHA256-BASE64 → $PIN"
done

echo "──────────────────────────────────────────────────────────────"
echo "✅ Recommandations :"
echo "  - Pinner les CERTS #2 et #3 (intermédiaires + root)"
echo "  - PAS le cert #1 (leaf, change tous les 90 jours en LE)"
echo "  - Inclure 2 pins minimum (primaire + backup) sinon une rotation"
echo "    de l'autorité de cert briquerait l'app."
