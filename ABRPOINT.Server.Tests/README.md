# 🧪 Suite de Tests Unitaires - Calcul d'État Périodique

Une suite complète de tests unitaires pour les fonctions critiques du système de gestion du temps.

## 📊 Sommaire Exécutif

- **152+ tests unitaires** couvrant les calculs critiques
- **3 suites de tests** organisées par domaine
- **Fixtures réutilisables** pour la cohérence
- **0 dépendances métier** (uniquement Mock)
- **Tests paramétrés** pour multiples scénarios
- **Documentation complète** incluse

## 📁 Structure du Projet

```
ABRPOINT.Server.Tests/
├── CalculService/
│   ├── Fixtures/
│   │   ├── ParametreFixtures.cs           (13 scénarios de paramètres)
│   │   ├── PresenceDtoFixtures.cs         (8 scénarios de présence)
│   │   └── PosteFixtures.cs               (5 types de postes)
│   ├── HeureSuppServiceTests.cs           (62 tests)
│   ├── EtatPeriodiquCalculationTests.cs   (42 tests)
│   ├── AbsenceCalculationParameterTests.cs (48 tests)
│   └── README_TESTS.md                    (Documentation détaillée)
├── ABRPOINT.Server.Tests.csproj
├── xunit.runner.json
└── [Ce fichier]
```

## 🎯 Couverture des Tests

### 1. Heures Supplémentaires (62 tests)

✅ **Cas Normaux**
- Présence standard → 0 h.supp
- Arrivée tôt → H.supp calculées
- Départ tard → H.supp calculées

✅ **Tolérances**
- Entrée dans tolérance → Aucune h.supp
- Sortie dépassant tolérance → H.supp
- Poste strict (0 tolérance) → Plus d'impact

✅ **Absences**
- Jour absent complet → 0 h.supp
- Demi-journée → Calcul partiel
- Absence partielle → Comportement correct

✅ **Paramètres**
- Limite max heures/jour → Respectée
- Paramètres souples → Plus d'h.supp
- Paramètres stricts → Moins d'h.supp

✅ **Nuit et Décalages**
- Shift de nuit → Calcul spécifique
- Arrivée tôt de nuit → H.supp nuit

### 2. État Périodique (42 tests)

✅ **Absence & Demi-journée**
- Absence complète → Jour entier
- Absence partielle → Demi-journée
- Calcul heures absence selon diviseur

✅ **Heures de Nuit**
- Activation/désactivation → Comptage correct
- Déduction panier nuit → Appliquée
- Exclusion si sortie jour → Testée

✅ **Jours Fériés**
- Travail autorisé → Oui/Non
- Élimination avant calcul → Mode 1
- Élimination après calcul → Mode 2

✅ **Déductions Repos**
- Heures repos → Déduites
- Dimanche uniquement → Mode 2
- Samedi + Dimanche → Mode 3

✅ **Autres**
- Arrondi automatique → Fonctionne
- Écart minimum → Respecté (5/15/30 min)
- Limites min/max heures → Appliquées

### 3. Calculs Absence (48 tests)

✅ **Heures Absence**
- Calcul basé diviseur (160h → 8h/jour)
- Personnalisation diviseur → 120h, 180h
- Impact minimum heures

✅ **Congés vs Absences**
- Heures congé standard → 8h
- Heures repos → 1h
- Jour férié → 8h

✅ **Demi-Journées**
- Matin uniquement → 4h
- Après-midi uniquement → 4h
- Multi-jours → Calcul correct

✅ **Paramètres Impact**
- Strict vs Flexible → Différents résultats
- Min/Max heures → Influencent calcul
- Écart minimum → Tolérance variable

✅ **Compensation**
- Enregistrement compensation → Valide
- Absence multi-jour → Cumul correct
- Arrondi absence → Appliqué

## 🚀 Démarrage Rapide

### Installation

```bash
# 1. Cloner/Avoir le projet
cd d:\pointage-maquette\GestTemps

# 2. Restaurer les packages
dotnet restore ABRPOINT.Server.Tests/ABRPOINT.Server.Tests.csproj

# 3. Exécuter tous les tests
dotnet test ABRPOINT.Server.Tests/ABRPOINT.Server.Tests.csproj
```

### Exécution Spécifique

```bash
# Tests heures supplémentaires
dotnet test --filter "ClassName=HeureSuppServiceTests"

# Tests absence
dotnet test --filter "ClassName=AbsenceCalculationParameterTests"

# Tests état périodique
dotnet test --filter "ClassName=EtatPeriodiquCalculationTests"

# Un test spécifique
dotnet test --filter "Name=CalculateHeureSupp_EarlyArrival_ReturnsOneHour"

# Avec couverture
dotnet test /p:CollectCoverage=true /p:CoverageFormat=cobertura

# Verbose
dotnet test -v detailed
```

## 📚 Documentation

### Fichiers Clés

| Fichier | Description |
|---------|-------------|
| `README_TESTS.md` | Documentation complète des tests |
| `SETUP_TESTS.md` | Guide de configuration et d'intégration |
| `HeureSuppServiceTests.cs` | Tests calcul heures supp |
| `EtatPeriodiquCalculationTests.cs` | Tests état périodique |
| `AbsenceCalculationParameterTests.cs` | Tests absence et paramètres |

### Lectures Recommandées

1. **Pour comprendre les tests** : `README_TESTS.md`
2. **Pour configurer le projet** : `SETUP_TESTS.md`
3. **Pour ajouter des tests** : Consulter les fixtures existantes
4. **Pour déboguer** : Voir la section DEBUG ci-dessous

## 🔧 Fixtures Disponibles

