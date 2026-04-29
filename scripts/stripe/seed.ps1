#requires -Version 5.1
# ============================================================================
#  Concorde Workforce — Seed Stripe Products + Prices (PowerShell)
# ============================================================================
#  Crée les 3 produits (Essentiel / Standard / Premium) et les 6 prix
#  (monthly + annual) qui correspondent à la grille tarifaire affichée sur
#  PricingPage.tsx. Affiche ensuite les commandes `dotnet user-secrets set`
#  à exécuter pour injecter les price_id dans la configuration serveur.
#
#  Pré-requis :
#    - stripe CLI installé : https://stripe.com/docs/stripe-cli
#    - `stripe login` exécuté (ou STRIPE_API_KEY défini dans l'environnement)
#
#  Usage :
#    pwsh scripts/stripe/seed.ps1
#    (ou) powershell -File scripts/stripe/seed.ps1
#
#  Idempotence :
#    Le script identifie les produits existants par nom — il NE crée pas de
#    doublon si tu le relances. Les prix, eux, sont toujours nouveaux : si tu
#    veux réinitialiser, supprime/archive les anciens dans le dashboard.
# ============================================================================

$ErrorActionPreference = 'Stop'

if (-not (Get-Command stripe -ErrorAction SilentlyContinue)) {
    Write-Error 'stripe CLI introuvable. Installation : https://stripe.com/docs/stripe-cli'
    exit 1
}

$Currency = 'eur'

function Find-ProductId([string]$Name) {
    $json = stripe products list --limit 100 | Out-String
    $obj  = $json | ConvertFrom-Json
    return ($obj.data | Where-Object { $_.name -eq $Name } | Select-Object -First 1 -ExpandProperty id)
}

function New-ProductIfAbsent([string]$Name, [string]$Description) {
    $existing = Find-ProductId $Name
    if ($existing) {
        Write-Host "[skip ] Product déjà présent : $Name → $existing" -ForegroundColor DarkGray
        return $existing
    }
    $json = stripe products create --name="$Name" --description="$Description" | Out-String
    $id   = ($json | ConvertFrom-Json).id
    Write-Host "[ok   ] Product créé : $Name → $id" -ForegroundColor Green
    return $id
}

function New-RecurringPrice([string]$ProductId, [int]$UnitAmount, [string]$Interval, [string]$Nickname) {
    # Stripe CLI attend les paramètres imbriqués au format `--recurring="interval=month"`.
    $json = stripe prices create `
        --product=$ProductId `
        --unit-amount=$UnitAmount `
        --currency=$Currency `
        --recurring="interval=$Interval" `
        --nickname="$Nickname" | Out-String
    $id = ($json | ConvertFrom-Json).id
    Write-Host "[ok   ] Price créé  : $Nickname ($UnitAmount c/$Interval) → $id" -ForegroundColor Green
    return $id
}

# ── Création des produits ───────────────────────────────────────────────────
Write-Host '─── Création des produits Concorde ─────────────────────────────────' -ForegroundColor Cyan
$prodEssentiel = New-ProductIfAbsent 'Concorde Essentiel' 'Idéal pour les micro-équipes qui souhaitent digitaliser leur pointage sans frais.'
$prodStandard  = New-ProductIfAbsent 'Concorde Standard'  'Suite complète : pointage, congés et préparation paie pour les équipes structurées.'
$prodPremium   = New-ProductIfAbsent 'Concorde Premium'   'Analytique avancée et accompagnement dédié pour les organisations multi-sites.'

# ── Création des prix ───────────────────────────────────────────────────────
# Conventions :
#   Essentiel : 0 €/u/mois (gratuit à vie) — prix techniques pour permettre la souscription Checkout.
#   Standard  : 7,50 € mensuel  / 6,00 € équivalent mensuel sur engagement annuel  → 72,00 €/u/an.
#   Premium   : 11,00 € mensuel / 8,80 € équivalent mensuel sur engagement annuel  → 105,60 €/u/an.
Write-Host '─── Création des prix ──────────────────────────────────────────────' -ForegroundColor Cyan
$priceEssM = New-RecurringPrice $prodEssentiel     0 month 'Essentiel mensuel'
$priceEssA = New-RecurringPrice $prodEssentiel     0 year  'Essentiel annuel'
$priceStdM = New-RecurringPrice $prodStandard    750 month 'Standard mensuel (7,50 €/u)'
$priceStdA = New-RecurringPrice $prodStandard   7200 year  'Standard annuel (72,00 €/u/an)'
$pricePrmM = New-RecurringPrice $prodPremium    1100 month 'Premium mensuel (11,00 €/u)'
$pricePrmA = New-RecurringPrice $prodPremium   10560 year  'Premium annuel (105,60 €/u/an)'

# ── Sortie : commandes user-secrets prêtes à coller ─────────────────────────
@"

═══════════════════════════════════════════════════════════════════════════
✅ Produits + prix créés.

Exécute maintenant ces commandes (depuis ABRPOINT.Server/) pour injecter les
price_id dans la configuration sans toucher au repo :

cd ABRPOINT.Server
dotnet user-secrets set "Stripe:Prices:Essentiel:monthly" "$priceEssM"
dotnet user-secrets set "Stripe:Prices:Essentiel:annual"  "$priceEssA"
dotnet user-secrets set "Stripe:Prices:Standard:monthly"  "$priceStdM"
dotnet user-secrets set "Stripe:Prices:Standard:annual"   "$priceStdA"
dotnet user-secrets set "Stripe:Prices:Premium:monthly"   "$pricePrmM"
dotnet user-secrets set "Stripe:Prices:Premium:annual"    "$pricePrmA"

═══════════════════════════════════════════════════════════════════════════

Étape suivante — webhook (test local) :
  stripe listen --forward-to https://localhost:7189/api/stripe/webhook
puis copie le whsec_… affiché et lance :
  dotnet user-secrets set "Stripe:WebhookSecret" "whsec_..."

═══════════════════════════════════════════════════════════════════════════

"@ | Write-Host -ForegroundColor Yellow
