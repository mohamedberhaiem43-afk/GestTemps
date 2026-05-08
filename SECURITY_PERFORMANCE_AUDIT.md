# 🔒 Audit de Sécurité et Performance — GestTemps / ABRPOINT

**Date :** 8 mai 2026  
**Périmètre :** État Périodique, Pointage du Mois, Présences  
**Outil :** Revue de code statique (Controllers, Services, Repository, Frontend)

---

## 📊 Résumé Exécutif

| Catégorie | Critique | Élevé | Moyen | Faible |
|-----------|----------|-------|-------|--------|
| Sécurité  | 2        | 3     | 3     | 2      |
| Performance | 2      | 3     | 2     | 0      |

---

## 🔴 VULNÉRABILITÉS DE SÉCURITÉ

### S1. [CRITIQUE] PointageMoisController — Absence d'authentification
**Fichier :** `Controllers/PointageMoisController.cs`  
**Ligne :** 15-16

L'attribut `[Authorize]` est **absent** et le `[CanGetEtatMensuelle]` est **commenté**. N'importe qui (anonyme) peut appeler :
```
GET /api/PointageMois/{soccod}/{mois}/{annee}/{semaine}?empcods=...
```
→ **Fuite de données RH** : heures supplémentaires, noms, régimes, sites de tous les employés.

```csharp
// VULNÉRABLE :
//[CanGetEtatMensuelle]
[HttpGet("{soccod}/{mois}/{annee}/{semaine}")]
public async Task<IActionResult> GetPointageMois(...)
```

**Fix :** Ajouter `[Authorize]` + décommenter `[CanGetEtatMensuelle]`.

---

### S2. [CRITIQUE] Secrets codés en dur dans appsettings.json
**Fichier :** `ABRPOINT.Server/appsettings.json`

| Secret | Valeur exposée |
|--------|---------------|
| JWT Key | `This is a sample secret key - please don't use in production environment.'` |
| Stripe Secret Key | `sk_test_51TNzqy...` |
| Stripe Webhook Secret | `whsec_TwFTXT...` |
| Gemini API Key | `AIzaSyDbq8eg...` |
| OpenRouter API Key | `sk-or-v1-f3261c2c...` |
| SMTP Password | `Concorde@2026!` |
| AES Encryption Key | `G3stT3mps@2024!S3cur3K3y#Encr1pt10n` |

→ **Risque :** Ce fichier est dans le dépôt Git. Tout clone expose les credentials.  
→ **Clé JWT faible** = possible forgery de token.

**Fix :** Utiliser des variables d'environnement ou Azure Key Vault. Ne jamais committer de secrets.

---

### S3. [ÉLEVÉ] Pas de validation d'appartenance tenant (soccod)
**Fichiers :** Tous les Controllers (PresencesController, PointageMoisController, etc.)

Le `soccod` provient de l'URL. Un utilisateur authentifié de la société A peut interroger les données de la société B en changeant simplement le paramètre URL :

```
GET /api/Presences/SOCIETE_B/2026-01-01/2026-01-31/T
```

Aucun contrôle ne vérifie que l'utilisateur connecté appartient au `soccod` demandé.

**Fix :** Valider `soccod` contre le claim JWT de l'utilisateur dans un filtre middleware ou dans chaque contrôleur.

---

### S4. [ÉLEVÉ] PresencesController — Endpoints sans permission fine
**Fichier :** `Controllers/PresencesController.cs`

Seul `GetEmpEtatPeriodiqueByDate` (ligne 108) a un attribut de permission `[CanGetEtatPeriodique]`.  
Les endpoints suivants n'ont **aucune** vérification de permission :

| Endpoint | Méthode | Risque |
|----------|---------|--------|
| `/{soccod}/{dateDebut}/{dateFin}/{regime}` | GET | Lecture de toutes les présences |
| `Post` | POST | Création de pointage falsifié |
| `Put /{soccod}/{empcod}/{predat}` | PUT | Modification de pointage |
| `Delete /{soccod}/{concod}` | DELETE | Suppression de pointage |
| `/mark-presence/{soccod}/{empcod}` | POST | Faux pointage |
| `/daily-pointage/{soccod}/{date}` | GET | Espionnage du pointage |
| `/my-history/{soccod}/{empcod}/...` | GET | Accès historique tiers |
| `/optimiserPointage/...` | PUT | Manipulation de l'optimisation |

