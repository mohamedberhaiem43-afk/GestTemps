#!/usr/bin/env bash
# =============================================================================
# Garde-fou EAS prebuild : refuse un build de production tant que les pins
# de certificat sont restés en mode `placeholder-*` dans network_security_config.xml
# et app.json.
#
# À brancher dans eas.json :
#   {
#     "build": {
#       "production": {
#         "prebuildCommand": "bash scripts/check-pins-filled.sh"
#       }
#     }
#   }
#
# OU à lancer en CI/CD avant `eas build --profile production`.
# =============================================================================

set -euo pipefail

CONFIG_XML="$(dirname "$0")/../assets/network_security_config.xml"
APP_JSON="$(dirname "$0")/../app.json"
ERR=0

check_file_for_placeholders() {
  local file="$1"
  local label="$2"
  if [[ ! -f "$file" ]]; then
    echo "[ERR] $label introuvable : $file" >&2
    ERR=1
    return
  fi
  if grep -q "placeholder-" "$file"; then
    echo "❌ $label contient encore des pins placeholder. Lancer scripts/generate-le-pins.sh pour les remplir." >&2
    grep -n "placeholder-" "$file" >&2
    ERR=1
  else
    echo "✅ $label : aucun placeholder détecté."
  fi
}

echo "🔐 Vérification des pins de certificat avant build de production…"
check_file_for_placeholders "$CONFIG_XML" "network_security_config.xml"
check_file_for_placeholders "$APP_JSON" "app.json (NSPinnedCAIdentities)"

# Sanity check additionnel : usesCleartextTraffic doit être false en prod.
# En dev il peut être true pour utiliser Expo Go sur LAN sans HTTPS.
if grep -q '"usesCleartextTraffic":\s*true' "$APP_JSON"; then
  echo "⚠️  app.json:android.usesCleartextTraffic = true. Acceptable en DEV, INTERDIT en prod."
  echo "    Override via EAS env var \`USES_CLEARTEXT_TRAFFIC=false\` ou via un profil EAS production dédié."
fi

if [[ "$ERR" -ne 0 ]]; then
  echo
  echo "🛑 Build prod refusé : pinning incomplet."
  exit 1
fi
echo
echo "✅ Pré-vérifications pinning OK."