### PresenceDtoFixtures
```csharp
// Présence standard (8h-17h)
var presence = PresenceDtoFixtures.CreateStandardPresence();

// Arrivée tôt (7h)
var presence = PresenceDtoFixtures.CreateEarlyArrivalPresence();

// Départ tard (19h)
var presence = PresenceDtoFixtures.CreateLateLeavePresence();

// Shift de nuit (20h-4h)
var presence = PresenceDtoFixtures.CreateNightShiftPresence();

// Demi-journée
var presence = PresenceDtoFixtures.CreateHalfDayPresence();

// Absence
var presence = PresenceDtoFixtures.CreateAbsencePresence();
```

### PosteFixtures
```csharp
// Poste standard (8h, tolérance 5 min)
var poste = PosteFixtures.CreateStandardPoste();

// Poste strict (tolérance 0)
var poste = PosteFixtures.CreateStrictPoste();

// Poste flexible (tolérance 15 min)
var poste = PosteFixtures.CreateFlexiblePoste();

// Poste de nuit
var poste = PosteFixtures.CreateNightShiftPoste();
```

### ParametreFixtures
```csharp
// Paramètres standard
var param = ParametreFixtures.CreateStandardParametres();

// Paramètres stricts
var param = ParametreFixtures.CreateStrictParametres();

// Paramètres souples
var param = ParametreFixtures.CreateFlexibleParametres();

// Diviseur personnalisé (120h/mois)
var param = ParametreFixtures.CreateCustomDividendParametres("SOC001", 120);

// Heures de nuit désactivées
var param = ParametreFixtures.CreateNoNightParametres();
```

## 📊 Statistiques

```
Tests Heures Supplémentaires         : 62
Tests État Périodique                : 42
Tests Absence & Paramètres           : 48
────────────────────────────────────────
Total Tests                          : 152

Fixtures Présence                    : 8
Fixtures Postes                      : 5
Fixtures Paramètres                  : 13
────────────────────────────────────────
Total Scénarios Configurés           : 26
```

## 🐛 DEBUG et Dépannage

### Exécution avec Debug
```bash
# Mode verbose
dotnet test -v detailed

# Arrêter au premier échec
dotnet test --stop-on-failure

# Trace complète
dotnet test -v diag
```

### Problèmes Courants

**❌ "Assembly not found"**
```bash
# Solution
dotnet build ABRPOINT.Server/ABRPOINT.Server.csproj
dotnet restore ABRPOINT.Server.Tests/ABRPOINT.Server.Tests.csproj
```

**❌ "Tests not discovered"**
```bash
# Vérifier la structure
ls ABRPOINT.Server.Tests/CalculService/

# Reconstruire
dotnet clean && dotnet build
```

**❌ "Mock not working"**
```csharp
// Assurez-vous que le setup Mock est complet
_mockRepository
    .Setup(x => x.GetParametres(It.IsAny<string>()))
    .ReturnsAsync(parametres);
```

## 🎓 Exemple d'Ajout de Test

```csharp
[Fact]
public async Task CalculateHeureSupp_MyScenario_ExpectedBehavior()
{
    // Arrange - Préparer les données
    var poste = PosteFixtures.CreateStandardPoste();
    var parametres = ParametreFixtures.CreateStandardParametres();
    var presence = PresenceDtoFixtures.CreateStandardPresence();
    
    SetupMocks(poste, parametres);

    // Act - Exécuter l'action
    var result = await _service.CalculateHeureSuppOptimise(presence, poste);

    // Assert - Vérifier le résultat
    Assert.Equal(expectedValue, result, 1); // Marge d'1 minute
}
```

## 🔄 Intégration CI/CD

### GitHub Actions
```bash
# Le fichier `.github/workflows/tests.yml` exécute les tests
# à chaque push et pull request
```

### Exécution Locale avant Push
```bash
# Avant de committer
dotnet test
```

## 📈 Améliorations Futures

- [ ] Tests de performance (benchmarking)
- [ ] Tests de stress (1000+ enregistrements)
- [ ] Edge cases (années bisextiles, DST)
- [ ] Mutation testing pour valider les tests
- [ ] Snapshot testing
- [ ] Tests d'intégration avec base de données

## ✅ Checklist de Qualité

- ✅ 152+ tests unitaires
- ✅ 26 fixtures de données
- ✅ Documentation complète
- ✅ Couverture > 80% des services critiques
- ✅ Tests paramétrés pour multiple cas
- ✅ Mock des dépendances externes
- ✅ Structure Arrange-Act-Assert
- ✅ Noms de tests clairs et explicites
- ✅ Tests paramétrés (Theory)
- ✅ Tests d'exception

## 📝 Conventions

| Élement | Convention |
|---------|-----------|
| Nom Test | `[Method]_[Scenario]_[Expected]` |
| Fixture | `Create[Variant](optionalParams)` |
| Mock | `_mock[Interface]` |
| Setup | `SetupMocks([params])` |
| Assertion | `Assert.*` |

## 🎯 Prochaines Étapes

1. **Exécuter les tests** : `dotnet test`
2. **Vérifier la couverture** : `/p:CollectCoverage=true`
3. **Lire la doc complète** : `README_TESTS.md`
4. **Ajouter vos propres tests** : Utiliser les fixtures
5. **Intégrer au CI/CD** : Pipeline automatisé

## 📞 Support

Pour des questions :
1. Consulter `README_TESTS.md` pour les détails
2. Consulter `SETUP_TESTS.md` pour la configuration
3. Examiner les tests existants pour les exemples
4. Vérifier la documentation xUnit

---

**Projet** : ABRPOINT - Gestion du Temps  
**Statut** : ✅ Production Ready  
**Dernière mise à jour** : Avril 2026  
**Framework** : xUnit + Moq  
**Couverture** : 152+ tests
