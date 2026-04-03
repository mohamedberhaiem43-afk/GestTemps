# 🚀 Installation & Configuration - Guide Étape par Étape

## Phase 1: Configuration du Frontend

### Étape 1.1: Vérifier le fichier .env

Créez ou modifiez le fichier `.env` à la racine du projet:

```env
# .env
VITE_REACT_APP_API_URL=http://localhost:5000/api
# ou en production:
# VITE_REACT_APP_API_URL=https://votre-api.com/api
```

### Étape 1.2: Vérifier les dépendances

Toutes les dépendances nécessaires doivent être installées:

```bash
npm install
```

Packages requis (normalement déjà installés):
- ✅ react
- ✅ react-query
- ✅ @mui/material
- ✅ @mui/icons-material
- ✅ axios
- ✅ typescript

---

## Phase 2: Configuration de l'authentification

### Étape 2.1: Initialiser localStorage au démarrage

Dans votre fichier `main.tsx` ou `App.tsx`:

```typescript
import { useEffect } from 'react';

function App() {
  useEffect(() => {
    // À faire AVANT de charger le Dashboard
    const token = localStorage.getItem('authToken');
    const soccod = localStorage.getItem('soccod');

    if (!token || !soccod) {
      // Rediriger vers login
      console.warn('Token ou soccod manquant! Veuillez vous connecter.');
    }
  }, []);

  return (/* votre app */);
}
```

### Étape 2.2: Stocker le token après login

Après une connexion réussie:

```typescript
// Dans votre composant Login
const handleLogin = async (credentials) => {
  const response = await axios.post('/api/auth/login', credentials);
  const { token, soccod } = response.data;

  // Stocker pour utilisation future
  localStorage.setItem('authToken', token);
  localStorage.setItem('soccod', soccod);

  // Rediriger vers dashboard
  navigate('/dashboard');
};
```

---

## Phase 3: Intégration du Dashboard

### Étape 3.1: Importer le Dashboard dans votre router

```typescript
// router.tsx ou App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import DashboardPage from './components/Dashboard/Dashboard';

function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        {/* autres routes */}
      </Routes>
    </BrowserRouter>
  );
}
```

### Étape 3.2: Protéger la route Dashboard

```typescript
// ProtectedRoute.tsx
import { Navigate } from 'react-router-dom';

function ProtectedRoute({ element }) {
  const token = localStorage.getItem('authToken');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return element;
}

// Utilisation
<Route
  path="/dashboard"
  element={<ProtectedRoute element={<DashboardPage />} />}
/>
```

---

## Phase 4: Verification Local

### Étape 4.1: Démarrer le serveur de développement

```bash
npm run dev
```

### Étape 4.2: Vérifier que l'API est accessible

Ouvrir les DevTools (F12) et dans la console:

```javascript


### Étape 4.3: Naviguer au dashboard

1. Si connecté, aller à `http://localhost:5173/dashboard`
2. Sinon, passer par la page login d'abord

### Étape 4.4: Vérifier les données

Dans la console, vérifier:
```javascript
// Les 4 KPI cards s'affichent
// Le tableau des employés se peuple
// Les filtres fonctionnent
// Pas de console errors (rouges)
```

---

## Phase 5: Tests Avancés

### Étape 5.1: Tester l'export CSV

```javascript
// Dans la console React Components
import dashboardService from '@/services/DashboardService';

// Test export
await dashboardService.exportToCsv({
  soccod: localStorage.getItem('soccod'),
  date: new Date()
});
```

### Étape 5.2: Tester les filtres

1. Changer la plage de dates
2. Filtrer par département
3. Rechercher un employé
4. Vérifier que les résultats changent

### Étape 5.3: Vérifier les graphiques

- Le graphique des heures s'affiche
- Le graphique en pie chart affiche les ratios
- Pas de console errors

### Étape 5.4: Tester avec Postman

```http
POST http://localhost:5000/api/dashboard/data
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "soccod": "001",
  "date": "2026-02-06",
  "departement": null,
  "empcods": null
}
```

---

## Phase 6: Configuration du Backend

### Étape 6.1: Vérifier les endpoints

Tous les endpoints doivent répondre:

```
✅ POST /api/dashboard/data
✅ POST /api/dashboard/evolution
✅ POST /api/dashboard/employes-statut
✅ GET /api/dashboard/resume-jour
✅ POST /api/dashboard/kpis-departements
✅ POST /api/dashboard/export-csv
```

### Étape 6.2: Vérifier CORS

Le backend doit permettre les requêtes du frontend:

```csharp
// Program.cs
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

app.UseCors("AllowAll");
```

### Étape 6.3: Vérifier l'authentification

Le middleware Bearer token doit être configuré:

```csharp
app.UseAuthentication();
app.UseAuthorization();
```

### Étape 6.4: Remplir la base de données

Assurez-vous que la BD a du données de test:

```sql
-- Vérifier qu'il y a des employés
SELECT COUNT(*) FROM Employes;

-- Vérifier qu'il y a des pointages
SELECT COUNT(*) FROM Pointages;

-- Vérifier qu'il y a des congés
SELECT COUNT(*) FROM DemandesConge;
```

---

## Phase 7: Troubleshooting

### ❌ Problème: "Cannot read property 'soccod' of null"

```
Cause: localStorage.soccod est null
Solution:
1. localStorage.setItem('soccod', 'CODE_SOCIETE');
2. Recharger la page
3. Tenter à nouveau
```

### ❌ Problème: "401 Unauthorized"

```
Cause: Token JWT invalide ou expiré
Solution:
1. Se reconnecter pour obtenir un nouveau token
2. Vérifier que le token est dans localStorage.authToken
3. Vérifier que le backend valide correctement le token
```

