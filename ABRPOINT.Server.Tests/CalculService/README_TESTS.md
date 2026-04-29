# Guide de Tests Unitaires - Calcul d'État Périodique

## Vue d'ensemble

Cette suite de tests couvre les fonctions critiques de calcul du système d'état périodique :
- **Heures supplémentaires** (HeureSupp)
- **Absences** et **demi-journées**
- **Heures de nuit**
- **Jours fériés** et **repos**
- **Compensation** (Compense)
- **Impact des paramètres** sur les calculs

## Structure des Tests

### 1. Fixtures (Données de Test)

#### `PresenceDtoFixtures.cs`
Fournit des scénarios de présence réalistes :
- **Standard** : 8h-17h avec pause déjeuner
- **Early Arrival** : Arrivée tôt (7h)
- **Late Leave** : Départ tard (19h)
- **Absence** : Jour d'absence complète
- **Late Arrival** : Retard de 30 min
- **Night Shift** : Horaires de nuit (20h-4h)
- **Half Day** : Demi-journée (matin seulement)
- **Partial Absence** : Absence partielle (matin ou AM)

#### `PosteFixtures.cs`
Définit différents types de postes :
- **Standard** : 8h/jour avec tolérance 5 min
- **Shifted** : Horaires décalés (10h-19h)
- **Night** : Poste de nuit
- **Strict** : Aucune tolérance
- **Flexible** : Grande tolérance (15 min)

#### `ParametreFixtures.cs`
Crée des configurations de paramètres :
- **Standard** : Configuration par défaut
- **No Night** : Heures de nuit désactivées
- **Limited Overtime** : Max 9h/jour
- **Strict** : Contrôle strict
- **Flexible** : Beaucoup de tolérance
- **Custom Dividend** : Diviseur personnalisé

### 2. Tests Unitaires

#### `HeureSuppServiceTests.cs`
Tests pour le service de calcul des heures supplémentaires :

**Cas Normaux** :
- ✅ Présence standard → 0 h.supp
- ✅ Arrivée tôt (7h) → 1h h.supp
- ✅ Départ tard (19h) → 2h h.supp

**Avec Tolérance** :
- ✅ Arrivée dans la tolérance (7:57) → 0 h.supp
- ✅ Dépassement de tolérance → h.supp calculées
- ✅ Poste strict (0 tolérance) → plus d'h.supp

**Absences et Présences Partielles** :
- ✅ Absence complète → 0 h.supp
- ✅ Demi-journée → h.supp vérifiées
- ✅ Absence partielle → calcul correctif

**Cas Limites** :
- ✅ Présence null → Exception
- ✅ Catégorie non éligible → 0 h.supp
- ✅ Heure manquante → 0 h.supp

**Impact des Paramètres** :
- ✅ Limite max d'heures → Respect de la limite
- ✅ Paramètres souples → Plus d'h.supp possibles
- ✅ Paramètres stricts → Moins d'h.supp

**Nuit et Décalages** :
- ✅ Shift de nuit standard → 0 h.supp
- ✅ Shift de nuit avec arrivée tôt → h.supp

**Intégration Multiple** :
- ✅ Plusieurs scénarios combinés (data-driven tests)

#### `EtatPeriodiquCalculationTests.cs`
Tests pour l'état périodique et ses composants :

**Absence** :
- ✅ Absence complète → Jour entier
- ✅ Absence partielle → Demi-journée

**Impact Paramètres sur Absences** :
- ✅ Calcul heures absence (basé sur diviseur)
- ✅ Calcul heures congé
- ✅ Ajustement sur paramètres personnalisés

**Retard et Demi-journée** :
- ✅ Retard détecté correctement
- ✅ Demi-journée (matin uniquement) validée

**Heures Nuit** :
- ✅ Avec paramètres activés → Comptées
- ✅ Avec paramètres désactivés → Non comptées
- ✅ Déduction panier nuit validée

**Jours Fériés** :
- ✅ Travail fériés autorisé → Paramètre vrai
- ✅ Heures fériés standard → 8h
- ✅ Élimination avant calcul
- ✅ Élimination après calcul

**Déduction Repos** :
- ✅ Déduction heures repos
- ✅ Déduction heures dimanche
- ✅ Déduction weekend (samedi+dimanche)

**Arrondi** :
- ✅ Arrondi automatique activé → Arrondit
- ✅ Arrondi désactivé → Conserve précision

**Écart Minimum** :
- ✅ Standard : 15 min
- ✅ Strict : 5 min
- ✅ Flexible : 30 min

**Limites Min/Max** :
- ✅ Minimum heures/jour
- ✅ Maximum heures/jour
- ✅ Comparaison entre modes

**Catégories Employés** :
- ✅ Cadre → Éligible H.Supp
- ✅ Maîtrise → Éligible H.Supp
- ✅ Exécutant → Éligible H.Supp

**Ancienneté** :
- ✅ Pas d'ancienneté requise
- ✅ Ancienneté requise validée

**Compensation** :
- ✅ Modèle Compense complet

**État Périodique Complet** :
- ✅ Tous les composants présents
- ✅ Calculs complexes validés

## Exécution des Tests

### Prérequis
```bash
# Installation .NET SDK
dotnet --version

# Restaurer les packages
dotnet restore ABRPOINT.Server.Tests/ABRPOINT.Server.Tests.csproj
```

