#!/usr/bin/env bash
# =============================================================================
# Garde-fou pinning : refuse un build de production tant que les pins de
# certificat sont restés en mode `placeholder-*` dans network_security_config.xml
# et app.json.
#
# Branché via le hook EAS Build `eas-build-pre-install` (cf. package.json) :
# il s'exécute sur le serveur EAS avant l'installation des deps. Le check ne
# BLOQUE que le profil `production` — les profils dev/preview peuvent
# légitimement conserver des pins placeholder.
#
# Peut aussi se lancer manuellement en CI/CD avant `eas build --profile
# production` (aucun EAS_BUILD_PROFILE → enforcement systématique).
#
# NB : ne PAS mettre dans `prebuildCommand` (qui attend les arguments d'
# `expo prebuild`, ex. `prebuild --clean`, pas un script shell).
# =============================================================================

set -euo pipefail

# Sur EAS, n'appliquer le garde-fou qu'au profil production. Hors EAS (CI/CD
# manuel, EAS_BUILD_PROFILE absent) on applique toujours.
if [[ -n "${EAS_BUILD_PROFILE:-}" && "${EAS_BUILD_PROFILE}" != "production" ]]; then
  echo "ℹ️  Profil EAS '${EAS_BUILD_PROFILE}' — vérification pinning ignorée (production uniquement)."
  exit 0
fi

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
  # Retire les commentaires XML (<!-- ... -->) avant de chercher : la doc de
  # network_security_config.xml mentionne « placeholder- » et déclencherait
  # sinon un faux positif alors que les vrais pins sont remplis. (Sans effet
  # sur app.json, qui est du JSON pur sans commentaires.)
  local stripped
  stripped="$(perl -0777 -pe 's/<!--.*?-->//gs' "$file")"
  if grep -q "placeholder-" <<<"$stripped"; then
    echo "❌ $label contient encore des pins placeholder. Lancer scripts/generate-le-pins.sh pour les remplir." >&2
    grep -n "placeholder-" <<<"$stripped" >&2
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
