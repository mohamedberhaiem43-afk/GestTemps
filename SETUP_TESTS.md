# Configuration du Projet de Tests - ABRPOINT.Server.Tests

## Structure du Projet

```
ABRPOINT.Server.Tests/
├── CalculService/
│   ├── Fixtures/
│   │   ├── ParametreFixtures.cs         # Paramètres de test
│   │   ├── PresenceDtoFixtures.cs       # Présences de test
│   │   └── PosteFixtures.cs             # Postes de test
│   ├── AbsenceCalculationParameterTests.cs    # Tests absence
│   ├── EtatPeriodiquCalculationTests.cs       # Tests état périodique
│   ├── HeureSuppServiceTests.cs               # Tests heures supp
│   └── README_TESTS.md                  # Documentation complète
├── ABRPOINT.Server.Tests.csproj         # Configuration du projet
└── xunit.runner.json (optionnel)        # Configuration xUnit

ABRPOINT.Server/
├── Models/
│   ├── Parametre.cs
│   ├── Poste.cs
│   └── ...
├── Dtaos/
│   └── PresenceDto.cs
├── CalculService/
│   ├── HeureSupp/
│   │   └── IHeureSuppService.cs
│   └── ...
└── Interfaces/
    ├── IParametreRepository.cs
    ├── ILcategorieRepository.cs
    └── ...
```

## Configuration du Fichier CSPROJ

Créez le fichier `ABRPOINT.Server.Tests/ABRPOINT.Server.Tests.csproj` :

```xml
<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <IsTestProject>true</IsTestProject>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.8.0" />
    <PackageReference Include="xunit" Version="2.6.0" />
    <PackageReference Include="xunit.runner.visualstudio" Version="2.5.0">
      <PrivateAssets>all</PrivateAssets>
      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
    </PackageReference>
    <PackageReference Include="Moq" Version="4.20.0" />
    <PackageReference Include="coverlet.collector" Version="5.0.0">
      <PrivateAssets>all</PrivateAssets>
      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
    </PackageReference>
    <PackageReference Include="FluentAssertions" Version="6.12.0" />
  </ItemGroup>

  <ItemGroup>
    <ProjectReference Include="../ABRPOINT.Server/ABRPOINT.Server.csproj" />
  </ItemGroup>

</Project>
```

## Fichier xunit.runner.json (optionnel)

Créez `ABRPOINT.Server.Tests/xunit.runner.json` pour personnaliser xUnit :

```json
{
  "$schema": "https://xunit.net/schema/current/xunit.runner.schema.json",
  "diagnosticMessages": false,
  "methodDisplay": "method",
  "parallelizeAssembly": true,
  "parallelizeTestCollections": true,
  "maxParallelThreads": 4,
  "shadowCopy": false
}
```

## Installation et Configuration

### 1. Créer le dossier de test

```bash
mkdir ABRPOINT.Server.Tests
```

### 2. Initialiser le projet

```bash
dotnet new xunit -n ABRPOINT.Server.Tests
```

### 3. Ajouter la référence au projet serveur

```bash
cd ABRPOINT.Server.Tests
dotnet add reference ../ABRPOINT.Server/ABRPOINT.Server.csproj
```

### 4. Ajouter les packages nécessaires

```bash
dotnet add package Moq
dotnet add package FluentAssertions
dotnet add package coverlet.collector
```

## Exécution des Tests

### Vue d'ensemble
```bash
# Tous les tests
dotnet test

# Tests spécifiques
dotnet test --filter "ClassName=HeureSuppServiceTests"

# Avec couverture
dotnet test /p:CollectCoverage=true

# Verbose
dotnet test -v detailed
```

### Commandes Détaillées

```bash
# Exécuter HeureSuppServiceTests
dotnet test ABRPOINT.Server.Tests/ABRPOINT.Server.Tests.csproj \
  --filter "ClassName=HeureSuppServiceTests"

# Exécuter EtatPeriodiquCalculationTests
dotnet test ABRPOINT.Server.Tests/ABRPOINT.Server.Tests.csproj \
  --filter "ClassName=EtatPeriodiquCalculationTests"

# Exécuter AbsenceCalculationParameterTests
dotnet test ABRPOINT.Server.Tests/ABRPOINT.Server.Tests.csproj \
  --filter "ClassName=AbsenceCalculationParameterTests"

# Un test spécifique
dotnet test ABRPOINT.Server.Tests/ABRPOINT.Server.Tests.csproj \
  --filter "Name~EarlyArrival"

# Rapport de couverture
dotnet test ABRPOINT.Server.Tests/ABRPOINT.Server.Tests.csproj \
  /p:CollectCoverage=true \
  /p:CoverageFormat=cobertura \
  /p:Exclude="[xunit*]*,[Moq]*"
```

