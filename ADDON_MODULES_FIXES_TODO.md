# Modules Optionnels (Addons) - Corrections & TODO

## Status Mai 28, 2026

### ✅ Completed
1. **Build cleanup** : Variables unused dans DashboardModern.tsx supprimées  
2. **Better UX messaging** : Après changement d'addons, affiche "facturation mise à jour au cycle suivant"
3. **Frontend structure** : Code prêt pour Stripe redirect quand SKU addon seront configurés

### ⚠️ Issues Identified

#### Problème 1: Modules optionnels ne s'affichent pas comme coches
- **Location**: `MonAbonnementPage.tsx` dialog "Gérer mes modules optionnels"
- **Cause**: `subscribedAddons` peut être vide ou mal chargé depuis AuthProvider
- **Fix Needed**: Vérifier chargement `addons` depuis `/me` → AuthProvider → useAuth()
- **Debug Steps**:
  1. Ouvrir console DevTools
  2. Vérifier `localStorage.tenantSlug` 
  3. Vérifier réponse `/api/Utilisateurs/me` contient `addons`
  4. Vérifier `addonsDraft` au render du dialog

#### Problème 2: Facturation Stripe non mise à jour
- **Status**: Amélioré (message utilisateur)
- **Issue**: SKU addon Stripe pas encore configurés (`price_addon_*`)
- **Fix**: Une fois SKU créés dans Stripe Dashboard, implémenter appel POST `/billing/checkout` avec `addons` param

#### Problème 3: Erreur 502 sur `/billing/add-seats`
- **Status**: Configuration Stripe ✅ (prix UserSupp existe dans appsettings.json)
- **Real Issue**: Subscription Stripe invalide ou inexistante pour le tenant
- **Fix Needed**:
  1. Vérifier que tenant a `StripeSubscriptionId` valide en base
  2. Vérifier subscription existe côté Stripe API
  3. Ajouter meilleur message d'erreur si subscription invalide
  4. Peut-être réinitialiser subscription si corrompue

### Next Steps (Priority Order)

1. **Debug addons loading** (Quick)
   - Ajouter console logs dans `MonAbonnementPage` 
   - Vérifier que `useAuth().addons` retourne bien les valeurs du backend
   - Vérifier format des clés (case sensitivity: `aiAssistantRh` vs autres)

2. **Configure addon SKU Stripe** (Medium - needs Stripe access)
   - Créer prices Stripe pour addons: `price_addon_*`
   - Mettre à jour appsettings.json avec addon price IDs
   - Tester Checkout endpoint avec addons

3. **Fix add-seats 502** (Medium - needs DB investigation)
   - Vérifier intégrité subscription Stripe en base
   - Tester récupération subscription via Stripe API
   - Améliorer error messages

### Test Cases

```bash
# 1. Addon loading test
# Open /dashboard/mon-abonnement
# Click "Gérer mes modules optionnels"
# Expected: Modules previously selected should show "Activé" chip

# 2. Addon save test  
# Toggle an addon
# Click "Enregistrer"
# Expected: Success msg + sidebar updated with new features

# 3. Add seats test
# Click "Ajouter un collaborateur"
# Enter count > 0
# Click save
# Expected: Success (not 502)
```

### Code References
- Frontend Dialog: [MonAbonnementPage.tsx#L1174-L1290](../abrpoint.client/src/components/Pricing/MonAbonnementPage.tsx#L1174)
- Backend Save: [BillingController.cs#L1099-L1136](../ABRPOINT.Server/Controllers/BillingController.cs#L1099)
- AuthProvider Addons: [AuthProvider.tsx#L172-L223](../abrpoint.client/src/components/helper/AuthProvider.tsx#L172)
