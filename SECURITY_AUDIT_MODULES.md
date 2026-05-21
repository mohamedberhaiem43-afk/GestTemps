# 🔒 Audit de Sécurité — Modules Authentification, Employé, Contrat, Congé & Autorisation

> **Date :** 8 mai 2026  
> **Portée :** Analyse en lecture seule — aucune modification de code  
> **Modules couverts :** Authentification, Gestion des Employés, Contrats, Congés, Autorisations de sortie

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Authentification](#2-authentification)
3. [Gestion des Employés](#3-gestion-des-employés)
4. [Gestion des Contrats](#4-gestion-des-contrats)
5. [Gestion des Congés](#5-gestion-des-congés)
6. [Autorisations de sortie](#6-autorisations-de-sortie)
7. [Matrice récapitulative](#7-matrice-récapitulative)
8. [Recommandations prioritaires](#8-recommandations-prioritaires)

---

## 1. Vue d'ensemble

### Architecture de sécurité en place

| Mécanisme | Statut | Détails |
|-----------|--------|---------|
| **JWT + Cookies HttpOnly** | ✅ Implémenté | Access token 30 min (web), refresh token 7 jours |
| **BCrypt** | ✅ Implémenté | Hachage des mots de passe avec BCrypt |
| **2FA TOTP** | ✅ Implémenté | Via QR code, librairie Otp.NET |
| **RBAC** | ✅ Implémenté | Rôles + permissions par module (PermissionCatalog) |
| **CustomAttributes** | ✅ Implémenté | `[CanGetEmploye]`, `[CanAddConge]`, `[Admin]`, etc. |
| **Chiffrement AES** | ✅ Implémenté | CIN, téléphone, salaires chiffrés en base |
| **Tenant Isolation** | ⚠️ Partiel | Middleware tenant résout le slug, mais `soccod` pas validé contre JWT |
| **Refresh Token Rotation** | ✅ Implémenté | Ancien token révoqué à chaque rafraîchissement |

---

## 2. Authentification

### Fichiers analysés
- `Controllers/UtilisateursController.cs` (login, 2FA, forgot-password, logout)
- `Controllers/MobileAuthController.cs` (login mobile)
- `Controllers/SignupController.cs` (inscription SaaS)
- `appsettings.json` (configuration JWT, secrets)

### 2.1 🔴 CRITIQUE — Secrets codés en dur dans `appsettings.json`

**Fichier :** `appsettings.json`

```json
"Jwt": {
    "Key": "<placeholder — sample secret key redacted>"
},
"Encryption": {
    "AesKey": "<redacted — G3stT3mps@…>"
},
"Stripe": {
    "SecretKey": "<redacted — sk_test_…>",
    "WebhookSecret": "<redacted — whsec_…>"
},
"Smtp": {
    "Password": "<redacted — Concorde@…>"
},
"Gemini": {
    "ApiKey": "<redacted — AIzaSyDbq8…>"
},
"OpenRouter": {
    "ApiKey": "<redacted — sk-or-v1-…>"
}
```

**Risque :** Un accès au dépôt Git ou au fichier de configuration expose **tous** les secrets de l'application : clé JWT (permet de forger des tokens), clé de chiffrement AES (permet de déchiffrer CIN/salaires), clés Stripe, identifiants SMTP, clés API IA.

**Recommandation :** Utiliser Azure Key Vault, HashiCorp Vault ou des variables d'environnement. Ne **jamais** commiter de secrets dans le code source.

---

### 2.2 🔴 CRITIQUE — Clé JWT faible et prévisible

**Fichier :** `UtilisateursController.cs:972` et `MobileAuthController.cs:384`

```csharp
var securityKey = new SymmetricSecurityKey(
    Encoding.UTF8.GetBytes(_configuration["Jwt:Key"])
);
```

La clé `"This is a sample secret key - please don't use in production environment.'"` :
- Est un exemple de tutoriel, clairement documentée comme ne devant pas être utilisée en production
- Ne respecte pas les recommandations OWASP (256 bits minimum de haute entropie)
- Est probablement connue de tous les développeurs ayant suivi des tutoriels ASP.NET

**Risque :** Un attaquant connaissant la clé peut forger des JWT valides pour n'importe quel utilisateur, y compris admin (`Utiadm = "1"`), contournant totalement l'authentification.

---

### 2.3 🔴 CRITIQUE — Endpoints d'authentification sans `[Authorize]`

**Fichier :** `UtilisateursController.cs`

| Endpoint | Ligne | `[Authorize]` | Risque |
|----------|-------|---------------|--------|
| `PUT update-profile` | 672 | ❌ **Absent** | N'importe qui peut modifier le profil de n'importe quel utilisateur |
| `POST upload-profile` | 691 | ❌ **Absent** | Upload de fichier sans authentification |
| `GET get-profile/{soccod}/{uticod}` | 703 | ❌ **Absent** | Accès au profil complet (CIN déchiffré, téléphone) sans authentification |
| `PUT change-password` | 727 | ❌ **Absent** | Changement de mot de passe sans être connecté |

**Détail `get-profile` (ligne 703) :**  
Cet endpoint retourne le profil utilisateur **avec les champs CIN et téléphone déchiffrés** (lignes 716-717). L'absence de `[Authorize]` signifie qu'un appel non authentifié à `/api/Utilisateurs/get-profile/01/AD` expose les données personnelles en clair.

**Détail `change-password` (ligne 727) :**  
Aucune vérification de l'ancien mot de passe ni d'identité de l'appelant. Si le DTO `UpdatePassword` contient l'identifiant de l'utilisateur cible, un attaquant peut changer le mot de passe de n'importe qui.

---

### 2.4 🟠 ÉLEVÉ — Token JWT mobile avec durée de vie de 30 jours

**Fichier :** `MobileAuthController.cs:399`

```csharp
expires: DateTime.UtcNow.AddDays(30)  // Mobile : 30 jours !
```

Comparaison :
- **Web :** Access token = 30 minutes ✅
- **Mobile :** Access token = **30 jours** 🔴

Un token JWT ne peut pas être révoqué (stateless). Si le téléphone est volé ou compromis, l'attaquant dispose de 30 jours d'accès ininterrompu.

**Recommandation :** Réduire à 15-30 minutes et utiliser le refresh token (déjà implémenté, 30 jours) pour les renouvellements.

---

### 2.5 🟠 ÉLEVÉ — Absence de rate limiting sur les endpoints d'authentification

**Endpoints concernés :**
- `POST /api/Utilisateurs/connect` — login web
- `POST /api/MobileAuth/login` — login mobile
- `POST /api/Utilisateurs/complete-2fa-login` — vérification 2FA
- `POST /api/Utilisateurs/forgot-password` — réinitialisation

Aucun middleware de rate limiting n'est visible dans `Program.cs` pour ces endpoints. Un attaquant peut :
- Tenter un **brute-force** sur les mots de passe (atténuation partielle par BCrypt)
- Bomber l'endpoint **forgot-password** pour générer des codes de réinitialisation
- Brute-forcer le **code TOTP à 6 chiffres** sur `complete-2fa-login` (1 000 000 de combinaisons sans verrouillage)

**Recommandation :** Ajouter un rate limiting par IP et par email (ex: 5 tentatives/minute pour login, 3 pour forgot-password).

---

### 2.6 🟠 ÉLEVÉ — Code de réinitialisation non cryptographiquement sécurisé

**Fichier :** `UtilisateursController.cs:885-886`

```csharp
var random = new Random();
var resetCode = random.Next(100000, 999999).ToString();
```

`System.Random` n'est **pas** cryptographiquement sûr :
- Prévisible si la seed est devinée
- Seulement 900 000 combinaisons possibles

**Recommandation :** Utiliser `RandomNumberGenerator` (déjà utilisé pour les refresh tokens) pour générer le code de réinitialisation.

---

### 2.7 🟡 MOYEN — Absence de validation du propriétaire sur les opérations 2FA

**Fichier :** `UtilisateursController.cs`

```csharp
[Authorize]
[HttpPost("enable-2fa/{uticod}")]   // ligne 744
[HttpPost("verify-2fa/{uticod}")]   // ligne 791
[HttpPost("disable-2fa/{uticod}")]  // ligne 819
```

L'`uticod` dans l'URL n'est pas comparé avec le claim `NameIdentifier` du JWT. Un utilisateur authentifié peut :
- **Activer** le 2FA pour un autre utilisateur (`enable-2fa/OTHER_USER`)
- **Désactiver** le 2FA d'un autre utilisateur (`disable-2fa/OTHER_USER`)
- **Vérifier** le 2FA d'un autre utilisateur

**Recommandation :** Ajouter une vérification : `if (uticod != User.FindFirst(ClaimTypes.NameIdentifier)?.Value) return Forbid();`

---

### 2.8 🟡 MOYEN — Élévation de privilège via `Empresp`

**Fichier :** `EmployesController.cs:671-674`

```csharp
if (!string.IsNullOrWhiteSpace(employe.Empresp))
{
    await _utilisateurRepository.PromoteToAdminAsync(employe.Empresp);
}
```

Lors de la création ou mise à jour d'un employé, si le champ `Empresp` (responsable) est rempli, l'utilisateur correspondant est **automatiquement promu Administrator**. Un utilisateur malveillant ayant le droit `CanAddEmploye` ou `CanUpdateEmploye` peut :
1. Créer un employé avec `Empresp = "SON_PROPRE_UTICOD"`
2. Être promu Administrator automatiquement

**Recommandation :** Limiter l'auto-promotion à un administrateur existant, ou valider que `Empresp` désigne un utilisateur déjà administrateur.

---

### 2.9 Points positifs de l'authentification

| Mécanisme | Implémentation |
|-----------|----------------|
| Cookies HttpOnly + Secure + SameSite | ✅ `CreateCookieOptions()` avec détection HTTPS |
| Refresh token rotation | ✅ Ancien token révoqué, nouveau généré |
| Vérification compte désactivé | ✅ `IsAccountDisabledAsync()` vérifie `Utiactif` ET `Employe.Actif` |
| Garde paiement | ✅ Compte `PendingPayment` bloqué jusqu'à confirmation Stripe |
| Logout sécurisé | ✅ Tous les refresh tokens révoqués + cookies supprimés |
| BCrypt | ✅ Vérification et hachage avec BCrypt |
| 2FA TOTP | ✅ Via QR code, librairie Otp.NET |
| Slug validation (signup) | ✅ Regex + liste de slugs réservés |
| Email uniqueness cross-tenant | ✅ Via `TenantEmailIndex` dans la DB master |

---

## 3. Gestion des Employés

### Fichier analysé
- `Controllers/EmployesController.cs`

### 3.1 ✅ Points positifs

| Mécanisme | Détails |
|-----------|---------|
| **`[Authorize]` au niveau classe** | Tous les endpoints exigent un JWT valide |
| **Permissions granulaires** | `[CanGetEmploye]`, `[CanAddEmploye]`, `[CanUpdatetEmploye]`, `[CanDeleteEmploye]` |
| **Chiffrement AES des données sensibles** | CIN, téléphone, salaire de base, salaire brut, salaire net |
| **Vérification unicité email cross-tenant** | `IsEmailUniqueAsync()` vérifie locale ET `TenantEmailIndex` master |
| **Quota plan** | Limite d'employés selon le plan (essai gratuit: 10, Premium: illimité) |
| **Auto-création compte utilisateur** | Employé reçoit un compte avec rôle "Employee" par défaut |
| **Defense in depth** | Chaînes vides sur FK → null pour éviter les violations |
| **Self-service horaires** | `GetMyHoraires` vérifie `callerUticod == empcod` |

### 3.2 🟠 ÉLEVÉ — Endpoints sans permission attribute

| Endpoint | Ligne | Permission | Risque |
|----------|-------|------------|--------|
| `GET get-next-empcod/{soccod}` | 324 | ❌ Aucune | N'importe quel utilisateur authentifié peut énumérer les codes employé |
| `GET get-my-kpis/{soccod}/{uticod}` | 348 | ❌ Aucune | Accès aux KPI sans contrôle de propriété (n'importe quel `uticod`) |

### 3.3 🟠 ÉLEVÉ — Absence de contrôle de propriété sur `get-my-kpis`

**Fichier :** `EmployesController.cs:348-360`

```csharp
[HttpGet("get-my-kpis/{soccod}/{uticod}")]
public async Task<IActionResult> GetMyKPIs(string soccod, string uticod)
{
    var employees = await _employeRepository.GetMyKPIs(soccod, uticod);
    return Ok(employees);
}
```

L'`uticod` dans l'URL n'est pas comparé avec le JWT de l'utilisateur appelant. N'importe quel utilisateur authentifié peut accéder aux KPI de n'importe qui en modifiant l'URL.

**Recommandation :** Vérifier que `uticod == User.FindFirst(ClaimTypes.NameIdentifier)?.Value` ou exiger un rôle admin/manager.

### 3.4 🟡 MOYEN — Absence de validation `soccod` contre le tenant JWT

Tous les endpoints d'`EmployesController` prennent `soccod` en paramètre URL mais **ne valident pas** qu'il correspond au tenant de l'utilisateur connecté. Un utilisateur authentifié sur le tenant "01" peut interroger les employés du tenant "02" en modifiant l'URL.

**Exemples concernés :**
- `GET /api/Employes/{soccod}/{uticod}` — liste de tous les employés
- `GET /api/Employes/get-employe/{soccod}/{empcod}` — fiche employé complète
- `POST /api/Employes` — création d'employé dans un autre tenant

**Recommandation :** Résoudre le `soccod` attendu à partir du JWT ou du middleware tenant et le comparer avec le paramètre URL.

### 3.5 🟡 MOYEN — Messages d'erreur exposant des détails internes

Plusieurs endpoints retournent `ex.Message` dans les réponses d'erreur :

```csharp
// Ligne 795
return StatusCode(500, new { message = "...", details = ex.Message });
```

Cela peut révéler des noms de tables, des chaînes de connexion ou des stack traces.

---

## 4. Gestion des Contrats

### Fichier analysé
- `Controllers/ContratsController.cs`

### 4.1 ✅ Points positifs

| Mécanisme | Détails |
|-----------|---------|
| **`[Authorize]` au niveau classe** | Ligne 16 |
| **Permissions granulaires** | `[CanGetContrat]`, `[CanAddContrat]`, `[CanUpdateContrat]`, `[CanDeleteContrat]`, `[CanGetEcheanceContrat]` |
| **Renouvellement de contrat** | Endpoint dédié avec validation `ModelState` |
| **Soft delete** | Vérification d'existence avant suppression |

### 4.2 🟠 ÉLEVÉ — Endpoints sans permission attribute

| Endpoint | Ligne | Permission | Risque |
|----------|-------|------------|--------|
| `GET get-contrat-report/{soccod}/{empcod}` | 89 | ❌ Aucune | N'importe quel utilisateur authentifié peut générer le PDF contrat de n'importe quel employé |
| `GET expiring/{soccod}` | 219 | ❌ Aucune | Liste des contrats expirants accessible à tous |
| `GET expiring/{soccod}/{uticod}` | 253 | ❌ Aucune | Idem, filtré par utilisateur |
| `GET get-next-concod/{soccod}` | 289 | ❌ Aucune | Énumération des numéros de contrat |

**Détail `get-contrat-report` (ligne 89) :**  
Génère un PDF du contrat d'un employé. Tout utilisateur authentifié (y compris un simple employé) peut générer le contrat de n'importe quel collaborateur en devinant `soccod` et `empcod`.

### 4.3 🟡 MOYEN — Absence de validation `soccod` contre le tenant JWT

Même problématique que les employés : `soccod` vient de l'URL sans validation cross-tenant.

---

## 5. Gestion des Congés

### Fichiers analysés
- `Controllers/CongesController.cs`
- `Controllers/DemCongesController.cs`

### 5.1 ✅ Points positifs

| Mécanisme | Détails |
|-----------|---------|
| **`[Authorize]` au niveau classe** | Les deux contrôleurs |
| **Permissions granulaires Conges** | `[CanGetConge]`, `[CanAddConge]`, `[CanUpdateConge]`, `[CanDeleteConge]`, `[CanGetCahierConge]`, `[CanGetDroitConge]` |
| **Permissions granulaires DemConges** | `[CanGetDemConge]`, `[CanAddDemConge]`, `[CanUpdateDemConge]`, `[CanDeleteDemConge]` |
| **Workflow de validation** | Accept/Refuse avec notification au collaborateur |
| **Notifications managers** | Les managers sont notifiés des nouvelles demandes |
| **Bulk create** | `PostMultipleConges` avec permission `[CanAddCongeGeneral]` |

### 5.2 🟠 ÉLEVÉ — `get-emp-demconge` sans contrôle de propriété

**Fichier :** `DemCongesController.cs:73-85`

```csharp
[HttpGet("get-emp-demconge/{soccod}/{empcod}")]
public async Task<List<DemcongeDto>> GetEmpDemconge(string soccod, string empcod)
{
    var result = await _demandecongeRepository.GetEmpDemcongeAsync(soccod, empcod);
    return result;
}
```

Aucune permission spéciale n'est requise et aucune vérification de propriété n'est faite. Tout utilisateur authentifié peut consulter les demandes de congé de n'importe quel employé.

**Recommandation :** Soit ajouter `[CanGetDemConge]`, soit vérifier que l'appelant est l'employé concerné ou son manager.

### 5.3 🟡 MOYEN — Endpoints de génération de numéro sans permission

| Endpoint | Contrôleur | Ligne |
|----------|------------|-------|
| `GET get-next-concod/{soccod}` | `CongesController` | 31 |
| `GET get-next-concod/{soccod}` | `DemCongesController` | 30 |

Ces endpoints permettent à n'importe quel utilisateur authentifié de découvrir le prochain numéro de congé/demande, ce qui facilite l'énumération.

### 5.4 🟡 MOYEN — Gestion d'erreurs incohérente

Plusieurs endpoints dans `CongesController` lancent des exceptions non gérées (`throw`) au lieu de retourner des réponses HTTP appropriées :

```csharp
// CongesController.cs:89
catch (Exception ex)
{
    throw new Exception("Erreur innatendu: "+ex);  // Mauvaise pratique
}
```

Cela peut provoquer un stack trace 500 avec des détails internes.

---

## 6. Autorisations de sortie

### Fichiers analysés
- `Controllers/AutorisersController.cs`
- `Controllers/DemandeAutorisationsController.cs`

### 6.1 ✅ Points positifs

| Mécanisme | Détails |
|-----------|---------|
| **`[Authorize]` au niveau classe** | Les deux contrôleurs |
| **Permissions granulaires** | `[CanGetAutSortie]`, `[CanAddAutSortie]`, `[CanUpdateAutSortie]`, `[CanDeleteAutSortie]`, `[CanAddAutSortieGeneral]` |
| **Self-service** | `my-auths` et `my-auth` pour les employés |
| **Workflow demande** | Approve/Refuse avec notifications |
| **Bulk create** | Avec permission `[CanAddAutSortieGeneral]` |

### 6.2 🔴 CRITIQUE — `PostMyAuthorization` sans vérification de propriété

**Fichier :** `AutorisersController.cs:102-116`

```csharp
[HttpPost("my-auth")]
public async Task<IActionResult> PostMyAuthorization([FromBody] Autoriser autoriser)
{
    await _autoriserRepository.AddAsync(autoriser);
    return Ok(new { message = "Autorisation de sortie envoyée avec succès" });
}
```

L'endpoint est conçu pour le self-service (un employé soumet SA propre demande) mais **ne vérifie pas** que `autoriser.Empcod` correspond à l'utilisateur connecté. Un employé peut créer des autorisations au nom de n'importe quel autre employé.

**Recommandation :** Comparer `autoriser.Empcod` avec le claim `NameIdentifier` du JWT.

### 6.3 🟠 ÉLEVÉ — `DemandeAutorisationsController` sans permissions granulaires

**Fichier :** `DemandeAutorisationsController.cs`

Aucun des endpoints n'a de permission attribute au-delà de `[Authorize]` :

| Endpoint | Ligne | Permission | Risque |
|----------|-------|------------|--------|
| `GET get-all/{soccod}/{uticod}` | 60 | `[Authorize]` seulement | Tout utilisateur peut lister toutes les demandes |
| `GET get-by-employe/{soccod}/{empcod}` | 77 | `[Authorize]` seulement | Tout utilisateur peut voir les demandes d'un autre |
| `GET {id}` | 94 | `[Authorize]` seulement | Consultation d'une demande par ID |
| `POST create` | 110 | `[Authorize]` seulement | Création de demande pour n'importe quel employé |
| `PUT update` | 141 | `[Authorize]` seulement | Modification d'une demande existante |
| `DELETE {id}` | 159 | `[Authorize]` seulement | Suppression d'une demande |
| `POST approve/{id}` | 176 | `[Authorize]` seulement | **Approbation sans vérification de rôle manager/admin** |
| `POST refuse/{id}` | 204 | `[Authorize]` seulement | **Refus sans vérification de rôle** |

**Risque majeur :** `approve/{id}` et `refuse/{id}` permettent à **n'importe quel utilisateur authentifié** (y compris un simple employé) d'approuver ou refuser des demandes d'autorisation.

**Recommandation :** Ajouter des attributs de permission (ex: `[CanApproveAutSortie]`) ou vérifier le rôle manager/admin dans le contrôleur.

### 6.4 🟡 MOYEN — `GetMyAuthorizations` sans vérification de propriété

**Fichier :** `AutorisersController.cs:24-38`

```csharp
[HttpGet("my-auths/{soccod}/{empcod}")]
public async Task<IActionResult> GetMyAuthorizations(string soccod, string empcod)
```

L'endpoint self-service ne vérifie pas que `empcod` correspond à l'utilisateur JWT. Un employé peut consulter les autorisations d'un collègue.

---

## 7. Matrice récapitulative

### Sévérité par module

| # | Vulnérabilité | Module | Sévérité | CVSS estimé |
|---|--------------|--------|----------|-------------|
| **A1** | Secrets codés en dur (JWT, AES, Stripe, SMTP) | Authentification | 🔴 CRITIQUE | 9.8 |
| **A2** | Clé JWT prévisible (exemple tutoriel) | Authentification | 🔴 CRITIQUE | 9.1 |
| **A3** | Endpoints sans `[Authorize]` (profile, password) | Authentification | 🔴 CRITIQUE | 8.5 |
| **A4** | Création d'autorisation au nom d'autrui | Autorisation | 🔴 CRITIQUE | 8.1 |
| **A5** | Approbation/refus de demandes par n'importe qui | Autorisation | 🟠 ÉLEVÉ | 7.5 |
| **A6** | JWT mobile 30 jours (non révocable) | Authentification | 🟠 ÉLEVÉ | 7.0 |
| **A7** | Absence de rate limiting (login, 2FA, forgot) | Authentification | 🟠 ÉLEVÉ | 6.5 |
| **A8** | Opérations 2FA sans vérification de propriété | Authentification | 🟠 ÉLEVÉ | 6.5 |
| **A9** | Élévation de privilège via `Empresp` | Employé | 🟠 ÉLEVÉ | 6.5 |
| **A10** | Contrat report sans permission | Contrat | 🟠 ÉLEVÉ | 6.0 |
| **A11** | `get-my-kpis` sans contrôle de propriété | Employé | 🟠 ÉLEVÉ | 5.5 |
| **A12** | `get-emp-demconge` sans contrôle de propriété | Congé | 🟠 ÉLEVÉ | 5.5 |
| **A13** | `my-auths` sans vérification de propriété | Autorisation | 🟡 MOYEN | 5.0 |
| **A14** | `soccod` non validé contre le tenant JWT | Tous | 🟡 MOYEN | 5.0 |
| **A15** | Code reset non cryptographique (`Random`) | Authentification | 🟡 MOYEN | 4.5 |
| **A16** | Génération numéro sans permission | Congé, Contrat | 🟡 MOYEN | 3.5 |
| **A17** | Messages d'erreur exposant des détails | Tous | 🟡 MOYEN | 3.0 |

### Statistiques

```
🔴 CRITIQUE :  4 vulnérabilités  → Action immédiate requise
🟠 ÉLEVÉ :     8 vulnérabilités  → Corriger avant la mise en production
🟡 MOYEN :     5 vulnérabilités  → Planifier dans le prochain sprint
✅ Positif :   15+ mécanismes    → Bonnes pratiques déjà en place
```

---

## 8. Recommandations prioritaires

### P0 — Action immédiate (bloquant pour la production)

| # | Action | Impact |
|---|--------|--------|
| **A1+A2** | Migrer **tous** les secrets vers des variables d'environnement ou un vault. Générer une clé JWT de 256+ bits aléatoires. | Empêche la forge de tokens et le déchiffrement de données |
| **A3** | Ajouter `[Authorize]` sur `update-profile`, `upload-profile`, `get-profile`, `change-password` | Bloque l'accès non authentifié aux données sensibles |
| **A4** | Valider `autoriser.Empcod == User.FindFirst(NameIdentifier)` dans `PostMyAuthorization` | Empêche l'usurpation d'identité dans les autorisations |

### P1 — Avant la mise en production

| # | Action | Impact |
|---|--------|--------|
| **A5** | Ajouter permission `[CanApproveAutSortie]` sur approve/refuse de `DemandeAutorisationsController` | Seuls les managers/admins peuvent valider |
| **A6** | Réduire le JWT mobile à 15-30 min, refresh token à 7 jours | Limite la fenêtre d'exploitation en cas de vol |
| **A7** | Ajouter un rate limiting par IP/email sur login, 2FA, forgot-password | Protège contre le brute-force |
| **A8** | Vérifier `uticod == JWT.NameIdentifier` dans enable/verify/disable-2FA | Empêche la manipulation du 2FA d'autrui |
| **A9** | Limiter l'auto-promotion via `Empresp` aux admins existants | Ferme la faille d'élévation de privilège |
| **A10** | Ajouter `[CanGetContrat]` sur `get-contrat-report` | Restreint la génération de PDF contrat |
| **A14** | Valider `soccod` contre le tenant résolu par le middleware | Isole les données entre tenants |

### P2 — Prochain sprint

| # | Action | Impact |
|---|--------|--------|
| **A11+A12+A13** | Ajouter vérification de propriété (JWT claim vs paramètre URL) | Respecte le principe du moindre privilège |
| **A15** | Remplacer `new Random()` par `RandomNumberGenerator` | Codes de réinitialisation imprévisibles |
| **A16** | Ajouter permission sur `get-next-concod` | Limite l'énumération |
| **A17** | Utiliser `ILogger` + messages génériques dans les réponses d'erreur | Ne pas exposer de détails internes |

---

> **Note finale :** L'application dispose déjà d'une base solide (RBAC, chiffrement AES, BCrypt, 2FA TOTP, cookies sécurisés). Les vulnérabilités identifiées relèvent majoritairement d'oublis sur des endpoints spécifiques et de la configuration des secrets. Les corrections sont pour la plupart des ajouts d'attributs ou de validations simples.

---

## 9. Corrections appliquées (08/05/2026)

Tous les points hors **A1/A2/A6** (JWT/clés — gérés par l'audit S2 du fichier `SECURITY_PERFORMANCE_AUDIT.md` via le validator au boot) ont été traités :

| # | Fix | Localisation |
|---|-----|--------------|
| **A3** | `[Authorize]` posé sur `update-profile`, `upload-profile`, `get-profile`, `change-password`. Ownership check en plus : la cible doit être l'appelant (sauf admin). `upload-profile` ignore désormais l'`uticod` query — il vient du JWT. | `UtilisateursController.cs` |
| **A4** | `PostMyAuthorization` (Autoriser) et `Create` (DemandeAutorisation) forcent `Empcod = caller` (ou refusent si admin/non manager). | `AutorisersController.cs`, `DemandeAutorisationsController.cs` |
| **A5** | `approve/{id}` et `refuse/{id}` exigent un caller manager/admin via `CallerCanApproveAsync()` (whitelist Utiadm + RolePermissions). `get-all` reçoit `[CanGetAutSortie]`. | `DemandeAutorisationsController.cs` |
| **A7** | Rate limiting : policy `auth-login` (5 req/min/IP) sur `/connect`, `/MobileAuth/login`, `/complete-2fa-login` ; policy `auth-recovery` (3/15min/IP) sur `forgot-password` et `reset-password`. | `Program.cs`, `UtilisateursController.cs`, `MobileAuthController.cs`, `AuthLookupController.cs` |
| **A8** | `enable-2fa`, `verify-2fa`, `disable-2fa` : vérifient `uticod URL == JWT.NameIdentifier`. | `UtilisateursController.cs` |
| **A9** | `PromoteToAdminAsync` (3 sites : Post unitaire, bulk, Put) appelée uniquement si l'appelant est lui-même admin (`CanAutoPromoteRespAsync`). Sinon log warning + opération RH normale. | `EmployesController.cs` |
| **A10** | `[CanGetContrat]` sur `get-contrat-report`, `[CanGetEcheanceContrat]` sur les deux `expiring`, `[CanAddContrat]` sur `get-next-concod`. | `ContratsController.cs` |
| **A11** | `get-my-kpis` : ownership check (uticod URL == caller, sauf admin). | `EmployesController.cs` |
| **A12** | `get-emp-demconge` : ownership check (caller == empcod, sauf admin). | `DemCongesController.cs` |
| **A13** | `my-auths` (Autorisers) et `get-by-employe` (DemandeAutorisations) : ownership check. | `AutorisersController.cs`, `DemandeAutorisationsController.cs` |
| **A14** | (Précédent) `[ValidateSoccod]` posé sur `PresencesController` et `PointageMoisController`. | cf. `SECURITY_PERFORMANCE_AUDIT.md` S3 |
| **A15** | Code reset 6 chiffres : `RandomNumberGenerator.GetInt32(100000, 1000000)` au lieu de `new Random()`. | `UtilisateursController.cs:885` |
| **A16** | `get-next-concod` côté Conges, DemConges, DemandeAutorisations, Contrats : permission requise (`[CanAddConge]`, `[CanAddDemConge]`, `[CanAddAutSortie]`, `[CanAddContrat]`). | controllers respectifs |

### Reste reporté

- **A1/A2** (secrets, clé JWT) : SecretsValidator au boot bloque la prod si placeholder ; les valeurs réelles doivent être posées côté déploiement (env vars `Jwt__Key`, etc.).
- **A6** (durée JWT mobile = 30 jours) : changement de TTL impacte tous les apps mobiles installés ; à coordonner avec un release plan (refresh token côté mobile à mettre en place avant).
- **A17** (messages d'erreur génériques) : déjà adressé partiellement via `MaskedError` côté Presences (cf. S7) ; à étendre dans une passe ciblée.