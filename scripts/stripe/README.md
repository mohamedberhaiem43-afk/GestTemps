# Setup Stripe — Concorde Workforce

Ce dossier contient les scripts qui provisionnent automatiquement les produits
et prix Stripe correspondant à la grille tarifaire affichée sur la
[PricingPage](../../abrpoint.client/src/components/Pricing/PricingPage.tsx).

## Grille appliquée (en EUR, par utilisateur)

| Plan       | Mensuel    | Annuel (équiv. mensuel) | Prix Stripe annuel |
|------------|------------|-------------------------|--------------------|
| Essentiel  | 0,00 €     | 0,00 €                  | 0,00 €             |
| Standard   | 7,50 €     | 6,00 €                  | 72,00 €            |
| Premium    | 11,00 €    | 8,80 €                  | 105,60 €           |

Les abonnements sont facturés en mode `recurring` Stripe avec quantité = nombre
d'utilisateurs (cf. [BillingController.cs](../../ABRPOINT.Server/Controllers/BillingController.cs)
qui passe `Quantity = req.UserCount`).

## 1. Pré-requis

```bash
# Installation Stripe CLI
brew install stripe/stripe-cli/stripe          # macOS
scoop install stripe                            # Windows
# (ou téléchargement direct : https://stripe.com/docs/stripe-cli)

stripe login                                    # ouvre le navigateur
```

Le script bash a aussi besoin de `jq` (parsing JSON) :
```bash
brew install jq                                 # macOS
sudo apt install jq                             # Linux
choco install jq                                # Windows
```

## 2. Lancer le seed

### Bash / macOS / Linux
```bash
bash scripts/stripe/seed.sh
```

### PowerShell / Windows
```powershell
pwsh scripts/stripe/seed.ps1
# ou
powershell -ExecutionPolicy Bypass -File scripts\stripe\seed.ps1
```

Le script affiche pour chaque entité créée : `[ok ]` ou `[skip ]` (déduplication
par nom de produit). À la fin, il imprime les **6 commandes
`dotnet user-secrets set`** prêtes à coller pour persister les `price_id` côté
serveur — sans jamais écrire dans le repo.

## 3. Webhook (paiement, échec, fin de trial, …)

Ouvre un autre terminal et lance :

```bash
stripe listen --forward-to https://localhost:7189/api/stripe/webhook
```

Stripe affiche un `whsec_…` — copie-le, puis :

```bash
cd ABRPOINT.Server
dotnet user-secrets set "Stripe:WebhookSecret" "whsec_..."
```

Pour la prod : créer le webhook depuis Dashboard → Developers → Webhooks
avec ces évènements (déjà gérés par `StripeWebhookController.cs`) :
- `checkout.session.completed`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `customer.subscription.deleted`
- `customer.subscription.trial_will_end`

## 4. Cartes de test Stripe

| Numéro                 | Comportement         |
|------------------------|----------------------|
| `4242 4242 4242 4242`  | Paiement réussi      |
| `4000 0025 0000 3155`  | Demande 3DS          |
| `4000 0000 0000 9995`  | Fonds insuffisants   |
| `4000 0000 0000 0002`  | Carte refusée        |

Date d'expiration : n'importe quelle date future. CVC : 3 chiffres aléatoires.

## 5. Reset / nettoyage (mode test)

Dashboard Stripe → mode test → **Developers → Settings → "Delete all test data"**
remet le compte à zéro. Tu peux ensuite relancer `seed.sh` / `seed.ps1`.