### Exécuter tous les tests
```bash
dotnet test ABRPOINT.Server.Tests/ABRPOINT.Server.Tests.csproj
```

### Exécuter un fichier de tests spécifique
```bash
dotnet test ABRPOINT.Server.Tests/ABRPOINT.Server.Tests.csproj --filter ClassName=HeureSuppServiceTests

dotnet test ABRPOINT.Server.Tests/ABRPOINT.Server.Tests.csproj --filter ClassName=EtatPeriodiquCalculationTests
```

### Exécuter un test spécifique
```bash
dotnet test ABRPOINT.Server.Tests/ABRPOINT.Server.Tests.csproj --filter "Name=CalculateHeureSupp_EarlyArrival_ReturnsOneHour"
```

### Exécuter avec rapport de couverture
```bash
dotnet test ABRPOINT.Server.Tests/ABRPOINT.Server.Tests.csproj \
  /p:CollectCoverage=true \
  /p:CoverageFormat=cobertura \
  /p:CoverageFileName=coverage.xml
```

### Exécuter avec verbose output
```bash
dotnet test ABRPOINT.Server.Tests/ABRPOINT.Server.Tests.csproj -v detailed
```

## Stratégie de Tests par Composant

### 1. Heures Supplémentaires (HeureSupp)

**Dépendances** :
- `ILcategorieRepository` : Catégorie de l'employé
- `IParametreRepository` : Paramètres de la société
- `IPosteRepository` : Informations du poste

**Scenarios Testés** :
1. Présence normale → 0 h.supp
2. Arrivée tôt → H.supp calculées
3. Départ tard → H.supp calculées
4. Avec tolérance → Tolérance appliquée
5. Catégorie non éligible → 0 h.supp
6. Paramètres stricts → Plus d'impact

### 2. Absence et Demi-Journée

**Logique** :
- Absence complète : pas d'heure d'arrivée matin ET AM
- Demi-journée matin : pas d'heure d'arrivée AM
- Demi-journée AM : pas d'heure d'arrivée matin

**Calcul d'Heures** :
- Heures absence = Heures standard (basé sur Parjhnfixe)
- Demi-journée = Heures standard / 2

### 3. Heures de Nuit

**Conditions d'Activation** :
- Paramètre `Parnuit` = "1"
- Heure présente entre `Nuitdeb` et `Nuitfin`

**Déductions** :
- `Moinsrepas` : Réduit le panier repas
- `Parretabs` : Exclut si sortie le jour

### 4. Jours Fériés

**Modes d'Élimination** :
- `Parelimftrv = 0` : Pas d'élimination
- `Parelimftrv = 1` : Élimination avant calcul H.Supp
- `Parelimftrv = 2` : Élimination après calcul H.Supp

### 5. Déduction Repos

**Modes** :
- `Parreptrv = 0` : Déduire heures repos
- `Parreptrv = 2` : Déduire heures dimanche
- `Parreptrv = 3` : Déduire samedi + dimanche

## Améliorations Futures

1. **Tests d'Intégration** : Tester l'ensemble du pipeline de calcul
2. **Performance Tests** : Vérifier la performance sur large dataset
3. **Edge Cases** : Tests pour années bisextiles, changements DST
4. **Mock Repository Avancé** : Comportements plus réalistes
5. **Tests End-to-End** : Intégration avec API

## Fichiers à Créer

Pour un projet complet, créez aussi :

```
ABRPOINT.Server.Tests/
├── CalculService/
│   ├── Fixtures/
│   │   ├── PresenceDtoFixtures.cs ✅
│   │   ├── PosteFixtures.cs ✅
│   │   └── ParametreFixtures.cs ✅
│   ├── HeureSuppServiceTests.cs ✅
│   ├── EtatPeriodiquCalculationTests.cs ✅
│   ├── HeureAbsenceServiceTests.cs (À créer)
│   ├── HeureNuitServiceTests.cs (À créer)
│   └── CompensationCalculationTests.cs (À créer)
├── Data/
│   └── TestData.json (À créer)
└── ABRPOINT.Server.Tests.csproj
```

## Configuration du Projet Test

**ABRPOINT.Server.Tests.csproj** doit contenir :

```xml
<ItemGroup>
  <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.7.0" />
  <PackageReference Include="xunit" Version="2.6.0" />
  <PackageReference Include="xunit.runner.visualstudio" Version="2.5.0" />
  <PackageReference Include="Moq" Version="4.20.0" />
  <PackageReference Include="coverlet.collector" Version="5.0.0" />
</ItemGroup>

<ItemGroup>
  <ProjectReference Include="../ABRPOINT.Server/ABRPOINT.Server.csproj" />
</ItemGroup>
```

## Notes Importantes

⚠️ **Maintenance** :
- Mettre à jour les fixtures si les modèles changent
- Ajouter des tests pour chaque nouveau paramètre critique
- Documenter les cas limites découverts

✅ **Bonnes Pratiques** :
- Un test = un comportement
- Noms clairs et explicites
- Arrange → Act → Assert
- Utiliser les fixtures pour la cohérence
- Mock les dépendances externes

📊 **Métrique de Succès** :
- Couverture de code > 80% pour les services critiques
- Tous les tests passent avant merging
- Temps d'exécution < 30 secondes