**Fix :** Ajouter les attributs de permission appropriés à chaque endpoint.

---

### S5. [ÉLEVÉ] clientTime falsifiable dans mark-presence
**Fichier :** `Controllers/PresencesController.cs`, ligne 189

Le client mobile envoie `clientTime` en query param. Un utilisateur malveillant peut falsifier l'horodatage pour pointer rétroactivement ou dans le futur :

```
POST /api/Presences/mark-presence/SOC01/EMP01?clientTime=2026-05-01T08:00:00
```

Bien qu'il y ait des gardes-fous (embauche/sortie), la validation est insuffisante pour les pointages dans le passé proche (ex: pointage d'hier).

**Fix :** Ajouter une validation : `|clientTime - serverTime| < tolérance` (ex: 5 minutes).

---

### S6. [MOYEN] Dictionnaire statique non thread-safe
**Fichier :** `Repository/PresenceRepository.cs`, ligne 81

```csharp
private static readonly Dictionary<string, int> _longbdgCache = new Dictionary<string, int>();
```

`Dictionary<TKey, TValue>` n'est **pas thread-safe**. Des requêtes concurrentes peuvent corrompre la structure ou lever des exceptions. De plus, le cache n'est jamais rempli.

**Fix :** Utiliser `ConcurrentDictionary<string, int>` ou `IMemoryCache`.

---

### S7. [MOYEN] Fuite d'informations dans les messages d'erreur
**Fichiers :** PresencesController.cs (ligne 287-293), PresenceRepository.cs

Des stack traces et messages internes sont renvoyés au client :
```csharp
return StatusCode(500, new { message = $"Erreur lors du pointage : {rootMessage}", details = ex.Message });
```

**Fix :** En production, logger l'exception côté serveur et renvoyer un message générique.

---

### S8. [MOYEN] Pas de limitation de débit sur les endpoints critiques
Seul le endpoint RAG a un rate limiter (`rag-ask`). Les opérations de pointage, lecture d'état, et export PDF n'ont aucune protection contre le brute force ou le DoS.

**Fix :** Appliquer un rate limiting global ou par endpoint sensible.

---

### S9. [FAIBLE] CORS multi-origines en production
**Fichier :** `Program.cs`, ligne 198-216

La policy `AllowReactApp` liste des URLs `localhost` et `exp://` qui ne doivent pas être autorisées en production.

**Fix :** Charger les origines depuis la configuration, conditionner au environnement.

---

### S10. [FAIBLE] Pas de validation des paramètres d'entrée
**Fichier :** `Controllers/PointageMoisController.cs`

`mois`, `annee`, `semaine` sont des `string` sans validation. Des valeurs comme `mois=../../../` ou `semaine=999` pourraient provoquer un comportement inattendu.

**Fix :** Valider les plages (mois 1-12, année > 2000, semaine 0-6).

---

## ⚡ PROBLÈMES DE PERFORMANCE

### P1. [CRITIQUE] Boucle N+1 dans PointageMoisService.GetPointageMois
**Fichier :** `Repository/PointageMoisService.cs`, lignes 22-58

```csharp
foreach (var empcod in empcods)  // ← N employees
{
    var employe = await _employeRepository.GetByEmpcod(soccod, empcod);  // ← 1 query
    var resultats = await _heuresSupplementairesService
        .CalculerHeuresSupplementairesMultiSemaines(...);  // ← 6 semaines × ~5 queries
}
```

**Impact estimé :** Pour 50 employés × (1 + 6×5) = **1 550 requêtes SQL séquentielles**.  
**Temps :** ~15-30 secondes pour un mois complet.

**Fix :** Charger tous les employés en une seule requête, paralléliser les calculs par employé.

---

### P2. [CRITIQUE] O(N×J) requêtes dans EtatPeriodique — GetEmpEtatPeriodiqueAsync
**Fichier :** `Repository/PresenceRepository.cs`, lignes 714-1000