### ❌ Problème: "CORS policy: No 'Access-Control-Allow-Origin' header"

```
Cause: CORS non configuré sur le backend
Solution:
1. Ajouter app.UseCors() avant app.UseAuthentication()
2. Vérifier les headers CORS
3. Test avec curl -I pour vérifier les headers
```

### ❌ Problème: "Data is undefined"

```
Cause: API ne retourne pas de données
Solution:
1. Vérifier la requête POST avec Postman
2. Vérifier les logs du backend
3. Vérifier que le soccod existe en BD
4. Vérifier les paramètres de la requête
```

### ❌ Problème: Tableau vide

```
Cause: Pas de données d'employés ou filtre trop restrictif
Solution:
1. Vérifier qu'il y a des employés en BD
2. Vérifier les filtres appliqués
3. Supprimer les filtres pour voir tous les employés
4. Vérifier la date du filtre
```

### ❌ Problème: Les graphiques ne s'affichent pas

```
Cause: BasicBars ou BasicPie ne reçoivent pas de données
Solution:
1. Vérifier que empStat et sexStat ont des données
2. Vérifier dans React DevTools
3. Checker les logs du navigateur
4. Vérifier useGetStatistics hook
```

---

## Phase 8: Optimisations (Optionnel)

### Étape 8.1: Implémenter la pagination

```typescript
const [page, setPage] = useState(0);
const [pageSize, setPageSize] = useState(25);

// Filtrer côté client
const paginatedEmployes = filteredEmployes.slice(
  page * pageSize,
  (page + 1) * pageSize
);
```

### Étape 8.2: Ajouter le scroll virtuel

```typescript
import { FixedSizeList as List } from 'react-window';

// Pour traiter 10,000+ employés
```

### Étape 8.3: Mettre en cache les images

```typescript
// Les icônes MUI sont déjà optimisées
// SVG inline minimise les requêtes
```

---

## Phase 9: Déploiement en Production

### Étape 9.1: Build du projet

```bash
npm run build
```

### Étape 9.2: Vérifier le build

```bash
npm run preview
```

Accéder à `http://localhost:4173` et tester le dashboard.

### Étape 9.3: Configurer l'URL de production

Créer un fichier `.env.production`:

```env
VITE_REACT_APP_API_URL=https://api.votre-production.com/api
```

### Étape 9.4: Déployer

```bash
# Publier sur votre serveur
npm run build
# Copier dist/ sur votre serveur web
```

### Étape 9.5: Vérifier le déploiement

1. Accéder à votre site de production
2. Se connecter
3. Vérifier que le dashboard charge
4. Tester les fonctions principales

---

## ✅ Checklist finale

```
Phase 1: Configuration Frontend
├─ [ ] .env configuré avec API URL
├─ [ ] npm install réussi
└─ [ ] Aucune erreur de dépendances

Phase 2: Authentification
├─ [ ] Token stocké dans localStorage
├─ [ ] Soccod stocké dans localStorage
└─ [ ] ProtectedRoute fonctionne

Phase 3: Intégration Dashboard
├─ [ ] Route /dashboard fonctionnel
├─ [ ] Dashboard importe correctement
└─ [ ] Pas d'erreurs de compilation

Phase 4: Vérification Local
├─ [ ] npm run dev démarre
├─ [ ] Dashboard charge  
├─ [ ] KPI cards s'affichent
├─ [ ] Tableau se peuple
└─ [ ] Filtres fonctionnent

Phase 5: Tests Avancés
├─ [ ] Export CSV fonctionne
├─ [ ] Recherche fonctionne
├─ [ ] Graphiques s'affichent
└─ [ ] Pas de console errors

Phase 6: Backend
├─ [ ] Tous les endpoints répondent
├─ [ ] CORS configuré
├─ [ ] Auth configurée
└─ [ ] BD avec données

Phase 7: Troubleshooting
├─ [ ] Aucune erreur soccod
├─ [ ] Aucune erreur 401
├─ [ ] Aucune erreur CORS
└─ [ ] Données chargées correctement

Phase 8: Optimisations
├─ [ ] Performance acceptable
├─ [ ] Pas de memory leaks
└─ [ ] UI responsive

Phase 9: Production
├─ [ ] Build réussi
├─ [ ] Preview OK
├─ [ ] Déploiement réussi
└─ [ ] Tests en production passés
```

---

## 📊 Résumé des actions

| Phase | Étapes | Statut | Durée |
|-------|--------|--------|-------|
| 1 | 2 | ✅ | 5 min |
| 2 | 2 | ✅ | 10 min |
| 3 | 2 | ✅ | 5 min |
| 4 | 4 | ⏳ | 15 min |
| 5 | 4 | ⏳ | 20 min |
| 6 | 4 | ⏳ | 15 min |
| 7 | 5 | ⏳ | 20 min |
| 8 | 3 | ⏳ | 15 min |
| 9 | 5 | ⏳ | 30 min |
| **TOTAL** | **31** | **~50%** | **2h** |

---

## 🎯 Prochains pas

Après que tout fonctionne:

1. ✅ Documenter les chemins de données (API <-> UI)
2. ✅ Former votre équipe sur new composants
3. ✅ Monitorer la performance en production
4. ✅ Collecter les feedbacks utilisateurs
5. ✅ Planifier les améliorations

---

## 📞 Support

Pour toute question ou problème:

1. Consulter `QUICK_START.md`
2. Lire `INTEGRATION_GUIDE.md`
3. Vérifier `EXAMPLES.tsx`
4. Consulter le `CHECKLIST.md`

---

**Format:** Installation Step-by-Step  
**Durée totale:** ~2 heures  
**Statut:** Ready for Production ✅  
**Date:** 6 Février 2026
