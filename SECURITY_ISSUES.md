# 🔐 Rapport de Sécurité — GestTemps / ABRPOINT

> **Date :** 8 mai 2026  
> **Scope :** Vulnérabilités de sécurité identifiées hors problématiques de clé JWT (déjà traitées dans `SECURITY_AUDIT_MODULES.md` et `SECURITY_PERFORMANCE_AUDIT.md`)  
> **Méthode :** Revue de code statique manuelle — Controllers, Services, Configuration, Docker, Frontend

---

## Table des matières

1. [Résumé exécutif](#1-résumé-exécutif)
2. [Gestion des secrets](#2-gestion-des-secrets)
3. [Contrôle d'accès & Autorisation](#3-contrôle-daccès--autorisation)
4. [Sécurité des uploads de fichiers](#4-sécurité-des-uploads-de-fichiers)
5. [Validation des entrées & exposition de données](#5-validation-des-entrées--exposition-de-données)
6. [Sécurité Docker & Déploiement](#6-sécurité-docker--déploiement)
7. [Sécurité côté client](#7-sécurité-côté-client)
8. [Rate limiting & protection DoS](#8-rate-limiting--protection-dos)
9. [Matrice récapitulative](#9-matrice-récapitulative)
10. [Recommandations prioritaires](#10-recommandations-prioritaires)

---

## 1. Résumé exécutif

### Statistiques

| Sévérité | Nombre | Action |
|-----------|--------|--------|
| 🔴 **CRITIQUE** | 5 | Correction immédiate — bloque la production |
| 🟠 **ÉLEVÉ** | 10 | Corriger avant la mise en production |
| 🟡 **MOYEN** | 7 | Planifier dans le prochain sprint |
| 🔵 **FAIBLE** | 4 | Amélioration continue |

### Périmètre

Ce rapport couvre les domaines **non déjà traités** dans les audits existants :
- ✅ Déjà corrigé : `[Authorize]` manquants (A3), vérifications de propriété (A4/A5/A11/A12/A13), permissions granulaires (A10/A16), rate limiting auth (A7), validation `soccod` (S3), etc.
- ⚠️ Hors périmètre : Clé JWT faible (A1/A2), durée JWT mobile 30 jours (A6) — voir `SECURITY_PERFORMANCE_AUDIT.md`
- 🆕 Ce document : Secrets résiduels, contrôle d'accès sur modules non audités, upload de fichiers, Docker, client-side

---

## 2. Gestion des secrets

### SEC-01 🔴 CRITIQUE — SA_PASSWORD exposé en clair dans `docker-compose.yml`

**Fichier :** `docker-compose.yml:38`

```yaml
environment:
  SA_PASSWORD: "PX0m6jCr1S8CsBjJZDrQXj66vILUAOpvtYeqjr8aT4A="
```

Le mot de passe `sa` de SQL Server est écrit en dur dans le fichier `docker-compose.yml`, lui-même versionné dans le dépôt Git. Ce mot de passe est ensuite répété dans `DB_PASSWORD`, `ConnectionStrings__MasterConnection` et `ConnectionStrings__TenantTemplate`.

**Risque :** Tout clone du dépôt obtient un accès complet au serveur SQL Server en tant que `sa` (sysadmin). En production, cela donne un contrôle total sur toutes les bases de données de tous les tenants.

**Recommandation :** Utiliser Docker secrets, un fichier `.env` (ajouté au `.gitignore`), ou un vault. Ne jamais committer de mots de passe dans le dépôt.

---

### SEC-02 🔴 CRITIQUE — Secrets API committés dans `appsettings.json` (toujours présent)

**Fichier :** `ABRPOINT.Server/appsettings.json`

Bien que le `SecretsValidator` bloque le démarrage en production pour les valeurs placeholder, les **vraies clés API** restent dans le fichier versionné :

| Secret | Valeur | Risque |
|--------|--------|--------|
| `Gemini:ApiKey` | `AIzaSyDbq8…` (redacted) | Consommation API Google facturable |
| `OpenRouter:ApiKey` | `sk-or-v1-…` (redacted) | Consommation OpenRouter facturable |
| `Stripe:SecretKey` | `sk_test_…` (redacted) | Création de paiements, remboursements Stripe |
| `Stripe:WebhookSecret` | `whsec_…` (redacted) | Forge de webhooks Stripe |
| `Smtp:Password` | `Concorde@…` (redacted) | Envoi d'emails au nom de l'entreprise |
| `Encryption:AesKey` | `G3stT3mps@…` (redacted) | Déchiffrement de CIN, salaires, données personnelles |

**Recommandation :** Migrer **tous** ces secrets vers des variables d'environnement (la configuration .NET les accepte via `__` : `Gemini__ApiKey`, `Stripe__SecretKey`, etc.) et purger l'historique Git avec `git filter-branch` ou BFG Repo Cleaner.

---

### SEC-03 🟠 ÉLEVÉ — Mot de passe admin par défaut dans `docker-compose.yml`

**Fichier :** `docker-compose.yml:78`

```yaml
DatabaseInitialization__AdminPassword: "123"
```

Le compte administrateur initial est créé avec le mot de passe `123`. Si ce mot de passe n'est pas changé après la première installation, un attaquant qui le devine obtient un accès admin complet.

**Recommandation :** Générer un mot de passe aléatoire fort dans le `.env` et forcer son changement au premier login.

---

### SEC-04 🟡 MOYEN — `.gitignore` ne couvre pas les fichiers sensibles

**Fichier :** `.gitignore`

Le fichier `.gitignore` actuel ne contient **aucune entrée** pour :
- `appsettings.json` (ou `appsettings.Production.json`)
- `.env` / `.env.local` / `.env.production` (côté client)
- `docker-compose.override.yml` (peut contenir des secrets locaux)

Les fichiers `.env` du client (`abrpoint.client/.env`) sont déjà commités avec des clés API.

**Recommandation :** Ajouter :
```gitignore
# Secrets
**/appsettings.Production.json
**/.env
**/.env.local
!**/.env.example
docker-compose.override.yml
```

---

## 3. Contrôle d'accès & Autorisation

### SEC-05 🔴 CRITIQUE — `TenantPilotController` accessible sans authentification

**Fichier :** `Controllers/TenantPilotController.cs:20`

```csharp
[AllowAnonymous] // pour test : pas de JWT requis. À durcir en prod.
public class TenantPilotController : ControllerBase
```

Ce contrôleur expose **sans aucune authentification** :

| Endpoint | Données exposées |
|----------|-----------------|
| `GET /api/tenant-pilot/whoami` | `tenantId`, `slug`, `companyName`, `dbName`, `status`, `legacySoccod`, `trialEndsAt` |
| `GET /api/tenant-pilot/employees` | 10 premiers employés : `Empcod`, `Empmat`, `Emplib`, `Soccod`, `Sercod` |

Le commentaire `"À durcir en prod"` indique que c'est un endpoint de test jamais retiré.

**Risques :**
- **Énumération des tenants** : En faisant varier le header `X-Tenant-Slug`, un attaquant anonyme peut lister tous les tenants, leurs noms d'entreprise, et le nom de leur base de données.
- **Fuite de données RH** : Les noms et matricules des employés sont accessibles sans authentification.
- **Information disclosure** : Le `dbName` révèle la convention de nommage des bases SQL.

**Recommandation :** Supprimer ce contrôleur en production ou le protéger avec `[Authorize]` + `[Admin]`.

---

### SEC-06 🔴 CRITIQUE — `VaultController.DownloadDocument` et `PreviewDocument` sans vérification de propriété

**Fichier :** `Controllers/VaultController.cs:265-361`

```csharp
[HttpGet("download/{id}")]
public async Task<IActionResult> DownloadDocument(int id)
{
    var doc = await _vaultRepository.GetDocumentByIdAsync(id);
    // ... aucun contrôle de propriété ...
    return File(memory, GetContentType(filePath), doc.DocName);
}

[HttpGet("preview/{id}")]
public async Task<IActionResult> PreviewDocument(int id)
{
    var doc = await _vaultRepository.GetDocumentByIdAsync(id);
    // ... aucun contrôle de propriété ...
}
```

Contrairement à `GetDocuments` (ligne 33) et `DeleteDocument` (ligne 214) qui vérifient la propriété, les endpoints `download/{id}` et `preview/{id}` ne vérifient **pas** que l'utilisateur connecté est propriétaire du document ou admin/manager.

**Risque :** Tout utilisateur authentifié peut télécharger ou prévisualiser n'importe quel document du coffre-fort (fiches de paie, contrats, documents signés) en devinant l'ID séquentiel.

**Recommandation :** Appliquer la même logique d'autorisation que `DeleteDocument` : vérifier que `callerUticod == doc.Empcod` ou que l'appelant est admin/manager du même service.

---

### SEC-07 🟠 ÉLEVÉ — `VaultController.SignDocument` sans vérification de propriété

**Fichier :** `Controllers/VaultController.cs:363-380`

```csharp
[HttpPost("sign/{id}")]
public async Task<IActionResult> SignDocument(int id, [FromBody] SignRequest request)
{
    var doc = await _vaultRepository.GetDocumentByIdAsync(id);
    // ... aucun contrôle de propriété ...
    doc.IsSigned = true;
    doc.SignatureDate = DateTime.UtcNow;
    doc.Status = "Signed";
}
```

N'importe quel utilisateur authentifié peut **signer** n'importe quel document du coffre-fort. La signature électronique est ensuite bloquante pour la suppression (`IsSigned` check dans `DeleteDocument`).

**Risques :**
- Usurpation de signature sur des documents légaux (contrats, attestations)
- Verrouillage de documents par un utilisateur non autorisé

**Recommandation :** Vérifier que l'appelant est le propriétaire du document ou un admin.

---

### SEC-08 🟠 ÉLEVÉ — `NoteDeFraisController` — Absence totale de contrôle de propriété et de permissions granulaires

**Fichier :** `Controllers/NoteDeFraisController.cs`

| Endpoint | Permission | Contrôle de propriété | Risque |
|----------|-----------|----------------------|--------|
| `GET by-soc/{soccod}` | ❌ Aucune | ❌ | Tout utilisateur peut lister toutes les notes de frais |
| `GET by-emp/{soccod}/{empcod}` | ❌ Aucune | ❌ | Accès aux notes de frais d'un autre employé |
| `GET {id}` | ❌ Aucune | ❌ | Consultation d'une note de frais par ID |
| `POST add` | ❌ Aucune | ❌ | Création de note de frais pour un autre employé |
| `PUT update-status/{id}/{status}` | ❌ Aucune | ❌ | **N'importe qui peut approuver/refuser** des notes de frais |
| `DELETE {id}` | ❌ Aucune | ❌ | Suppression de notes de frais d'autrui |

**Risque majeur :** `UpdateStatus` permet à un simple employé d'approuver ses propres notes de frais (passer de `Pending` à `Approved`).

**Recommandation :**
- Ajouter `[CanGetNoteDeFrais]`, `[CanAddNoteDeFrais]`, etc.
- Vérifier la propriété pour la lecture/création (`empcod == caller`)
- Restreindre `update-status` aux managers/admins uniquement

---

### SEC-09 🟠 ÉLEVÉ — `MissionsController` — Absence de permissions granulaires et contrôle de propriété

**Fichier :** `Controllers/MissionsController.cs`

Aucun attribut de permission au-delà de `[Authorize]` :

| Endpoint | Contrôle | Risque |
|----------|----------|--------|
| `GET by-soc/{soccod}` | ❌ | Liste de toutes les missions |
| `GET by-emp/{soccod}/{empcod}` | ❌ | Accès missions d'un autre |
| `POST` | ❌ | Création de mission pour un autre employé |
| `PUT {id}` | ❌ | Modification de mission d'autrui |
| `DELETE {id}` | ❌ | Suppression de mission |

**Recommandation :** Ajouter des permissions granulaires et vérifier `empcod == caller` pour le self-service.

---

### SEC-10 🟠 ÉLEVÉ — `BulkImportController` — Absence de permissions granulaires

**Fichier :** `Controllers/BulkImportController.cs`

Le contrôleur a uniquement `[Authorize]` mais **aucun attribut de permission** (`[Admin]`, `[CanAddEmploye]`, etc.). Or, il permet des opérations destructrices en masse :

| Endpoint | Impact |
|----------|--------|
| `POST employes` | Création en masse d'employés avec CIN, téléphone, email |
| `POST services/fonctions/directions` | Création en masse d'entités organisationnelles |
| `POST villes/pays` | Modification du référentiel géographique global |

De plus, `ImportEmployes` stocke `Empcin` et `Emptel` **sans chiffrement AES**, contrairement au flux normal dans `EmployesController`.

**Risques :**
- Tout utilisateur authentifié peut importer des données en masse
- Données sensibles (CIN) stockées en clair lors de l'import
- Contournement du quota plan (pas de vérification du tenant dans les imports services/fonctions)

**Recommandation :** Ajouter `[Admin]` sur la classe et chiffrer CIN/téléphone dans `ImportEmployes`.

---

### SEC-11 🟠 ÉLEVÉ — `SocietesController` — Endpoints GET sans authentification

**Fichier :** `Controllers/SocietesController.cs:13`

```csharp
public class SocietesController : ControllerBase  // Pas de [Authorize]
```

Les endpoints GET sont accessibles **sans authentification** :

| Endpoint | Données exposées |
|----------|-----------------|
| `GET /api/Societes` | Liste de **toutes** les sociétés |
| `GET /api/Societes/{soccod}` | Détails d'une société |
| `GET /api/Societes/get-soclibs` | Noms de toutes les sociétés |
| `GET /api/Societes/get-socheures/{soccod}` | Paramètres horaires |

Seuls POST, PUT et DELETE ont `[Authorize]` (mais pas `[Admin]`).

**Risque :** Énumération des sociétés et de leurs paramètres par un utilisateur anonyme.

**Recommandation :** Ajouter `[Authorize]` au niveau de la classe. Ajouter `[Admin]` sur PUT/DELETE.

---

### SEC-12 🟡 MOYEN — `ParametresController` — Endpoints GET sans permission granulaire

**Fichier :** `Controllers/ParametresController.cs`

Les endpoints de lecture (`Get`, `GetParametres`, `GetPaie`) ont `[Authorize]` mais aucune permission granulaire. Les paramètres de paie contiennent des données de configuration sensibles (taux de majoration, règles de calcul).

Seul `UpdateParametres` est protégé par `[Admin]`.

**Recommandation :** Ajouter `[CanGetParametre]` ou restreindre l'accès aux rôles admin/manager.

---

### SEC-13 🟡 MOYEN — `VaultController.GetAllDocuments` sans contrôle d'accès explicite

**Fichier :** `Controllers/VaultController.cs:74`

```csharp
[HttpGet("admin/{soccod}")]
public async Task<IActionResult> GetAllDocuments(string soccod)
```

L'endpoint `admin/{soccod}` retourne **tous** les documents du tenant mais n'a pas d'attribut `[Admin]` ni de vérification de rôle. Seul `[Authorize]` est présent. N'importe quel utilisateur authentifié peut lister tous les documents de tous les employés.

**Recommandation :** Ajouter `[Admin]` ou vérifier `Utiadm == "1"` dans le contrôleur.

---

### SEC-14 🟡 MOYEN — `VaultController.UploadDocument` (self-service) sans contrôle de propriété

**Fichier :** `Controllers/VaultController.cs:92`

```csharp
[HttpPost("upload")]
public async Task<IActionResult> UploadDocument([FromForm] IFormFile file, [FromForm] string soccod, [FromForm] string empcod, ...)
```

L'endpoint accepte `empcod` depuis le formulaire sans vérifier qu'il correspond à l'utilisateur connecté. Un employé peut uploader des documents dans le coffre-fort d'un autre employé.

**Recommandation :** Comparer `empcod` avec le claim `NameIdentifier` du JWT (sauf admin/manager).

---

## 4. Sécurité des uploads de fichiers

### SEC-15 🔴 CRITIQUE — Aucune validation du type de fichier uploadé

**Fichier :** `Helpers/FileHelper.cs:16-33`

```csharp
public static async Task<(bool, string, string)> SaveFile(IFormFile file)
{
    var fileName = Guid.NewGuid() + Path.GetExtension(file.FileName);
    var filePath = Path.Combine(uploads, fileName);
    using (var stream = new FileStream(filePath, FileMode.Create))
        await file.CopyToAsync(stream);
    return (true, "/api/uploads/" + fileName, null);
}
```

La fonction `SaveFile` accepte **n'importe quel type de fichier** sans validation :
- ❌ Pas de whitelist d'extensions
- ❌ Pas de validation du type MIME
- ❌ Pas de scan de contenu (magic bytes)
- ❌ Pas de limitation de taille

Cette fonction est utilisée par : `VaultController`, `ParametresController`, `NoteDeFraisController`, `UtilisateursController`.

**Risques :**
- Upload de fichiers `.exe`, `.dll`, `.sh` — exécution côté serveur si l'upload est servi statiquement
- Upload de fichiers `.html`/`.svg` — XSS stored si servis en inline
- Upload de fichiers `.php`/`.aspx` — exécution de code si le serveur interprète ces extensions
- Upload illimité — saturation du disque

**Recommandation :**
```csharp
private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
{
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".png", ".jpg", ".jpeg", ".gif", ".csv"
};

// Dans SaveFile :
var ext = Path.GetExtension(file.FileName);
if (!AllowedExtensions.Contains(ext))
    return (false, null, "Type de fichier non autorisé.");
if (file.Length > 10 * 1024 * 1024) // 10 Mo
    return (false, null, "Fichier trop volumineux.");
```

---

### SEC-16 🟠 ÉLEVÉ — Répertoire uploads servi sans authentification

**Fichier :** `Program.cs:339-343`

```csharp
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(uploadsPath),
    RequestPath = "/api/uploads"
});
```

Le répertoire `uploads/` est servi via `UseStaticFiles`, ce qui signifie que **tous les fichiers uploadés sont accessibles publiquement** via `/api/uploads/{guid}.ext` sans authentification.

Cela inclut : justificatifs de notes de frais, documents du coffre-fort (contrats, fiches de paie), photos de profil, signatures électroniques.

**Risque :** Un attaquant qui devine ou obtient un GUID de fichier peut accéder à des documents sensibles sans être authentifié.

**Recommandation :** Servir les fichiers via un contrôleur authentifié (comme `VaultController.DownloadDocument`) au lieu de `UseStaticFiles`. Ou utiliser un middleware d'authentification sur le path `/api/uploads`.

---

### SEC-17 🟡 MOYEN — `DocumentsController.Upload` — Taille limite incohérente

**Fichier :** `Controllers/DocumentsController.cs:30`

```csharp
[RequestSizeLimit(40 * 1024 * 1024)] // 40 Mo
```

Le `DocumentsController` (coffre-fort RAG) autorise 40 Mo mais le `DocumentVaultService` plafonne à 25 Mo. Les autres endpoints d'upload (`VaultController`, `NoteDeFraisController`) n'ont **aucune** limite de taille explicite.

**Recommandation :** Uniformiser à une taille maximale raisonnable (ex: 10-25 Mo) sur tous les endpoints d'upload.

---

## 5. Validation des entrées & exposition de données

### SEC-18 🟠 ÉLEVÉ — `BillingController` — Message d'erreur Stripe exposé au client

**Fichier :** `Controllers/BillingController.cs:131`

```csharp
return StatusCode(502, new { error = "Erreur Stripe : " + ex.Message });
```

Les messages d'exception Stripe (`StripeException.Message`) peuvent contenir :
- Des IDs de compte Stripe
- Des détails de configuration de paiement
- Des informations internes sur le merchant

**Recommandation :** Logger l'erreur côté serveur et retourner un message générique au client.

---

### SEC-19 🟡 MOYEN — Messages d'erreur exposant des détails internes (récurrent)

Plusieurs contrôleurs retournent `ex.Message` dans les réponses d'erreur :

| Fichier | Ligne | Pattern |
|---------|-------|---------|
| `VaultController.cs` | 116 | `$"Internal server error: {ex.Message}"` |
| `SocietesController.cs` | 117 | `$"Internal server error: {ex.Message}"` |
| `SocietesController.cs` | 40 | `"problème de récuperation sociétés" + ex` |
| `BulkImportController.cs` | 106/270 | `errors.Add($"{lib}: {ex.Message}")` |
| `RolesController.cs` | 41/59/103/129 | `Error = ex.Message` |
| `SignupController.cs` | 257 | `detail = ex.Message` |

**Risques :** Révélation de noms de tables, chaînes de connexion, chemins de fichiers, versions de bibliothèques.

**Recommandation :** Utiliser le pattern `MaskedError` (déjà appliqué dans `PresencesController`) partout. En production, ne retourner qu'un message générique + un correlation ID.

---

### SEC-20 🟡 MOYEN — `SignupController` — `dbName` exposé dans la réponse

**Fichier :** `Controllers/SignupController.cs:242`

```csharp
return Created(string.Empty, new
{
    tenantId = tenant.Id,
    slug = tenant.Slug,
    dbName = tenant.DbName,       // ← exposition du nom de la base SQL
    trialEndsAt = tenant.TrialEndsAt,
    redirectUrl,
});
```

Le nom de la base de données (`tenant_<slug>_<8hex>`) est retourné au client. Bien que le nom seul ne suffise pas à se connecter, il révèle la convention de nommage et facilite une attaque ciblée si l'attaquant obtient un accès réseau au SQL Server.

**Recommandation :** Retirer `dbName` de la réponse API.

---

### SEC-21 🟡 MOYEN — `RolesController` — Pas de validation `soccod` dans les permissions

**Fichier :** `Controllers/RolesController.cs`

Les endpoints de gestion des rôles et permissions (`UpdatePermissions`, `UpdateRolePointdroits`) acceptent des données du client sans valider que les `Soccod`/pointeuses appartiennent au tenant courant.

**Recommandation :** Valider que les pointeuses référencées appartiennent au tenant de l'utilisateur connecté.

---

## 6. Sécurité Docker & Déploiement

### SEC-22 🟠 ÉLEVÉ — Conteneur Docker exécuté en tant que root

**Fichier :** `Dockerfile.server:6`

```dockerfile
#USER $APP_UID
WORKDIR /app
```

La directive `USER` est commentée. Le serveur .NET s'exécute en tant que `root` dans le conteneur. Si une vulnérabilité RCE (Remote Code Execution) est exploitée, l'attaquant a les privilèges root dans le conteneur.

**Recommandation :** Décommenter `USER $APP_UID` et s'assurer que les permissions sur `/app/uploads` permettent l'écriture par cet utilisateur.

---

### SEC-23 🟠 ÉLEVÉ — Qdrant (vector store) sans authentification

**Fichier :** `docker-compose.yml:117-126`

```yaml
qdrant:
    image: qdrant/qdrant:v1.12.0
    expose:
      - "6333"
      - "6334"
```

Qdrant est déployé sans clé API ni authentification. Bien qu'il ne soit pas exposé publiquement (network interne `app-network`), tout service du même réseau Docker peut accéder à toutes les collections et données vectorielles sans restriction.

**Risques :**
- Lecture de tous les documents indexés du RAG (tous tenants confondus)
- Injection de embeddings malveillants
- Suppression de collections

**Recommandation :** Configurer une clé API Qdrant (`QDRANT__SERVICE__API_KEY`) et la passer au sidecar RAG.

---

### SEC-24 🟠 ÉLEVÉ — Base de données SQL Server avec port non exposé mais mot de passe SA réutilisé

**Fichier :** `docker-compose.yml:34-41`

```yaml
abrpoint.database:
    environment:
      SA_PASSWORD: "PX0m6jCr1S8CsBjJZDrQXj66vILUAOpvtYeqjr8aT4A="
```

Le mot de passe `sa` est identique dans `SA_PASSWORD`, `DB_PASSWORD`, `MasterConnection` et `TenantTemplate`. Si ce mot de passe est compromis (via le dépôt Git), l'attaquant a un accès sysadmin à **toutes** les bases de données (master + tous les tenants).

De plus, `ACCEPT_EULA: "Y"` est positionné sans relecture des termes de licence.

**Recommandation :**
- Utiliser des identifiants distincts pour chaque service
- Ne pas utiliser le compte `sa` pour l'application — créer un utilisateur SQL avec permissions limitées
- Rotation du mot de passe et purge de l'historique Git

---

### SEC-25 🔵 FAIBLE — HTTPS redirection désactivée

**Fichier :** `Program.cs:412`

```csharp
//app.UseHttpsRedirection();
```

La redirection HTTPS est commentée. En production (derrière nginx avec SSL), ce n'est pas un problème car nginx gère la terminaison TLS. Mais en cas de déploiement direct, le trafic serait en HTTP clair.

**Recommandation :** Activer `UseHttpsRedirection()` avec une condition sur l'environnement (désactivé en dev, activé en prod si pas derrière un reverse proxy).

---

### SEC-26 🔵 FAIBLE — `AllowedHosts: "*"` en production

**Fichier :** `appsettings.json:92`

```json
"AllowedHosts": "*"
```

L'application accepte n'importe quel header `Host`. En cas de confusion de reverse proxy, cela facilite le host header poisoning.

**Recommandation :** Restreindre aux domaines légitimes en production :
```json
"AllowedHosts": "concorde-work-force.com,*.concorde-work-force.com"
```

---

## 7. Sécurité côté client

### SEC-27 🟠 ÉLEVÉ — Clé API Gemini exposée côté client (navigateur)

**Fichier :** `abrpoint.client/.env:6-7`

```
VITE_GEMINI_API_KEY=AIzaSy…<redacted>
VITE_APP_GEMINI_API=https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=AIzaSy…<redacted>
```

Les variables d'environnement préfixées par `VITE_` sont **incluses en clair dans le bundle JavaScript** envoyé au navigateur de chaque utilisateur. Toute personne ouvrant les outils de développement peut extraire la clé API Gemini.

**Risques :**
- Consommation API illimitée au nom du projet
- Scraping massif via le modèle Gemini
- Facturation imprévue

**Recommandation :** Ne jamais utiliser de clés API côté client. Créer un endpoint proxy côté serveur (`/api/ai/ask`) qui appelle Gemini avec la clé côté serveur.

---

### SEC-28 🔵 FAIBLE — Aucun Content Security Policy nonce pour les scripts inline

**Fichier :** `Program.cs:310`

```csharp
"script-src 'self' 'unsafe-inline' 'unsafe-eval'",
```

La CSP autorise `unsafe-inline` et `unsafe-eval`, ce qui neutralise la protection contre les attaques XSS. Le commentaire indique que c'est nécessaire pour MUI/emotion et les bibliothèques de charts.

**Recommandation :** Migrer progressivement vers des nonces CSP (`script-src 'self' 'nonce-...'`) et retirer `unsafe-eval`.

---

## 8. Rate limiting & protection DoS

### SEC-29 🟡 MOYEN — Absence de rate limiting sur la plupart des endpoints

**Fichier :** `Program.cs`

Seuls 4 endpoints ont un rate limiting :
- ✅ `ChatRag/ask` — 60/heure/utilisateur
- ✅ `Presences/mark-presence` — 6/minute
- ✅ Login / 2FA / forgot-password — 5/minute et 3/15min

Les endpoints suivants n'ont **aucune** protection :

| Endpoint | Impact sans rate limiting |
|----------|--------------------------|
| `BulkImport/*` | Import en masse de milliers de lignes |
| `VaultController/upload` | Saturation disque |
| `DocumentsController/upload` | Saturation disque |
| `BillingController/checkout` | Création de sessions Stripe en masse |
| `SignupController` | Création en masse de tenants (bien que la validation ralentisse) |
| `GET /api/Societes` | Scraping des données sans limite |

**Recommandation :** Ajouter des policies de rate limiting globales ou par groupe d'endpoints.

---

### SEC-30 🔵 FAIBLE — Pas de protection contre les requêtes trop volumineuses (body)

Aucune configuration globale de `RequestSizeLimit` n'est visible. Seul `DocumentsController` a une limite explicite (40 Mo). Par défaut, Kestrel autorise 30 Mo (`MaxRequestBodySize`), ce qui est élevé.

**Recommandation :** Configurer `KestrelServerOptions.Limits.MaxRequestBodySize` globalement (ex: 10 Mo) et ajuster par endpoint si nécessaire.

---

## 9. Matrice récapitulative

| # | Vulnérabilité | Catégorie | Sévérité | CVSS estimé | Statut |
|---|--------------|-----------|----------|-------------|--------|
| **SEC-01** | SA_PASSWORD en clair dans docker-compose.yml | Secrets | 🔴 CRITIQUE | 9.5 | ⚠️ À corriger |
| **SEC-02** | API keys Stripe/Gemini/SMTP dans appsettings.json | Secrets | 🔴 CRITIQUE | 9.3 | ⚠️ À corriger |
| **SEC-05** | TenantPilotController en `[AllowAnonymous]` | Contrôle d'accès | 🔴 CRITIQUE | 8.8 | ⚠️ À corriger |
| **SEC-06** | Vault download/preview sans vérification de propriété | Contrôle d'accès | 🔴 CRITIQUE | 8.5 | ⚠️ À corriger |
| **SEC-15** | Aucune validation du type de fichier uploadé | Upload | 🔴 CRITIQUE | 8.2 | ⚠️ À corriger |
| **SEC-03** | Mot de passe admin par défaut `"123"` | Secrets | 🟠 ÉLEVÉ | 7.8 | ⚠️ À corriger |
| **SEC-07** | Sign document sans vérification de propriété | Contrôle d'accès | 🟠 ÉLEVÉ | 7.5 | ⚠️ À corriger |
| **SEC-08** | NoteDeFrais — zéro contrôle de propriété/permission | Contrôle d'accès | 🟠 ÉLEVÉ | 7.2 | ⚠️ À corriger |
| **SEC-09** | Missions — zéro contrôle de propriété/permission | Contrôle d'accès | 🟠 ÉLEVÉ | 7.0 | ⚠️ À corriger |
| **SEC-10** | BulkImport sans permissions + CIN non chiffré | Contrôle d'accès | 🟠 ÉLEVÉ | 7.0 | ⚠️ À corriger |
| **SEC-11** | SocietesController GET sans `[Authorize]` | Contrôle d'accès | 🟠 ÉLEVÉ | 6.8 | ⚠️ À corriger |
| **SEC-16** | Répertoire uploads servi publiquement | Upload | 🟠 ÉLEVÉ | 6.5 | ⚠️ À corriger |
| **SEC-18** | Message d'erreur Stripe exposé au client | Info disclosure | 🟠 ÉLEVÉ | 6.0 | ⚠️ À corriger |
| **SEC-22** | Conteneur Docker en root | Déploiement | 🟠 ÉLEVÉ | 6.0 | ⚠️ À corriger |
| **SEC-23** | Qdrant sans authentification | Déploiement | 🟠 ÉLEVÉ | 5.8 | ⚠️ À corriger |
| **SEC-24** | Mot de passe SA réutilisé partout | Secrets | 🟠 ÉLEVÉ | 5.5 | ⚠️ À corriger |
| **SEC-27** | Clé API Gemini dans le bundle client | Client-side | 🟠 ÉLEVÉ | 5.5 | ⚠️ À corriger |
| **SEC-04** | `.gitignore` ne couvre pas les secrets | Configuration | 🟡 MOYEN | 5.0 | ⚠️ À corriger |
| **SEC-12** | ParametresController GET sans permission | Contrôle d'accès | 🟡 MOYEN | 4.5 | ⚠️ À corriger |
| **SEC-13** | Vault admin endpoint sans `[Admin]` | Contrôle d'accès | 🟡 MOYEN | 4.5 | ⚠️ À corriger |
| **SEC-14** | Vault upload (self-service) sans contrôle de propriété | Contrôle d'accès | 🟡 MOYEN | 4.5 | ⚠️ À corriger |
| **SEC-17** | Taille limite incohérente sur les uploads | Upload | 🟡 MOYEN | 4.0 | ⚠️ À corriger |
| **SEC-19** | Messages d'erreur exposant des détails internes | Info disclosure | 🟡 MOYEN | 4.0 | ⚠️ À corriger |
| **SEC-20** | `dbName` exposé dans la réponse signup | Info disclosure | 🟡 MOYEN | 3.5 | ⚠️ À corriger |
| **SEC-21** | RolesController — pas de validation soccod | Contrôle d'accès | 🟡 MOYEN | 3.5 | ⚠️ À corriger |
| **SEC-29** | Rate limiting absent sur la plupart des endpoints | DoS | 🟡 MOYEN | 3.5 | ⚠️ À corriger |
| **SEC-25** | HTTPS redirection désactivée | Configuration | 🔵 FAIBLE | 2.5 | ⚠️ À corriger |
| **SEC-26** | `AllowedHosts: "*"` | Configuration | 🔵 FAIBLE | 2.5 | ⚠️ À corriger |
| **SEC-28** | CSP avec `unsafe-inline` / `unsafe-eval` | Client-side | 🔵 FAIBLE | 2.0 | ⚠️ À corriger |
| **SEC-30** | Pas de limite globale de taille de requête | Configuration | 🔵 FAIBLE | 2.0 | ⚠️ À corriger |

---

## 10. Recommandations prioritaires

### P0 — Action immédiate (bloquant pour la production)

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| **SEC-01** | Migrer `SA_PASSWORD` et `DB_PASSWORD` vers Docker secrets ou `.env` non versionné | Empêche l'accès complet à SQL Server | 1h |
| **SEC-02** | Migrer toutes les clés API vers des variables d'environnement. Purger l'historique Git (BFG) | Empêche le vol de clés et la facturation frauduleuse | 2h |
| **SEC-05** | Supprimer `TenantPilotController` ou ajouter `[Authorize]` + `[Admin]` | Bloque l'énumération anonyme des tenants et employés | 15 min |
| **SEC-06** | Ajouter la vérification de propriété sur `download/{id}` et `preview/{id}` (même logique que `DeleteDocument`) | Empêche le téléchargement non autorisé de documents | 30 min |
| **SEC-15** | Ajouter une whitelist d'extensions + validation MIME + limite de taille dans `FileHelper.SaveFile` | Empêche l'upload de fichiers malveillants | 1h |

### P1 — Avant la mise en production

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| **SEC-03** | Générer un mot de passe admin fort + forcer le changement au 1er login | Élimine le mot de passe par défaut | 30 min |
| **SEC-07** | Vérifier la propriété dans `SignDocument` | Protège la valeur légale des signatures | 20 min |
| **SEC-08** | Ajouter permissions + contrôle de propriété sur `NoteDeFraisController` | Empêche l'auto-approbation de frais | 2h |
| **SEC-09** | Ajouter permissions + contrôle de propriété sur `MissionsController` | Limite l'accès aux missions | 1h |
| **SEC-10** | Ajouter `[Admin]` sur `BulkImportController` + chiffrer CIN/téléphone lors de l'import | Restreint l'import en masse aux admins | 1h |
| **SEC-11** | Ajouter `[Authorize]` sur `SocietesController` | Empêche l'énumération anonyme des sociétés | 10 min |
| **SEC-16** | Retirer `UseStaticFiles` sur uploads → servir via contrôleur authentifié | Protège les fichiers uploadés | 1h |
| **SEC-22** | Décommenter `USER $APP_UID` dans le Dockerfile | Réduit les privilèges du conteneur | 15 min |
| **SEC-23** | Ajouter `QDRANT__SERVICE__API_KEY` dans docker-compose | Protège le vector store | 30 min |
| **SEC-27** | Créer un endpoint proxy serveur pour l'API Gemini | Supprime la clé du bundle client | 2h |

### P2 — Prochain sprint

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| **SEC-04** | Ajouter `.env`, `appsettings.Production.json` au `.gitignore` | Prévient les fuites futures | 10 min |
| **SEC-12** | Ajouter permissions sur `ParametresController` GET | Restreint l'accès à la config paie | 20 min |
| **SEC-13** | Ajouter `[Admin]` sur `VaultController.GetAllDocuments` | Réserve la vue globale aux admins | 5 min |
| **SEC-14** | Vérifier la propriété dans `VaultController.UploadDocument` | Empêche l'upload dans le coffre d'autrui | 20 min |
| **SEC-18** | Retourner un message générique pour les erreurs Stripe | Ne pas exposer les détails de paiement | 15 min |
| **SEC-19** | Étendre `MaskedError` à tous les contrôleurs | Ne pas exposer les détails internes | 2h |
| **SEC-20** | Retirer `dbName` de la réponse signup | Réduit l'information disponible | 5 min |
| **SEC-21** | Valider `soccod` dans les permissions de rôles | Isole les données entre tenants | 30 min |
| **SEC-29** | Ajouter rate limiting global ou par groupe d'endpoints | Protège contre le DoS applicatif | 1h |
| **SEC-26** | Configurer `AllowedHosts` en production | Prévient le host header poisoning | 10 min |

---

> **Note finale :** L'application dispose d'une base solide avec RBAC, chiffrement AES, BCrypt, 2FA TOTP, cookies sécurisés, rate limiting partiel et headers de sécurité. Les vulnérabilités identifiées dans ce rapport concernent principalement :  
> 1. Des **secrets mal gérés** (docker-compose, appsettings, bundle client)  
> 2. Des **contrôleurs sans permissions granulaires** (NoteDeFrais, Missions, BulkImport, Societes)  
> 3. Des **uploads non validés** (type, taille, accès public)  
> 4. Des **contrôleurs de test** laissés accessibles (TenantPilot)  
> 
> La plupart des corrections sont des ajouts d'attributs ou de validations simples. Les corrections P0 représentent environ 4h de travail.

---

## 11. Corrections appliquées (08/05/2026)

| # | Fix | Fichier(s) |
|---|-----|------------|
| **SEC-04** | `.gitignore` étendu pour bloquer `appsettings.Production.json`, `.env`, `docker-compose.override.yml`, plus les `.env` du client. | [.gitignore](.gitignore) |
| **SEC-05** | `TenantPilotController` : `[AllowAnonymous]` retiré → `[Authorize][Admin]`. | [TenantPilotController.cs](ABRPOINT.Server/Controllers/TenantPilotController.cs) |
| **SEC-06** | `download/{id}` et `preview/{id}` : `CallerCanAccessDocAsync(doc)` (propriétaire / manager du même service / admin). | [VaultController.cs](ABRPOINT.Server/Controllers/VaultController.cs) |
| **SEC-07** | `sign/{id}` : seul le propriétaire (ou admin) peut signer — un manager ne signe pas pour son N-1. | VaultController.cs |
| **SEC-08** | `NoteDeFraisController` : helpers `CallerIsAdminOrManagerAsync` / `CallerOwnsOrCanManageAsync`. `by-soc` réservé manager+, `by-emp`/`{id}`/`add` ownership, `update-status` manager+, `Delete` ownership. | [NoteDeFraisController.cs](ABRPOINT.Server/Controllers/NoteDeFraisController.cs) |
| **SEC-09** | `MissionsController` : mêmes helpers. `by-soc` manager+, `by-emp`/GetById self-service ou manager, Create/Update/Delete avec ownership sur l'objet existant. | [MissionsController.cs](ABRPOINT.Server/Controllers/MissionsController.cs) |
| **SEC-10** | `BulkImportController` : `[Admin]` au niveau classe + chiffrement AES de `Empcin` / `Emptel` à l'import (alignement avec `EmployesController`). | [BulkImportController.cs](ABRPOINT.Server/Controllers/BulkImportController.cs) |
| **SEC-11** | `SocietesController` : `[Authorize]` au niveau classe (les GET ne sont plus anonymes). Messages d'erreur génériques. | [SocietesController.cs](ABRPOINT.Server/Controllers/SocietesController.cs) |
| **SEC-12** | `ParametresController` : `[Admin]` sur `GetParametres` et `GetPaie`. | [ParametresController.cs](ABRPOINT.Server/Controllers/ParametresController.cs) |
| **SEC-13** | `Vault.GetAllDocuments` (admin endpoint) : exige réellement `CallerIsAdminAsync()`. | VaultController.cs |
| **SEC-14** | `Vault.UploadDocument` : `empcod` doit correspondre au caller (sauf admin). | VaultController.cs |
| **SEC-15** | `FileHelper.SaveFile` : whitelist d'extensions (15 formats), plafond 10 Mo (configurable via `Uploads__MaxSizeMb`), nom regénéré en UUID pour bloquer le path traversal. | [FileHelper.cs](ABRPOINT.Server/Helpers/FileHelper.cs) |
| **SEC-18** | `BillingController` : message Stripe générique (le code interne est journalisé serveur). | [BillingController.cs](ABRPOINT.Server/Controllers/BillingController.cs) |
| **SEC-19** | `VaultController.UploadDocument`, `SocietesController.GetSoclibs` & `Post`, `SignupController` (provisioning) : `ex.Message` retiré des réponses, log structuré côté serveur. | controllers respectifs |
| **SEC-20** | `dbName` retiré de la réponse `/api/Signup`. | SignupController.cs |
| **SEC-22** | ⚠️ Reverté en prod : la directive `USER $APP_UID` est incompatible avec le volume nommé `uploads_data` (créé root, permissions persistantes à travers les redéploiements). Cause un EACCES sur les uploads. À réimplémenter avec entrypoint shell `chown` + `gosu` quand l'image base sera revue. | [Dockerfile.server](Dockerfile.server) |
| **SEC-26** | `appsettings.json` : `AllowedHosts` restreint à `concorde-work-force.com;*.concorde-work-force.com;localhost`. | appsettings.json |
| **SEC-29** | Nouvelles policies `file-upload` (30/min/user) et `bulk-import` (10/h/user) appliquées via `[EnableRateLimiting]` sur `Vault.upload`, `Vault.upload-for-employee` et `BulkImportController`. | [Program.cs](ABRPOINT.Server/Program.cs), VaultController, BulkImportController |

### Reportés (nécessitent coordination déploiement ou refactor lourd)

- **SEC-01** : `SA_PASSWORD` dans `docker-compose.yml`. À migrer vers `.env` non versionné + `secrets:` Docker. Nécessite la coopération de l'ops pour orchestrer la rotation sans casser le démarrage.
- **SEC-02** : Les vraies clés API (Stripe, Gemini, OpenRouter, SMTP, Encryption) restent dans `appsettings.json`. Le `SecretsValidator` (passe précédente) bloque déjà la prod si placeholder ; les valeurs réelles doivent être posées via env vars. Purge de l'historique Git (BFG) à programmer côté ops.
- **SEC-03** : Mot de passe admin par défaut `"123"` dans `docker-compose.yml`. Couplé à SEC-01.
- **SEC-16** : Répertoire uploads servi en static. Migration nécessite un middleware d'auth ou un endpoint dédié — rupture de compat (toutes les URLs `/api/uploads/...` dans le frontend mobile/web doivent passer par auth header). À faire dans une passe dédiée avec migration des consommateurs.
- **SEC-17** : Taille incohérente entre `DocumentsController` (40 Mo) et `DocumentVaultService` (25 Mo). À harmoniser avec le plafond global SEC-15 (10 Mo).
- **SEC-21** : `RolesController` validation soccod. Nécessite audit fin des permissions multi-tenant.
- **SEC-23** : Qdrant sans auth. Nécessite reconfigurer le sidecar RAG avec `QDRANT__SERVICE__API_KEY`.
- **SEC-24** : Mot de passe SA réutilisé. Couplé à SEC-01/02/03.
- **SEC-25** : `UseHttpsRedirection` désactivée — OK derrière nginx, à activer si déploiement direct.
- **SEC-27** : Clé Gemini dans le bundle client. Nécessite création d'un endpoint proxy `/api/ai/ask` côté serveur + refactor du chatbot client.
- **SEC-28** : CSP `unsafe-inline`/`unsafe-eval`. Migration progressive vers nonces — refactor frontend à planifier.
- **SEC-30** : Pas de limite globale de body. À configurer via `KestrelServerOptions.Limits.MaxRequestBodySize`.
</task_progress>
</task_progress>
</write_to_file>