## Organisation des Tests

### Par Classe de Test

1. **HeureSuppServiceTests.cs** (62 tests)
   - Calculs heures supplémentaires
   - Impact des paramètres
   - Tolérances d'entrée/sortie
   - Nuit et décalages
   - Cas limites

2. **EtatPeriodiquCalculationTests.cs** (42 tests)
   - État périodique complet
   - Absences et demi-journées
   - Retard et présence
   - Heures de nuit
   - Jours fériés
   - Déductions repos

3. **AbsenceCalculationParameterTests.cs** (48 tests)
   - Calcul heures absence
   - Impact paramètres stricts/flexibles
   - Congés vs absences
   - Absences multi-jour
   - Ancienneté
   - Arrondi

**Total : 152+ tests unitaires**

## Bonnes Pratiques

### 1. Nomenclature des Tests
```
[MethodName]_[Scenario]_[ExpectedBehavior]

Exemples :
- CalculateHeureSupp_EarlyArrival_ReturnsOneHour
- CalculateAbsence_FullDayAbsence_ReturnsFullDay
- CalculateHourLimits_StrictMode_MoreRestrictive
```

### 2. Structure Arrange-Act-Assert
```csharp
[Fact]
public void TestMethod_Scenario_Expected()
{
    // Arrange - Préparer les données
    var fixture = GetTestData();
    
    // Act - Exécuter l'action
    var result = method(fixture);
    
    // Assert - Vérifier le résultat
    Assert.Equal(expected, result);
}
```

### 3. Utilisation des Fixtures
```csharp
// Bonne pratique
var presence = PresenceDtoFixtures.CreateStandardPresence();

// Éviter la création manuelle
var presence = new PresenceDto { /* ... */ };
```

## Maintenance des Tests

### Mise à Jour des Modèles
Quand vous modifiez `Parametre.cs`, `Poste.cs`, ou `PresenceDto.cs` :
1. Mettre à jour les fixtures correspondantes
2. Vérifier les tests qui les utilisent
3. Ajouter des tests pour les nouveaux champs

### Ajout de Nouveaux Paramètres
Quand vous ajoutez un paramètre critique à `Parametre` :
1. Ajouter une fixture spécifique dans `ParametreFixtures.cs`
2. Ajouter des tests dans `EtatPeriodiquCalculationTests.cs`
3. Documenter le scénario

### Déboguer les Tests
```bash
# Arrêter après le premier échec
dotnet test --stop-on-failure

# Afficher les traces détaillées
dotnet test -v diag

# Mode débogage
dotnet test --debug
```

## Intégration avec CI/CD

### GitHub Actions
```yaml
name: Run Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-dotnet@v3
        with:
          dotnet-version: '8.0.x'
      - run: dotnet test ABRPOINT.Server.Tests/ABRPOINT.Server.Tests.csproj
```

### Azure Pipelines
```yaml
trigger:
  - main

pool:
  vmImage: 'ubuntu-latest'

steps:
- task: DotNetCoreCLI@2
  inputs:
    command: 'test'
    projects: 'ABRPOINT.Server.Tests/ABRPOINT.Server.Tests.csproj'
```

## Cas de Couverture de Tests

### Tests Heures Supplémentaires ✅
- [x] Présence normale
- [x] Arrivée tôt
- [x] Départ tard
- [x] Tolérance entrée
- [x] Tolérance sortie
- [x] Catégorie non éligible
- [x] Shift de nuit
- [x] Demi-journée
- [x] Absence
- [x] Paramètres stricts/flexibles

### Tests Absence ✅
- [x] Absence complète
- [x] Demi-journée
- [x] Absence partielle
- [x] Calcul heures absence
- [x] Congés vs absences
- [x] Multi-jour
- [x] Impact paramètres

### Tests Heures Nuit ✅
- [x] Activation/désactivation
- [x] Déduction panier
- [x] Exclusion si sortie jour
- [x] Majoré aux heures normales

### Tests Jours Fériés ✅
- [x] Travail autorisé
- [x] Élimination avant calcul
- [x] Élimination après calcul

## Améliorations Futures

1. **Tests Performance** : Benchmarking des services critiques
2. **Tests Stress** : 1000+ enregistrements
3. **Tests Edge Cases** : Années bisextiles, DST, etc.
4. **Mutation Testing** : Vérifier la qualité des tests
5. **Snapshot Testing** : Comparaison avec état attendu

## Support et Documentation

- 📖 [Documentation xUnit](https://xunit.net/)
- 🧪 [Guide Moq](https://github.com/moq/moq4)
- 📊 [Couverture Coverlet](https://github.com/coverlet-coverage/coverlet)

---

**Créé** : 2024  
**Dernière mise à jour** : Avril 2026  
**Statut** : ✅ Production Ready
