#!/usr/bin/env bash
# ============================================================================
#  Concorde Workforce — Seed Stripe Products + Prices
# ============================================================================
#  Crée les 3 produits (Essentiel / Standard / Premium) et les 6 prix
#  (monthly + annual) qui correspondent à la grille tarifaire affichée sur
#  PricingPage.tsx. Affiche ensuite les commandes `dotnet user-secrets set`
#  à exécuter pour injecter les price_id dans la configuration serveur.
#
#  Pré-requis :
#    - stripe CLI installé : https://stripe.com/docs/stripe-cli
#    - `stripe login` exécuté (ou STRIPE_API_KEY exportée)
#    - jq installé (pour parser les réponses JSON)
#
#  Usage :
#    bash scripts/stripe/seed.sh
#
#  Idempotence :
#    Le script identifie les produits existants par nom — il NE crée pas de
#    doublon si tu le relances. Les prix, eux, sont toujours nouveaux : si tu
#    veux réinitialiser, supprime/archive les anciens dans le dashboard.
# ============================================================================

set -euo pipefail

if ! command -v stripe >/dev/null 2>&1; then
  echo "[ERREUR] stripe CLI introuvable. Installation : https://stripe.com/docs/stripe-cli" >&2
  exit 1
fi
if ! command -v jq >/dev/null 2>&1; then
  echo "[ERREUR] jq introuvable. Installe-le (apt/brew/choco install jq)." >&2
  exit 1
fi

CURRENCY="eur"

# ── Helpers ─────────────────────────────────────────────────────────────────
find_product_id() {
  # $1 = product name. Renvoie l'id du produit s'il existe, vide sinon.
  stripe products list --limit 100 \
    | jq -r --arg n "$1" '.data[] | select(.name == $n) | .id' \
    | head -n1
}

create_product_if_absent() {
  # $1 = name, $2 = description. echo l'id sur stdout.
  local name="$1" desc="$2" id
  id=$(find_product_id "$name")
  if [[ -n "$id" ]]; then
    echo "[skip ] Product déjà présent : $name → $id" >&2
    echo "$id"
    return
  fi
  id=$(stripe products create \
        --name="$name" \
        --description="$desc" \
        | jq -r '.id')
  echo "[ok   ] Product créé : $name → $id" >&2
  echo "$id"
}

create_price() {
  # $1 = product_id, $2 = unit_amount (en centimes), $3 = interval (month|year), $4 = nickname
  local product="$1" amount="$2" interval="$3" nick="$4" id
  id=$(stripe prices create \
        --product="$product" \
        --unit-amount="$amount" \
        --currency="$CURRENCY" \
        --recurring="interval=$interval" \
        --nickname="$nick" \
        | jq -r '.id')
  echo "[ok   ] Price créé  : $nick (${amount}c/$interval) → $id" >&2
  echo "$id"
}

# ── Création des produits ───────────────────────────────────────────────────
echo "─── Création des produits Concorde ───────────────────────────────────" >&2
PROD_ESSENTIEL=$(create_product_if_absent "Concorde Essentiel" \
  "Idéal pour les micro-équipes qui souhaitent digitaliser leur pointage sans frais.")
PROD_STANDARD=$(create_product_if_absent "Concorde Standard" \
  "Suite complète : pointage, congés et préparation paie pour les équipes structurées.")
PROD_PREMIUM=$(create_product_if_absent "Concorde Premium" \
  "Analytique avancée et accompagnement dédié pour les organisations multi-sites.")

# ── Création des prix ───────────────────────────────────────────────────────
# Convention : prix par utilisateur, en EUR.
#   Essentiel : 0 €/utilisateur/mois (gratuit à vie) — créé pour permettre la
#               souscription technique côté Checkout.
#   Standard  : 7.50 € mensuel  /  6.00 € équivalent mensuel sur engagement annuel
#               → prix annuel = 6.00 × 12 = 72.00 €
#   Premium   : 11.00 € mensuel /  8.80 € équivalent mensuel sur engagement annuel
#               → prix annuel = 8.80 × 12 = 105.60 €
echo "─── Création des prix ────────────────────────────────────────────────" >&2
PRICE_ESS_M=$(create_price "$PROD_ESSENTIEL"      0 month "Essentiel mensuel")
PRICE_ESS_A=$(create_price "$PROD_ESSENTIEL"      0 year  "Essentiel annuel")
PRICE_STD_M=$(create_price "$PROD_STANDARD"     750 month "Standard mensuel (7,50 €/u)")
PRICE_STD_A=$(create_price "$PROD_STANDARD"    7200 year  "Standard annuel (72,00 €/u/an = 6,00 €/u/mois)")
PRICE_PRM_M=$(create_price "$PROD_PREMIUM"     1100 month "Premium mensuel (11,00 €/u)")
PRICE_PRM_A=$(create_price "$PROD_PREMIUM"    10560 year  "Premium annuel (105,60 €/u/an = 8,80 €/u/mois)")

# ── Sortie : commandes user-secrets prêtes à coller ─────────────────────────
cat <<EOF

═══════════════════════════════════════════════════════════════════════════
✅ Produits + prix créés.

Exécute maintenant ces commandes (depuis ABRPOINT.Server/) pour injecter les
price_id dans la configuration sans toucher au repo :

cd ABRPOINT.Server
dotnet user-secrets set "Stripe:Prices:Essentiel:monthly" "$PRICE_ESS_M"
dotnet user-secrets set "Stripe:Prices:Essentiel:annual"  "$PRICE_ESS_A"
dotnet user-secrets set "Stripe:Prices:Standard:monthly"  "$PRICE_STD_M"
dotnet user-secrets set "Stripe:Prices:Standard:annual"   "$PRICE_STD_A"
dotnet user-secrets set "Stripe:Prices:Premium:monthly"   "$PRICE_PRM_M"
dotnet user-secrets set "Stripe:Prices:Premium:annual"    "$PRICE_PRM_A"

═══════════════════════════════════════════════════════════════════════════

Étape suivante — webhook (test local) :
  stripe listen --forward-to https://localhost:7189/api/stripe/webhook
puis copie le whsec_… affiché et lance :
  dotnet user-secrets set "Stripe:WebhookSecret" "whsec_..."

═══════════════════════════════════════════════════════════════════════════
EOF
