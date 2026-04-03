# Dashboard Integration Guide

## Vue d'ensemble

Ce guide décrit comment intégrer les données du backend Dashboard dans le frontend React.

## Fichiers créés

### 1. **Models** (`src/models/DashboardModels.ts`)
Contient toutes les interfaces TypeScript pour les données du dashboard:
- `DashboardData` - Données complétes du dashboard
- `EmployeStatut` - Statut d'un employé
- `ResumeDuJour` - Résumé quotidien
- `KpiDepartement` - KPI par département
- `EvolutionJournaliere` - Évolution par jour

### 2. **Service** (`src/services/DashboardService/DashboardService.ts`)
Classe `DashboardService` contenant toutes les méthodes API:
- `getDashboardData()` - Récupère les données du dashboard
- `getEvolution()` - Historique sur une période
- `getEmployesStatut()` - Liste des employés avec statut
- `getResumeDuJour()` - Résumé pour aujourd'hui
- `getKpisDepartements()` - KPI par département
- `exportToCsv()` - Export en CSV

### 3. **Custom Hooks** (`src/hooks/dashboardHooks/useDashboard.ts`)
Hooks React Query pour utiliser le service:
- `useGetDashboardData()` - Hook pour les données principales
- `useGetEmployesStatut()` - Hook pour les employés
- `useGetEvolution()` - Hook pour l'évolution
- `useGetResumeDuJour()` - Hook pour le résumé
- `useGetKpisDepartements()` - Hook pour les KPI

### 4. **Component** (`src/components/Dashboard/Dashboard.tsx`)
Composant dashboard mis à jour avec:
- Utilisation des nouveaux hooks
- Données dynamiques du backend
- Filtres fonctionnels
- Tableau des pointages avec recherche
- Export CSV
- Alertes dynamiques

## Utilisation

### Exemple 1: Utiliser le hook `useGetDashboardData`

```typescript
import { useGetDashboardData } from '@/hooks/dashboardHooks';

function MyComponent() {
  const { data, isLoading, error } = useGetDashboardData({
    soccod: '001', // Code société
    date: new Date(),
    departement: 'Production',
    empcods: null
  });

  if (isLoading) return <div>Chargement...</div>;
  if (error) return <div>Erreur</div>;

  return (
    <div>
      Effectif présent: {data?.effectifPresent}
      Heures travaillées: {data?.heuresTravaillees}
    </div>
  );
}
```

### Exemple 2: Utiliser le service directement

```typescript
import dashboardService from '@/services/DashboardService';

async function exportData() {
  try {
    const blob = await dashboardService.exportToCsv({
      soccod: '001',
      date: new Date(),
      departement: null,
      empcods: null
    });
    
    dashboardService.downloadCsv(blob, 'pointages.csv');
  } catch (error) {
    console.error('Export failed:', error);
  }
}
```

### Exemple 3: Intégration complète dans le Dashboard

Le composant Dashboard.tsx utilise déjà:
- Les hooks pour charger les données
- Les filtres pour paramétrer les requêtes
- Le service pour l'export CSV
- Affichage dynamique des KPI et alertes

## Configuration requise

### Variables d'environnement
Vérifiez que `VITE_REACT_APP_API_URL` est configuré dans `.env`:
```
VITE_REACT_APP_API_URL=https://votre-api.com/api
```

### Backend
Assurez-vous que les endpoints suivants sont disponibles:
- `POST /api/dashboard/data`
- `POST /api/dashboard/evolution`
- `POST /api/dashboard/employes-statut`
- `GET /api/dashboard/resume-jour`
- `POST /api/dashboard/kpis-departements`
- `POST /api/dashboard/export-csv`

## Gestion du cache

Les hooks utilisent React Query avec:
- **staleTime**: 5 minutes (données restent fraîches 5 min)
- **cacheTime**: 10 minutes (données en cache 10 min)
- **retry**: 2 tentatives en cas d'erreur

Pour forcer un rafraîchissement:
```typescript
const queryClient = useQueryClient();
queryClient.invalidateQueries('dashboardData');
```

## Authentification

Le service inclut automatiquement le token Bearer depuis localStorage:
```typescript
const token = localStorage.getItem('authToken');
// Automatiquement ajouté dans l'header Authorization
```

## Gestion des erreurs

Chaque hook retourne un objet `error`:
```typescript
const { data, isLoading, error } = useGetDashboardData(request);

if (error) {
  console.error('Erreur API:', error.message);
}
```

## Performance

- Les données sont mises en cache par 5 minutes
- Les requêtes sont dédupliquées automatiquement
- Le tableau des pointages supporte le scroll virtuel
- Recherche en temps réel sur les employés