La boucle `for (DateTime date = dateDeb; date <= dateFin; ...)` (jusqu'à 31 jours) contient **pour CHAQUE jour** :

| Appel async | Ligne | Requête DB? |
|-------------|-------|-------------|
| `_parametreRepository.IsEmpcodReposAsync(...)` | 855 | ✅ Oui |
| `_parametreRepository.IsReposAsync(...)` | 857 | ✅ Oui |
| `_parametreRepository.GetEtatPeriodiqueParamAsync(...)` | 859 | ✅ Oui |
| `_posteRepository.GetPoste(...)` | 869 | ❌ (déjà en cache) |
| `_posteRepository.GetJourHeures(...)` | 870 | ✅ Oui |
| `_heureSuppService.CalculateHeureSuppOptimise(...)` | 893 | ✅ Oui |
| `_jourFerierRepository.GetFerheure(...)` | 905 | ✅ Oui |
| `_parametreRepository.GetNbhCongeAsync(...)` | 936 | ✅ Oui |
| `_retardService.CalculateHeureRetard(...)` | 987 | ✅ Oui |
| `_absenceService.CalculateHeureAbsences(...)` | 956 | ✅ Oui |

**Impact :** ~8-10 requêtes/jour × 31 jours = **~250-310 requêtes SQL pour UN seul employé**.  
Pour 10 employés ouverts en parallèle = **2 500+ requêtes**.

**Fix :** Pré-charger en batch les paramètres (IsRepos, ArrondiParam, NbhConge, GetJourHeures) avant la boucle.

---

### P3. [ÉLEVÉ] RetardService appelé par présence dans GetAllAsync (multi-employés)
**Fichier :** `Repository/PresenceRepository.cs`, ligne 610

Dans la boucle `foreach (var item in presences)`, le calcul de retard est appelé pour chaque présence individuelle :
```csharp
var calc = await _retardService.CalculateHeureRetard(dto, poste, aut);
```

Pour 200 présences (10 employés × 20 jours), cela génère 200 appels au service de retard.

**Fix :** Pré-calculer les retards en batch ou utiliser les valeurs pré-calculées en base.

---

### P4. [ÉLEVÉ] GetNbJoursAsync — N+1 sur les congés
**Fichier :** `Repository/PresenceRepository.cs`, lignes 454-461

```csharp
foreach (var p in presences)
{
    var conge = await _congeRepository.GetCongeLibAsync(...);  // ← 1 query par présence
}
```

**Fix :** Batch charger les congés comme dans `GetEmpEtatPeriodiqueAsync`.

---

### P5. [ÉLEVÉ] Pas de pagination — GetAllAsync() sans filtre
**Fichier :** `Repository/PresenceRepository.cs`, ligne 475

```csharp
public async Task<IEnumerable<Presence>> GetAllAsync()
{
    return await _dbContext.Presences.ToListAsync();  // ← Charge TOUTE la table
}
```

Avec des années de données, la table Presences peut contenir des millions de lignes.

**Fix :** Ajouter pagination obligatoire (pageIndex, pageSize) ou supprimer cet endpoint.

---

### P6. [MOYEN] Paramètres chargés sans filtre soccod
**Fichier :** `Repository/PresenceRepository.cs`, ligne 292

```csharp
var param = await _dbContext.Parametres.FirstOrDefaultAsync();  // ← Sans WHERE soccod
```

En multi-tenant, cela peut renvoyer les paramètres d'une autre société.

**Fix :** Toujours filtrer par `soccod` : `_dbContext.Parametres.Where(p => p.Soccod == soccod).FirstOrDefaultAsync()`.

---

### P7. [MOYEN] Appels redondants à GetSuppAndFerierParamAsync
**Fichier :** `CalculService/HeureSupp/HeuresSupplementaireHebdomadaireService.cs`, lignes 113 et 117

```csharp
var paramSupp = await _parametreRepository.GetSuppAndFerierParamAsync(soccod, empniveau);
// ... puis immédiatement :
result.HreFerieTrv = Math.Min(res.NbhFerierTrv ?? 0, 
    (await _parametreRepository.GetSuppAndFerierParamAsync(soccod, empniveau)).MaxFerier ?? 0);
```

Le même paramètre est chargé **deux fois** en 4 lignes.

**Fix :** Réutiliser `paramSupp` déjà chargé.

---

## 🛠️ Corrections Prioritaires Implémentées

Les corrections suivantes ont été appliquées dans cette session :

1. ✅ **S1** — `[Authorize]` + permission sur PointageMoisController
2. ✅ **P1** — Parallélisation + batch dans PointageMoisService
3. ✅ **S6** — Remplacement du Dictionary statique par ConcurrentDictionary
4. ✅ **S10** — Validation des paramètres dans PointageMoisController
5. ✅ **P7** — Élimination de l'appel redondant GetSuppAndFerierParamAsync

### Passe complémentaire (08/05/2026)

6. ✅ **S3** — Filtre `[ValidateSoccod]` (Authorization/ValidateSoccodAttribute.cs) appliqué sur `PresencesController` et `PointageMoisController`. Vérifie via la table `Socuser` que l'uticod du JWT est bien rattaché au `soccod` demandé. Bypass admin (Utiadm=1 ou rôle admin) pour ne pas casser les écrans multi-sociétés. Cache 60 s par (slug, uticod).
7. ✅ **S4** — Permissions ajoutées sur tous les endpoints de `PresencesController` :
   - `[CanGetEtatPeriodique]` sur les lectures (Get, GetEmpEtatPeriodique, daily-pointage, etat-global, etat-detaille, get-etat-presence-report)
   - `[CanGetEtatRetard]` sur le rapport retard
   - `[CanAddEtatPeriodique]` sur POST
   - `[CanUpdateEtatPeriodique]` sur PUT, optimiserPointage, update-compensation
   - `[CanDeleteEtatPeriodique]` sur DELETE
   - `my-history` : self-service (un employé voit son propre historique) ; sinon permission consult requise.
8. ✅ **S5** — `mark-presence` : tolérance de ±10 min entre `clientTime` et l'horloge serveur. Au-delà → 422 + log structurel.
9. ✅ **S7** — Helper `MaskedError(...)` qui masque la stack/message racine en production (`IWebHostEnvironment`). Logs structurels conservés côté serveur. Appliqué dans Get, daily-pointage, my-history, mark-presence, Put, UpdateComponsation.
10. ✅ **S8** — Policy `clock-in` (6 req/min/uticod ou IP) attachée à `mark-presence` via `[EnableRateLimiting("clock-in")]`. Bloque les replays et l'automatisation.
11. ✅ **S9** — CORS conditionnel : whitelist localhost/exp:// uniquement en dev. En prod, lecture depuis `Cors:AllowedOrigins` ; sans configuration → same-origin only.
12. ✅ **P6** — `UpdateExistingPresence` : `Parametres.FirstOrDefaultAsync()` filtré par `soccod` (avec fallback legacy si vide).

### Passe finale (08/05/2026)

13. ✅ **S2** — `Helpers/SecretsValidator.cs` exécuté au boot via `Program.cs`. Détecte les valeurs placeholder connues (Jwt:Key sample, Encryption:AesKey codée, SMTP `Concorde@2026!`) et la longueur insuffisante. **Refuse le démarrage en production** ; en dev → warning structuré uniquement. Toute clé peut être surchargée par variable d'environnement (`Jwt__Key`, `Encryption__AesKey`, `Stripe__SecretKey`…). `sk_test_` détecté en prod = échec ; en dev = info.
14. ✅ **P4** — `GetNbJoursAsync` : 1 seule requête `Conges` sur la fenêtre [minDate, maxDate] au lieu de N appels `GetCongeLibAsync`. Détection de chevauchement faite localement (Conamret pris en compte). Pour 30 jours : 1 requête au lieu de 30.
15. ✅ **P5** — `Presences.GetAllAsync()` (sans filtre) plafonné à 1000 lignes avec `OrderByDescending(Predat)`. Aucun appelant connu, mais l'interface IRepository impose la signature ; le plafond protège contre la régression future.

## 📋 Plan d'Action Restant

| Priorité | Action | Effort | Statut |
|----------|--------|--------|--------|
| 🔴 P0 | **S2** — Définir réellement les variables d'env en prod (`Jwt__Key`, `Encryption__AesKey`, `Stripe__SecretKey`, …) — le validator au boot empêche désormais un déploiement avec placeholders | — | ✅ infrastructure prête, ⚠️ valeurs prod à pousser côté ops |
| 🔴 P0 | **P2** — Pré-charger les paramètres en batch dans EtatPeriodique (refactor à risque pour le calcul paie — nécessite tests de non-régression PDF avant/après) | 6h | ⏸ reporté |
| 🟠 P1 | **P3** — Batch RetardService.CalculateHeureRetard | 2h | ⏸ reporté (nécessite redesign du service retard pour accepter listes) |