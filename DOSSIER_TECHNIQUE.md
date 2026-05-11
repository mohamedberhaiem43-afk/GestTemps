<p align="center">
  <img src="abrpoint.client/public/Concorde.png" alt="Concorde Workforce" width="220" />
</p>

# Dossier Technique & Commercial — Plateforme SaaS RH / Pointage

**Produit** : Concorde Workforce / ABRPOINT
**Cycle** : Préparation lancement V1 — infrastructure de production commandée
**Date de référence** : 2026-05-12 (version 2)
**Stack résumé** : .NET 8 + ASP.NET Core / React 19 + Vite + MUI / Expo 54 + React Native 0.81 / SQL Server 2022 / Docker Compose + nginx-proxy / Qdrant (RAG) / Ubuntu Server 24.04 LTS (cible production)

> **Évolutions depuis la v1 (2026-05-10)** : tarification commerciale verrouillée
> (Starter 29,50 € / Standard 59,50 € / Premium 119 € + overage par salarié),
> verrouillage des fonctionnalités payantes (plan gating backend + frontend + mobile),
> commande du serveur de production et plan de durcissement infra associé. Cf. §11, §13
> et §26 pour les nouvelles sections.

---

## 1. Synthèse exécutive

### 1.1 Vision produit
Plateforme SaaS multi-tenant proposant aux PME/ETI une solution intégrée :
- Pointage présentiel et mobile avec géolocalisation
- Gestion RH (employés, contrats, congés, RTT, absences, sanctions)
- Préparation paie (rubriques, états périodiques, exports)
- Coffre-fort numérique pour documents salariés (bulletins, contrats, justificatifs)
- Signature électronique des documents
- Dashboards & reporting analytiques
- Assistant IA contextuel (RAG)

### 1.2 Maturité actuelle
- **Backend** : 64 contrôleurs API, 131 entités EF Core, multi-tenant master/tenant opérationnel, RAG branché, auto-migration de schéma au démarrage, seed automatique du référentiel pays.
- **Web** : ~30 modules métier complets en MUI, i18n FR/EN, animations, dashboard admin/employé/manager différencié.
- **Mobile** : 22 écrans (Expo SDK 54), GPS, push, biométrie, signature, vault, durcissement sécurité G1→G6.
- **Tarification commerciale verrouillée** (cf. §11) : Starter 29,50 € / Standard 59,50 € / Premium 119 € avec facturation forfait + overage Stripe (base + seat items).
- **Plan gating opérationnel** (cf. §8.4) : restrictions appliquées côté backend (`RequirePlanFeatureAttribute`), côté frontend (`planAllows`) et côté mobile (hooks de sécurité conditionnés au plan).
- **Infrastructure** : déployable via `docker compose up`, certificats Let's Encrypt automatisés, HSTS + CSP + headers complets, frame-src blob pour aperçus PDF, refresh tokens avec quota par utilisateur (cf. §6).
- **Tests** : couverture unitaire ciblée sur les calculs paie/présence (CalculService) — pas encore d'e2e ni de tests UI automatisés.

### 1.3 Cibles V1 (lancement)
- Multi-tenant production-ready avec billing Stripe (base + seat items) — **fait**.
- Pointage géolocalisé fiable cross-fuseau — **fait** (avec gating Standard+).
- Coffre-fort + signature en flux complet — **fait** (avec gating Standard+ et signature gatée Standard+).
- Préparation paie compatible avec exports paie standards (Excel) — **fait** (nomenclature de rubriques par défaut, mapping vartype/unité aligné moteur de pointage).
- Hardening sécurité OWASP top 10 + protections mobiles renforcées (cert pinning, screenshot blocking, auto-lock, anti-émulateur) — **fait** (Premium seul reçoit l'expérience renforcée à l'exception du cert pinning qui est natif au binaire).
- Infrastructure de production durcie sur Ubuntu Server 24.04 LTS — **en cours** (cf. §26 : UFW, Fail2Ban, SSH clés, séparation prod/staging, sauvegardes).

---

## 2. Architecture fonctionnelle de la solution

### 2.1 Vue d'ensemble

```
┌─────────────────┐      HTTPS       ┌─────────────────────────────┐
│  Web React PWA  │◄────────────────►│   nginx-proxy (TLS, /api)   │
│  (Vite, MUI)    │                  │   HSTS+CSP+headers, rate-lim│
└─────────────────┘                  │   Volume uploads_data RO    │
                                     │   Let's Encrypt + certbot   │
┌─────────────────┐    HTTPS         └──────────────┬──────────────┘
│  Mobile Expo    │◄────────────────►              │
│  (RN 0.81)      │  Cert pinning    ┌─────────────▼─────────────┐
│  Bio-token+JWT  │                  │  abrpoint.server (Kestrel)│
└─────────────────┘                  │  ASP.NET Core 8           │
                                     │  Volume uploads_data RW   │
                                     └─────┬──────────┬──────────┘
                                           │          │
                                 ┌─────────▼──┐  ┌────▼────────┐
                                 │ SQL Server │  │ rag-svc     │
                                 │ master DB  │  │ (Python)    │
                                 │ + tenants  │  │ Qdrant + e5 │
                                 └────────────┘  └─────────────┘
```

### 2.2 Stack technologique

| Couche | Technos principales |
|---|---|
| **Backend API** | .NET 8 · ASP.NET Core · EF Core 8 · Dapper 2.1 · AutoMapper 14 · MailKit · BCrypt · Otp.NET (TOTP) · QRCoder · Stripe.NET 47 · DinkToPdf · FastReport.OpenSource · DocumentFormat.OpenXml · PdfPig · Microsoft.SemanticKernel 1.30 |
| **Web** | React 19 · Vite · TypeScript 5 · MUI 5 + x-charts + x-data-grid + x-date-pickers · React Query 5 · React Router · FullCalendar · jsPDF + autotable · ExcelJS · i18next FR/EN · dayjs · Recharts · axios |
| **Mobile** | Expo SDK 54 · React Native 0.81 · React Navigation 7 · expo-location · expo-camera · expo-image-picker · expo-document-picker · expo-secure-store · expo-notifications · expo-local-authentication · expo-screen-capture · expo-device · React Native Paper |
| **Infrastructure** | Docker Compose · nginx (proxy + TLS + uploads RO) · SQL Server 2022 · Qdrant 1.12 (vector store) · Python sidecar RAG (LangChain + multilingual-e5-large) · certbot |
| **CI/CD** | manuel actuellement — Dockerfile.server / Dockerfile.client séparés, image client publiée sur Docker Hub |

### 2.3 Topologie de déploiement (Docker Compose)

| Service | Image | Réseau | Volumes |
|---|---|---|---|
| `nginx-proxy` | nginx:alpine | app-network (ports 80/443) | `nginx.conf:ro`, `uploads_data:/app/uploads:ro`, `letsencrypt_data:ro` |
| `abrpoint.server` | abrpoint-server:local (multi-stage .NET) | app-network expose 8080 | `uploads_data:/app/uploads` |
| `abrpoint.client` | abrpoint-client:latest | app-network expose 80 | — |
| `abrpoint.database` | mssql/server:2022-latest | app-network | `sqlserver-data`, `./sql-backup` |
| `qdrant` | qdrant:1.12.0 | app-network expose 6333/6334 | `qdrant_data` |
| `rag-svc` | abrpoint-rag-svc:local | app-network expose 8080 | — |
| `certbot` | certbot/certbot | — | `letsencrypt_data`, `/var/www/certbot` |

### 2.4 Multi-tenant SaaS

**Modèle** : *Database-per-tenant* + *master DB*.

```
Master DB (ABRPOINT_master)               Tenant DBs (ABRPOINT_<slug>)
┌────────────────────────┐                ┌──────────────────────────┐
│  Tenants (slug, host)  │   ───────►     │  Sites, Employés,        │
│  TenantEmailIndex      │                │  Présences, Vault, etc.  │
│  Plans, Subscriptions  │                │  (schéma migré à chaud   │
│                        │                │   via BaseDataSchemaMig.)│
└────────────────────────┘                └──────────────────────────┘
```

- **Résolution tenant** : `TenantResolverMiddleware` lit le header `X-Tenant-Slug` ou le sous-domaine, hydrate `ICurrentTenant`.
- **DbContext factory dynamique** ([Program.cs:45](ABRPOINT.Server/Program.cs#L45)) : si tenant résolu, connection string générée via `TenantTemplate`.
- **Quotas** ([TrialPolicy.cs](ABRPOINT.Server/Tenancy/TrialPolicy.cs)) : essai gratuit, plan Essentiel/Standard mono-filiale, Premium illimité. HTTP 402 (`plan_limit_*`) en cas de dépassement.
- **Auto-migration** : à chaque première requête tenant après redémarrage, [BaseDataSchemaMigrator.cs](ABRPOINT.Server/Services/BaseDataSchemaMigrator.cs) applique automatiquement les ALTER TABLE/CREATE INDEX idempotents (colonnes manquantes, index, tables nouvelles). Aucune intervention DBA — un `docker compose up -d` suffit pour propager une évolution de schéma.

### 2.5 Modèle de données (haute densité)

131 entités, organisées par grandes familles :

| Famille | Entités principales |
|---|---|
| **RH socle** | `Employe`, `Empuser`, `Direction`, `Fonction`, `Service`, `Section`, `Qualif`, `Site`, `Societe`, `Ville` |
| **Pointage** | `Presence`, `Pointeuse`, `Dmpoint`, `Dmpresence` |
| **Horaires** | `Poste`, `Lposte`, `Calendsoc`, `Lcalendsoc`, `Ferier` |
| **Congés / absences** | `Conge`, `Demconge`, `Congenon`, `Absence`, `Lcategorie`, `Categorie`, `Sanction`, `DemandeAutorisation`, `Autoriser`, `Allaitement`, `Compenser` |
| **Paie** | `Rubrique`, `NoteDeFrais`, `Mission` |
| **Gestion droits** | `Roles`, `RolePermission`, `RolePointdroit`, `Module`, `Modusers` |
| **Contrats / docs** | `Contrat`, `DocumentVault`, `LetterTemplate` |
| **Tenancy** | `Tenant`, `TenantEmailIndex` (master DB) |
| **Audit / sécu** | `AuditLog`, `RefreshToken` (avec colonnes `purpose` + `last_used_at` pour bio-tokens et quota) |
| **Notifications** | `PushToken`, `Notification`, `NotificationCategoryCatalog`, `NotificationUserSettings` (quiet hours) |
| **RAG / IA** | `RagDocument`, `RagLetterTemplate`, `RagChatLog` (côté .NET), index Qdrant |

Convention de nommage SQL : tables/colonnes en minuscule 3-7 caractères (`emp*`, `con*`, `sit*`, etc.) — héritée du schéma legacy ABRPOINT. Clés composites fréquentes (`Soccod` + clé métier) pour l'isolation tenant intra-DB legacy.

---

## 3. Modules existants

### 3.1 Authentification & sécurité
- **Login web/mobile** : email + mot de passe BCrypt, JWT 8.0
- **2FA TOTP** ([Otp.NET](ABRPOINT.Server/ABRPOINT.Server.csproj)) : QR code via QRCoder lors de l'enrôlement, validation à chaque login si activée
- **Tokens** : access token courte durée + `RefreshToken` long terme stocké en DB chiffré (`EncryptionService`)
- **Mobile biométrie sans password** (G2) : à l'activation Face ID/empreinte, le serveur émet un *bio-token* dédié (purpose=Biometric, expiry 90j, rotation à chaque usage). **Aucun mot de passe n'est stocké sur l'appareil.**
- **Quota refresh tokens par utilisateur** (G6) : 5 derniers tokens "Refresh" actifs maximum, les plus anciens (par `last_used_at`) sont révoqués automatiquement.
- **Anti-énumération** : tous les contrôleurs `[Authorize]` + `[ValidateSoccod]`, refresh token rotatif

### 3.2 Gestion RH
- CRUD complet employé + fiche enrichie (état civil, banque, compétences, sites)
- Hiérarchie : Direction > Service > Section
- Données de base : Filiales, Villes, Qualifications, Fonctions, Catégories
- **Création Odoo-style** ([EmployeModern.tsx](abrpoint.client/src/components/gestionEmploye/EmployeModern.tsx)) : Autocomplete avec « + Créer 'X' » comme dernière option ; codes auto-générés via `SequentialCodeGenerator`
- Import Excel (rubriques, employés via `BulkImportController`)

### 3.3 Pointage & présences
- **Pointage manuel** (web admin) via état périodique
- **Pointage employé** (mobile) avec capture GPS, accuracy, horodatage local
- **Pointage employé** (web — `EmployeeDashboardMobile.tsx`) avec capture GPS
- Calculs services dédiés (`CalculService/`) :
  - `HeureSuppService` (hebdomadaire + journalier optimisé)
  - `HeuresAbsencesService`
  - `CalcTotHeuresService`
  - `PointageMoisService` (calcul séquentiel par employé, thread-safe avec DbContext scoped)
  - `PointageOptimizer` (ajustement automatique entrées/sorties manquantes)
- États : périodique, journalier, retards, assiduité, global

### 3.4 Pointage géolocalisé
- **Schéma** : colonnes `sitlat`, `sitlon`, `sitrad` (rayon m) sur table `site` — créées automatiquement par `BaseDataSchemaMigrator`
- **Service** ([GeoZoneValidator.cs](ABRPOINT.Server/Services/GeoZoneValidator.cs)) : validation Haversine, source DB prioritaire + fallback config `GeoZones:Zones`
- **Mode résolu auto** : `off` si aucun geofence, `reject` dès qu'un site a `(sitlat, sitlon, sitrad)` configuré (override possible via `GeoZones:Mode`)
- **Contrôle au pointage** ([PresencesController.MarkPresence](ABRPOINT.Server/Controllers/PresencesController.cs#L264)) : refus 422 `gps_required` si zones configurées sans GPS, `outside_geofence` si hors rayon
- **UI admin** : carte « Pointage Géolocalisé » dans [FilialeModern.tsx](abrpoint.client/src/components/DonneeDeBase/Filiale/FilialeModern.tsx) — bouton « Utiliser ma position », lien OpenStreetMap, reset
- **Tolérance horloge** : skew client/server bumpé à 90 min (couverture Maghreb/Europe DST)

### 3.5 Congés & autorisations
- **Demandes de congé** ([DemCongeModern.tsx](abrpoint.client/src/components/gestionEmploye/gestionConge/DemConge/DemCongeModern.tsx)) : workflow soumission → manager/admin approve/refuse → titre de congé émis
- **Titres de congé** émis (avec PDF report)
- **RTT** : crédit, consommation, solde annuel par employé ([SoldeCongeModern.tsx](abrpoint.client/src/components/gestionEmploye/gestionConge/SoldeConge/SoldeCongeModern.tsx))
- **CET** (compte épargne temps) : conversion congés non pris en CET
- **Demandes d'autorisation de sortie** + **Autorisations de sortie** approuvées
- **Compensation jours fériés** travaillés
- **Allaitement** (réductions horaires)
- Filtres unifiés sur tous les écrans : recherche libre, statut, type, plage de dates, reset

### 3.6 Préparation paie
- **Rubriques** : CRUD, Excel import, formules
- **Pointage du mois** : agrégation présences par employé, en mode séquentiel thread-safe (un DbContext scoped par requête, pas de parallélisation racée)
- **États** : périodique, retard, présence (PDF via FastReport / DinkToPdf)
- **Export paie** : DocumentFormat.OpenXml (Excel) et PDF
- **Notes de frais**, **missions** avec budget multi-devise (ISO 4217)
- **Bulletins** : génération via `LetterTemplates` (templates personnalisables HTML/Razor-like)

### 3.7 Coffre-fort numérique ([VaultController](ABRPOINT.Server/Controllers/VaultController.cs))
- Upload via FormData multipart (mobile + web)
- **Whitelist extensions** ([FileHelper.cs](ABRPOINT.Server/Helpers/FileHelper.cs)) : pdf, doc/docx, xls/xlsx, csv, png/jpg, etc. — bloque les exécutables et SVG/HTML scriptables
- **Plafond 10 Mo** par fichier (override via env `Uploads__MaxSizeMb`)
- **Path traversal** : noms régénérés en GUID, jamais du nom client
- **Audit orphelins** : endpoint admin [VaultController.AuditOrphans](ABRPOINT.Server/Controllers/VaultController.cs) qui réconcilie DB ↔ filesystem (DB sans fichier physique / fichier sans ligne DB), avec mode `?fix=true` pour purger les lignes orphelines
- Notification employé à chaque dépôt admin
- Vue admin/manager scopée au service
- Téléchargement direct via nginx (volume `uploads_data` RO) — performant, sans hop backend
- Mobile : œil/téléchargement délègue à `Linking.openURL` (Safari/Chrome système)

### 3.8 Signature électronique
- **Web** : SignaturePad + base64 → backend via `SaveBase64Image`, fichier `sig_*.png` dans uploads
- **Mobile** ([SignatureScreen.tsx](abrpoint.mobile/src/screens/SignatureScreen.tsx)) : capture tactile, upload, statut signé verrouille la suppression. Capture d'écran bloquée pendant la session signature (G4).
- Métadonnées : signataire, date, IP — visibles dans l'audit log

### 3.9 Notifications & reporting
- **Push mobile** ([ExpoPushService.cs](ABRPOINT.Server/Services/ExpoPushService.cs)) : Expo Push API, tokens stockés en `PushToken`
- **Email** : MailKit + SMTP, templates HTML
- **In-app** : centre de notifications web + mobile, badge unread
- **Catalogue** ([NotificationCategoryCatalog.cs](ABRPOINT.Server/Authorization/NotificationCategoryCatalog.cs)) : catégories opt-in/opt-out par employé
- **Quiet hours** ([QuietHoursResolver.cs](ABRPOINT.Server/Services/QuietHoursResolver.cs)) : blocage des notifications hors plage horaire configurée
- **Rappels ponctualité** ([PunctualityReminderHostedService.cs](ABRPOINT.Server/Services/PunctualityReminderHostedService.cs)) : balaie périodiquement et notifie
- **PDF** : DinkToPdf (HTML→PDF via wkhtmltopdf), FastReport pour les états réguliers
- **Excel** : DocumentFormat.OpenXml (backend) + ExcelJS (web export client)
- **Rapports disponibles** : état périodique, retards, présence, congés, autorisations, sanctions, paie, RTT, contrat
- **Dashboard analytics** (admin/manager) : KPIs présence/absence/ponctualité/h.supp, courbes Recharts, animations count-up

### 3.10 Dashboard
- **3 vues** : `EmployeeDashboard` (self), `ManagerDashboard` (équipe), `DashboardModernAdmin` (global)
- **Personnalisable** : widgets affichables/masquables, persistance localStorage par soccod
- **Filtres période** : aujourd'hui / semaine / mois — toutes les métriques scopées
- **Animations** : `useCountUp` (RAF + easeOutCubic) sur les KPIs et chiffres bento
- **PDF export** : snapshot dashboard

### 3.11 Modules transverses
- **RAG** ([RagController](ABRPOINT.Server/Controllers/RagController.cs), [ChatRagController](ABRPOINT.Server/Controllers/ChatRagController.cs)) : indexation documents vault, recherche sémantique via Qdrant + LangChain, LLM via OpenRouter (Gemini 2.0 Flash par défaut, switchable Anthropic Claude)
- **Document Scan** ([DocumentScanController](ABRPOINT.Server/Controllers/DocumentScanController.cs)) : OCR/extraction structurée des justificatifs
- **Stripe billing** ([BillingController](ABRPOINT.Server/Controllers/BillingController.cs), [StripeWebhookController](ABRPOINT.Server/Controllers/StripeWebhookController.cs)) : abonnements, webhooks
- **Support / Contact** ([ContactController](ABRPOINT.Server/Controllers/ContactController.cs))
- **Tenant Pilot** ([TenantPilotController](ABRPOINT.Server/Controllers/TenantPilotController.cs)) : opérations master sur les tenants

---

## 4. Workflows administrateur et employé

### 4.1 Workflow employé (mobile, golden path)
```
Login email/pwd ──► (2FA TOTP si activé) ──► JWT + refresh
        │
        ▼  (option : enrôlement biométrique → bio-token serveur)
HomeScreen ──► [Bouton POINTER]
        │       │ capture GPS (expo-location, 5s timeout)
        │       │ POST /Presences/mark-presence/{soc}/{emp}?lat=...&lon=...&clientTime=...
        │       ▼
        │   Backend valide :
        │       ├─ caller owns/manages employee ✓
        │       ├─ skew clock ≤ 90 min ✓
        │       ├─ si geofence : GPS requis + dans rayon ✓
        │       └─ dans période d'emploi ✓
        │       │
        │       ▼
        │   INSERT/UPDATE presence + log GPS
        │
        ├──► Vault : upload doc / consulter / signer
        ├──► Demandes congé / autorisation
        ├──► Auto-lock après 10 min d'inactivité (Face ID pour rouvrir)
        └──► Notifications push (Expo)
```

### 4.2 Workflow administrateur (web)
```
Login ──► JWT (admin scope, Utiadm='1' OU Utirole=Administrator)
   │
   ├─ DonneeDeBase ──► Filiales (geofence), Sites, Villes, Qualifications, ...
   │
   ├─ Gestion Employés
   │   ├─ Création Odoo-style (codes auto-gen)
   │   ├─ Contrats (saisie, renouvellement, alertes expiration)
   │   └─ Sanctions
   │
   ├─ Pointage
   │   ├─ État périodique (consultation, ajustement)
   │   ├─ Optimiseur (recalcule présence sur intervalle)
   │   └─ Imports CSV pointeuse physique
   │
   ├─ Congés ──► Workflow approbation
   │
   ├─ Préparation Paie
   │   ├─ Rubriques (Excel import)
   │   ├─ Pointage du mois
   │   └─ États PDF (présence, retard, périodique)
   │
   ├─ Vault ──► Upload bulk pour employés + audit orphelins
   │
   └─ Paramètres
       ├─ Rôles & permissions (matrice par module)
       ├─ Plan / billing Stripe
       └─ Notifications opt-in
```

### 4.3 Workflow manager
- Sous-ensemble de l'admin scopé à son service/section
- Approbation congés/autorisations de son équipe
- Vue dashboard équipe via [ManagerDashboardController](ABRPOINT.Server/Controllers/ManagerDashboardController.cs)

### 4.4 Workflow signup tenant (onboarding technique)
```
Landing /signup ──► [SignupController] (rate-limited 3/h/IP)
        │
        ▼
1. Validation email unicité (master DB → TenantEmailIndex)
2. Création Tenant (slug = sous-domaine, host)
3. Création tenant DB (BaseDataSchemaMigrator clone le schéma)
4. Provisioning admin initial (DatabaseInitialization__Admin*)
5. Stripe customer si plan payant ; trial period sinon
6. Email welcome + login → tenant scope actif
```

---

## 5. Sécurité mobile renforcée (G1 → G6)

Six durcissements appliqués en plus du socle JWT/HTTPS :

| ID | Risque | Mitigation | Implémentation | Plan |
|---|---|---|---|---|
| **G1** | MITM via CA compromise | **Certificate Pinning** | Android `network_security_config.xml` (pin SPKI) + iOS `NSPinnedDomains` dans `Info.plist`. Script `scripts/get-cert-pins.sh` pour générer les pins (intermédiaires LE R10/R11). | Tous (build-time) |
| **G2** | Vol de credentials sur device | **Bio-token sans password** | Plus de password stocké sur l'appareil. À l'activation Face ID/empreinte, le serveur émet un bio-token (purpose=Biometric, 90j, rotation usage). Endpoints `/MobileAuth/biometric-{enable,login,disable}`. | Standard+ (l'app mobile elle-même est gatée Standard+) |
| **G3** | Reverse-engineering sur émulateur/device root | **Device trust assessment** | [deviceSecurity.ts](abrpoint.mobile/src/services/deviceSecurity.ts) évalue `Device.isDevice`, signatures émulateurs (Genymotion, BlueStacks, Nox), versions OS obsolètes (iOS<14, Android<9). Bandeau visible si trust dégradé. | **Premium uniquement** — hook `useDeviceTrust` court-circuité hors Premium (cf. §8.4) |
| **G4** | Exfiltration via screenshot | **Screen capture protection** | `expo-screen-capture` + hook `useSecureScreen` actif sur DigitalVault, Signature, Profile, Balance. `BackgroundShield` masque l'app en multi-tasking. Détection des screenshots iOS avec alerte. | **Premium uniquement** — hook `useSecureScreen` no-op hors Premium |
| **G5** | Session orpheline sur device perdu | **Auto-lock après inactivité** | `InactivityContext` lock après 10 min foreground OU 5 min en arrière-plan. `LockScreen` overlay avec déverrouillage Face ID, sinon "Se déconnecter". | Standard+ |
| **G6** | Sessions persistantes infinies | **Quota refresh tokens** | Colonne `purpose` distingue Refresh vs Biometric. `EnforceRefreshTokenQuota` garde les 5 derniers RT actifs (par `last_used_at`), révoque le reste. Logout filtré sur `purpose=Refresh` (les bio-tokens survivent). | Tous |

**Note technique sur G1 (cert pinning)** : la configuration est *native au binaire mobile* (Android `network_security_config.xml` + iOS `Info.plist`) et n'est pas désactivable au runtime. Conséquence : un client Standard installe la même APK/IPA que Premium et bénéficie *de fait* du cert pinning. Cette caractéristique est conservée — l'argument marketing « cert pinning » du pack Premium reste valable car (i) c'est documenté comme bénéfice contractuel Premium et (ii) la valeur métier de G3/G4 (device trust + anti-screenshot) reste l'avantage différenciant effectif.

**Endpoint `/MobileAuth/me`** expose `planCode` et `planFeatures` (mirror du record PlanFeatures backend) — consommé par `AuthContext` mobile pour conditionner G3 et G4.

---

## 6. Sécurité backend & infrastructure

### 6.1 Surface protégée

| Vecteur | Mitigation |
|---|---|
| **OWASP A01 — Broken Access Control** | `[Authorize]` + `[ValidateSoccod]` + permissions par module + caller-owns checks |
| **A02 — Cryptographic Failures** | BCrypt (passwords), refresh tokens chiffrés AES, TLS 1.2/1.3 only, HSTS preload 1 an + includeSubDomains |
| **A03 — Injection** | EF Core paramétré ; pas de SQL concat utilisateur |
| **A04 — Insecure Design** | Garde-fous métier explicites (skew clock, hire/termination dates, GPS requis si geofence) |
| **A05 — Security Misconfig** | Server header masqué (`AddServerHeader = false`), `server_tokens off` côté nginx, erreurs masquées en prod |
| **A07 — Identification & Auth Failures** | 2FA TOTP, refresh rotatif + quota 5/user (G6), rate-limit `clock-in` (6/min/IP), `auth-signup` (3/h/IP), `auth-login` (rate-limited) |
| **A08 — Software & Data Integrity** | Whitelist d'extensions uploads (anti-RCE), nginx `deny` sur `.php/.exe/.sh` dans `/api/uploads/` |
| **A09 — Logging & Monitoring** | Logging structuré (`ILogger<>`), `AuditLog` table pour actions critiques |
| **A10 — SSRF** | RAG sidecar isolé sur réseau interne uniquement |
| **Path traversal** | UUID file naming, parent dir constant |
| **Mass assignment** | DTOs explicites, récupération entité serveur avant patch |
| **CSRF** | Stateless JWT (Bearer header) → non applicable |

### 6.2 Headers HTTP (nginx-proxy)

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(self), camera=(self), microphone=()
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
Origin-Agent-Cluster: ?1
Content-Security-Policy: default-src 'self'; img-src 'self' data: https:;
  style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline';
  font-src 'self' data:; connect-src 'self' https://concorde-work-force.com;
  frame-src 'self' blob:; frame-ancestors 'self';
  base-uri 'self'; form-action 'self';
X-Robots-Tag: noindex, nofollow
```

CSP émise sur **une seule ligne** (les headers HTTP n'autorisent pas les LF — l'éclatement ci-dessus est purement documentaire) ; `script-src 'self' 'unsafe-inline'` pour autoriser le bootstrap inline généré par Vite ; `frame-src 'self' blob:` indispensable pour autoriser les iframes `blob:` utilisées pour l'aperçu PDF des modèles de documents (sans cette directive, le navigateur retombe sur `default-src` et bloque l'aperçu). À durcir plus tard via nonce/hash quand le pipeline build le permettra.

### 6.3 Healthchecks
- `GET /healthz` → liveness (le process répond)
- `GET /readyz` → readiness (DB ping `SELECT 1`) — utilisable par orchestrateur (k8s, swarm) ou monitoring externe (UptimeRobot)

### 6.4 Auto-migration de schéma
[BaseDataSchemaMigrator.cs](ABRPOINT.Server/Services/BaseDataSchemaMigrator.cs) applique au démarrage, **par tenant et de façon idempotente**, toutes les évolutions de schéma : nouvelles colonnes (`AddColumnIfMissingAsync`), nouveaux index (`EnsureIndexAsync`), nouvelles tables (`EnsureXxxTableAsync`). Aucune intervention DBA, aucune migration EF formelle à appliquer manuellement.

Liste actuelle des migrations idempotentes intégrées : ville (vilcod/villib), parametre (parmodemp, CET), employe (RTT 4 cols + vilcod), site (geofence sitlat/sitlon/sitrad), refresh_tokens (purpose, last_used_at, index quota), mission (recréation table propre), notedefrais (missionid, devise), RAG (rag_document, rag_letter_template, rag_chat_log), **seed initial du référentiel pays/nations** (40 entrées FR, Maghreb, Afrique francophone, marchés annexes — appliqué uniquement si la table est vide pour respecter la liberté de l'admin de modifier la liste a posteriori).

---

## 7. APIs et architecture des services

### 7.1 Conventions REST
- Préfixe `/api`
- Routes : `/api/<Resource>` + `/{soccod}/...` quand soccod fait partie du chemin
- Verbes : GET (read), POST (create), PUT (update), DELETE
- **Headers requis** : `Authorization: Bearer <jwt>`, `X-Tenant-Slug` (sauf endpoints publics : signup, /healthz, /api/uploads, /api/auth/*)
- **Statuts métier custom** :
  - `402` — quota plan dépassé (avec `code: plan_limit_*`)
  - `422` — règle métier violée (codes : `gps_required`, `outside_geofence`, `clock_skew`, `before_hire_date`, `after_termination_date`)
  - `403` — permission refusée (`PermissionCatalog`)

### 7.2 Services horizontaux
| Service | Rôle |
|---|---|
| `EncryptionService` | Chiffrement symétrique des refresh tokens et données sensibles |
| `EmailService` + `EmailTemplates` | Envoi MailKit avec templates HTML |
| `ExpoPushService` | Push mobile via Expo Push API (batchs, retries, expiry token cleanup) |
| `GeoZoneValidator` | Validation Haversine geofence (DB + config) |
| `PunctualityReminderHostedService` | Background service rappels ponctualité |
| `QuietHoursResolver` | Filtre notifications hors plage |
| `AiService` + `Rag/` | Indexation, search sémantique, génération |
| `BaseDataSchemaMigrator` | Provisionnement schéma tenant à la volée (cf §6.4) |
| `MobileTablesInstaller` | Migrations mobile-spécifiques (push tokens, notifications, settings) |

### 7.3 Validateurs et middlewares
- `[ValidateSoccod]` — empêche un user de la société A de lire/écrire celles de B
- `[CanGetEtatPeriodique]`, etc. — basés sur `RolePermission`
- `[EnableRateLimiting("clock-in")]` — ~6 pointages/min/IP, `auth-login`, `auth-signup` (3/h/IP)
- `TenantResolverMiddleware` — injecte le tenant courant dans le scope, déclenche l'auto-migration au premier passage par tenant

---

## 8. Gestion des rôles et permissions

### 8.1 Modèle
- **Role** : entité avec `RoleName` (e.g. `Administrator`, `Manager`, `ResponsableRH`, `Employe`, `Comptable`)
- **RolePermission** : matrice rôle × module avec drapeaux `RpConsult`, `RpAdd`, `RpModify`, `RpDelete`
- **Modules** : ~30 modules métier (Pointage, Préparation Paie, Données de Base, Gestion des Congés, Coffre-fort, Notifications, Paramètres, etc.)
- **`Utiadm` = '1'** : super-admin tenant, bypass total

### 8.2 Application
```csharp
[CanGetEtatPeriodique]
public async Task<IActionResult> Get(...)

PermissionCatalog.IsAdminRole(user.Utirole)
```

### 8.3 Garde-fous métier
- `CallerOwnsOrManagesEmpAsync` : empêche un employé de pointer/consulter pour un collègue
- Manager scopé à son service via service/section
- Cache permissions par utilisateur (`IMemoryCache`) pour éviter le hot-path DB

### 8.4 Plan gating (verrouillage par pack commercial)

En sus du modèle Role × Module ci-dessus, une seconde couche d'autorisation conditionne l'accès aux fonctionnalités selon le **plan commercial** souscrit par le tenant. Cette couche est indépendante des rôles : un Administrateur d'un tenant Starter reste bloqué sur les fonctionnalités Premium.

| Couche | Mécanisme | Comportement en cas de refus |
|---|---|---|
| **Backend** | Attribut `[RequirePlanFeature(nameof(PlanFeatures.X))]` sur contrôleur / action — résolution par réflexion sur `PlanFeatures` du record `PlanDefinition` ([PlanCatalog.cs](ABRPOINT.Server/Tenancy/PlanCatalog.cs)) | HTTP `402 Payment Required` avec payload `{ code: "plan_feature_locked", feature, currentPlan, message }` |
| **Frontend web** | Hook `useAuth().planAllows('featureKey')` lu depuis `/me` (clé `planFeatures` exposée par le backend) | Items de navigation masqués ; intercepteur axios redirige les 402 vers `/upgrade` |
| **Frontend mobile** | `AuthContext.user.planFeatures` rempli au login et à `/MobileAuth/me` | Hooks de sécurité `useDeviceTrust` / `useSecureScreen` no-op hors Premium ; tentative d'auth mobile sur Starter renvoie 402 dès `/MobileAuth/login` |

**Endpoints gatés actuellement** :

| Endpoint | Feature requise | Effet pour Starter |
|---|---|---|
| `POST /api/MobileAuth/login`, `/biometric-login` | `MobileApp` | Refus 402 → l'app mobile devient inaccessible |
| `POST /api/Presences/mark-presence` (avec lat/lon) | `Geolocation` | Refus 402 si coordonnées GPS fournies (le pointage manuel sans GPS reste possible) |
| Toutes routes `/api/Vault/*` (class-level) | `DigitalVault` | Refus 402 → coffre-fort masqué |
| `POST /api/Vault/sign/{id}` | `ElectronicSignature` | Refus 402 supplémentaire en plus du verrou DigitalVault |
| Toutes routes `/api/Rag/*`, `/api/ChatRag/*` (class-level) | `RagAi` | Refus 402 → assistant IA inaccessible (visible uniquement Premium) |

**Pendant l'essai gratuit** (statut Tenant = `Trialing`), `RequirePlanFeatureAttribute` accorde **toutes** les features pour permettre l'évaluation complète de la solution — la facturation kick-in à la conversion.

**Tenants legacy / plan non défini** : pour rétrocompatibilité, un tenant dont `PlanCode` ne matche aucun pack du catalogue ne se voit appliquer aucune restriction (équivaut à plan Premium). Migration manuelle attendue avant facturation effective.

---

## 9. Performances et scalabilité

### 9.1 Techniques en place
- **EF Core** : `AsNoTracking()` sur tous les reads ; queries `.Select(...)` projetées ; pas de N+1 connus dans les écrans HOT
- **Pagination** systématique
- **Cache permissions** : `IMemoryCache` ttl ~minute
- **Static uploads** : servis directement par nginx (alias `/app/uploads/`), bypass backend → CDN-friendly
- **Charts mobile** : virtualisation FlatList sur listes longues
- **Filter dataflow web** : `useMemo` partout, key-based memoization

### 9.2 Limites identifiées
| # | Limitation | Impact | Mitigation prévue |
|---|---|---|---|
| 1 | DbContext non-pooled (multi-tenant) | Overhead ~5-10ms/req | Acceptable < 100 tenants ; passer à `IDbContextFactory<>` poolé par tenant si > 200 |
| 2 | Génération PDF synchrone | Blocage thread sur gros rapports | Queue Hangfire/Quartz pour rapports massifs |
| 3 | Cache distribué absent | Multi-instance backend = sticky sessions ou Redis | Ajouter Redis pour `IDistributedCache` avant scaling horizontal |
| 4 | Skew horloge basé local time | Pas de TZ-awareness propre | TODO : envoyer UTC depuis client, comparer UtcNow |
| 5 | Pas d'e2e automatisé | Régression UI possible | Playwright/Detox à mettre en place |
| 6 | RAG indexation manuelle | Documents vault récents pas dans le LLM | Scheduler auto sur événement upload |
| 7 | Single-region SQL Server | Latence tenants outre-mer | Read replicas régionales si demande |
| 8 | Pas de monitoring APM | Diagnostic prod manuel | OpenTelemetry + Grafana / Application Insights |

---

## 10. Fonctionnalités finalisées vs en cours

### 10.1 Modules finalisés
| Module | Statut |
|---|---|
| Auth login + 2FA | ✅ Complet |
| Bio-token mobile (sans password) | ✅ Backend + mobile |
| Multi-tenant master/tenant | ✅ Provisioning fonctionnel + auto-migration |
| Pointage manuel + mobile | ✅ Complet |
| Géolocalisation pointage | ✅ Schéma + service + UI admin |
| Calculs présence/retard/h.supp | ✅ Couvert par tests unitaires |
| Congés (demandes, titres, RTT, CET) | ✅ Workflow complet, filtres unifiés |
| Autorisations de sortie + demandes | ✅ Complet, filtres unifiés |
| Coffre-fort | ✅ Web + mobile (œil/download câblé), audit orphelins admin |
| Signature électronique | ✅ Web + mobile, capture d'écran bloquée |
| Notifications push + email + in-app | ✅ Avec quiet hours et catalogue |
| Dashboard admin/manager/employee | ✅ Avec animations count-up |
| Reporting PDF/Excel | ✅ Suite complète |
| Préparation paie | ✅ Rubriques (avec import Excel), pointage mois, exports |
| Stripe billing | ✅ Webhooks + plan limits 402 |
| RAG / chatbot IA | ✅ Indexation vault + chat contextuel |
| Cert pinning + screenshot blocking + auto-lock | ✅ Mobile G1/G4/G5 |
| Device trust + bio-token + RT quota | ✅ G2/G3/G6 |
| Headers sécurité + healthchecks | ✅ HSTS + CSP + COOP/CORP + /healthz + /readyz |
| Auto-migration de schéma | ✅ BaseDataSchemaMigrator pour tous tenants |

### 10.2 En cours / à consolider
| Module | Détail |
|---|---|
| Geofence — pédagogie utilisateur | UI ok, mais doc utilisateur (« comment configurer un site ») à rédiger |
| Notifications — A/B test catégories | Catalogue présent, métriques d'opt-in à instrumenter |
| RAG — fraîcheur index | Pas de réindexation incrémentale automatique sur upload vault |
| Onboarding tenant — guidage premier login | `OnboardingGuide.tsx` existe, à enrichir |
| Backups uploads + SQL | Scripts `backup.sh`/`restore.sh` créés, à brancher en cron prod |

---

## 11. Stratégie SaaS et segmentation des offres

### 11.1 Segmentation cible

| Segment | Profil | Plan suggéré | Volume employés |
|---|---|---|---|
| **TPE / petites équipes** | 1-10 salariés, besoin RH de base | Starter | ≤ 10 inclus |
| **PME en croissance** | 10-50 salariés, mobile + congés + paie | Standard | ≤ 25 inclus |
| **ETI / Multi-filiales** | 25-100+ salariés, IA + audit + sécurité renforcée | Premium | ≤ 50 inclus |
| **Groupes / Comptes clés** | >100 salariés, intégrations API/SSO | Premium + add-ons | overage Premium |

### 11.2 Marché géographique prioritaire

1. **France** (cœur du marché V1) : 4M+ PME, pression réglementaire (loi El Khomri sur le pointage, RGPD), forte appétence SaaS RH
2. **Belgique** (extension proche) : législation RH proche, marché francophone, besoins RGPD identiques
3. **Maghreb / Afrique francophone** : Tunisie, Maroc, Algérie, Sénégal, Côte d'Ivoire — forte demande digitalisation, peu d'offres locales
4. **DOM-TOM** : couverture cross-fuseau native (skew 90 min)

### 11.3 Modèle d'abonnement

- **Facturation** : **forfait mensuel fixe + overage** par salarié supplémentaire au-delà du seuil inclus. Cf. §12 pour les barèmes.
- **Modèle Stripe** : subscription à 2 items — `base` (qty=1, prix forfaitaire) + `seat` (qty=overage, prix par salarié supplémentaire). `ProrationBehavior = create_prorations` → ajustement immédiat en cours de mois.
- **Engagement** : sans engagement (résiliation à tout moment, prorata jusqu'à fin de période)
- **Période d'essai** : **30 jours gratuits sur tous les packs payants, sans carte bancaire** (durcissement V2 par rapport aux 14 jours initiaux). Pendant l'essai, l'utilisateur dispose de toutes les fonctionnalités Premium, plafonné à 10 salariés / 1 société / 1 site pour limiter l'abus.
- **Encaissement** : Stripe (CB EU + Apple Pay + Google Pay), webhooks `customer.subscription.*`, gestion automatique des renewal/dunning.
- **Job synchronisation seats** : `EmployeeBillingSyncService` (BackgroundService, intervalle 24 h configurable) compte les `Empactif='A'` par tenant et pousse la quantité Stripe via `SubscriptionItemService.UpdateAsync` — idempotent (skip si quantité identique), résilient (try/catch par tenant). Garantit que l'overage est facturé en temps réel.
- **Devises supportées** : EUR (France/Belgique/UE), MAD/TND/DZD (Maghreb), XOF (UEMOA) — multi-devise sur missions/notes de frais (ISO 4217). La facturation tenant est en EUR par défaut.

---

## 12. Packs tarifaires et fonctionnalités incluses

Les prix ci-dessous reflètent strictement le catalogue verrouillé dans [PlanCatalog.cs](ABRPOINT.Server/Tenancy/PlanCatalog.cs) et les `price_id` Stripe correspondants (`appsettings.json` → `Stripe:Prices:{Plan}:{base|seat}:monthly`). Toute évolution doit être propagée simultanément backend + frontend ([PlanConfigurationPage.tsx](abrpoint.client/src/components/Pricing/PlanConfigurationPage.tsx) miroir) + Stripe Dashboard.

### 12.1 Pack Starter — 29,50 € / mois
**Cible** : TPE / petites équipes
**Tarif** : 29,50 € HT/mois forfait fixe — jusqu'à **10 salariés inclus** — au-delà, **+ 4,90 € par salarié supplémentaire**
**Période d'essai** : 30 jours gratuits, sans carte bancaire

**Fonctionnalités incluses** :
- Gestion RH de base (fiches employés, contrats, qualifications)
- Pointage web manuel
- Calendrier d'absences
- Tableau de bord simple (KPI de base)
- Exports simples (PDF, Excel basique)
- 1 administrateur (création utilisateurs supplémentaires possible mais bornée par MaxSocietes/MaxSites)
- Support standard (réponse par email best-effort, J+2 ouvré)

**Limites techniques appliquées** : MaxSocietes = 1, MaxSites = 1. Pas de plafond dur sur le nombre de salariés — overage facturé séparément.

**Modules désactivés / 402 en cas d'appel direct** :
- ❌ App mobile (auth mobile refusée → l'app reste téléchargeable mais inutilisable)
- ❌ Pointage géolocalisé (GPS requis)
- ❌ Coffre numérique
- ❌ Signature électronique
- ❌ Multi-sites / Multi-sociétés (limite hard à 1/1)
- ❌ Tableaux de bord avancés / Reporting RH analytique
- ❌ Assistant IA (RAG)
- ❌ Audit logs avancés
- ❌ Branding personnalisé
- ❌ Sécurité mobile renforcée (device trust, screenshot blocking au runtime)

### 12.2 Pack Standard — 59,50 € / mois
**Cible** : PME en croissance
**Tarif** : 59,50 € HT/mois forfait fixe — jusqu'à **25 salariés inclus** — au-delà, **+ 6,90 € par salarié supplémentaire**
**Période d'essai** : 30 jours gratuits, sans carte bancaire

**Fonctionnalités incluses** :
- Tout le Starter +
- ✅ Application mobile (iOS + Android, biométrie, push, notifications)
- ✅ Pointage géolocalisé (geofence par site, mode warn/reject)
- ✅ Gestion congés complète (RTT, CET, sanctions, allaitement, autorisations)
- ✅ Coffre-fort numérique (templates avec catégories canoniques imposées : Contrat / Attestation Travail / Attestation Salaire / Demande Congé / Titre Congé / Autorisation Sortie / Visite Médicale / Allaitement)
- ✅ Signature électronique (valeur juridique, restriction propriétaire/admin)
- ✅ Notifications push + email + in-app (`NotificationsController` + Expo Push)
- ✅ Reporting avancé : état de présence, état de retard, état des absences, échéances contrats, cahier des congés, calendrier équipe
- ✅ Exports PDF/Excel complets
- ✅ Préparation paie (rubriques avec mapping vartype/unité aligné moteur de pointage, export vers Sage en Excel)
- ✅ Gestion multi-sites (MaxSites = 3) — mono-société
- ✅ Support prioritaire (SLA 24 h ouvrées)

**Limites techniques appliquées** : MaxSocietes = 1, MaxSites = 3. Pas de plafond hard sur les salariés.

**Modules désactivés** :
- ❌ Multi-sociétés (limite à 1)
- ❌ Assistant IA (RAG)
- ❌ Audit logs avancés
- ❌ Branding personnalisé
- ❌ Device trust / Screenshot blocking au runtime (le binaire mobile inclut le cert pinning natif mais les hooks de durcissement sont court-circuités — cf. §5)

### 12.3 Pack Premium — 119,00 € / mois
**Cible** : ETI / Multi-filiales, environnement sécurisé
**Tarif** : 119 € HT/mois forfait fixe — jusqu'à **50 salariés inclus** — au-delà, **+ 9,90 € par salarié supplémentaire**
**Période d'essai** : 30 jours gratuits, sans carte bancaire

**Fonctionnalités incluses** :
- Tout le Standard +
- ✅ Multi-sociétés illimité (MaxSocietes = ∞) + multi-sites illimité (MaxSites = ∞)
- ✅ Tableaux de bord avancés (KPI temps réel, distribution par service, alertes)
- ✅ Assistant IA contextuel (RAG sur documents tenant via Qdrant + sidecar Python — gating `RagAi`)
- ✅ Audit logs avancés (export RGPD)
- ✅ Sécurité mobile renforcée — hooks `useDeviceTrust` + `useSecureScreen` actifs (gating `DeviceTrustEnforced` + `ScreenshotProtection`)
- ✅ Cert pinning (caractéristique native du binaire, marqué Premium contractuellement — cf. §5)
- ✅ Branding personnalisé (capacité prévue, moteur de thème à finaliser — feature flag `CustomBranding`)
- ✅ Conformité RGPD avancée
- ✅ SLA Premium + support prioritaire
- ✅ Onboarding accompagné (kick-off call, import data assisté, formation admin + manager)

**Limites techniques** : aucune (MaxSocietes/MaxSites/MaxEmployees = NULL côté `PlanLimits`).

**Roadmap V1.1 — sur devis ou add-on Premium** :
- 🔜 API publique pour intégrateurs partenaires
- 🔜 SSO entreprise (SAML / OIDC)
- 🔜 Connecteurs paie directs (Sage Paie, Cegid Quadra) — l'export Excel reste disponible nativement

### 12.4 Add-ons (sur devis indépendant du pack)
- Pen-test annuel personnalisé
- Hébergement région dédiée (FR/BE/MA) — instance isolée
- Marque blanche complète (custom CSS + domaine personnalisé)
- API publique pour intégrateurs partenaires
- Formation présentielle administrateurs / managers

---

## 13. Onboarding client

### 13.1 Self-service (Essentiel & Standard)
1. **Signup** sur `/signup` → email + nom société + slug → tenant créé automatiquement
2. **Email welcome** avec lien d'activation et URL tenant `<slug>.concorde-work-force.com`
3. **Premier login admin** → guide `OnboardingGuide.tsx` (5 étapes, dismissible) :
   - Création de la première filiale + geofence
   - Création des fonctions et qualifications
   - Import Excel des employés (template fourni)
   - Configuration des rôles et permissions
   - Invitation des premiers collaborateurs (email)
4. **Période d'essai** 14j → relance email J-7, J-3, J-1 → conversion Stripe ou downgrade Essentiel

### 13.2 Accompagné (Premium)
- Kick-off call (1h) avec Account Manager
- Import data assisté (employés, contrats, soldes congés depuis l'existant Excel/CSV)
- Configuration personnalisée (rôles, modules activés, branding)
- Formation administrateurs (2h en visio)
- Formation managers (1h en visio)
- 30 jours de support hyper-réactif post-go-live

### 13.3 Outillage onboarding (présent dans le code)
- `SignupController` rate-limité (3/h/IP, anti-bot)
- Tenant DB provisionnée automatiquement avec schéma à jour (`BaseDataSchemaMigrator`)
- Données de base seedées (modules, rôles système, admin initial)
- Exemples Excel d'import téléchargeables depuis l'écran admin

---

## 14. Stratégie marketing France / Belgique / Afrique francophone

### 14.1 France
**Positionnement** : alternative française à Factorial / Skello / Combo, focus pointage géolocalisé + RGPD natif.

**Canaux** :
- SEO : contenus blog (« obligation pointage légal », « calcul RTT 2026 », « gérer les congés payés »)
- LinkedIn ads ciblage RH / Office Manager / DAF — PME 10-200
- Partenariats experts-comptables et cabinets RH (commission ou marque blanche)
- Salons : Solutions RH Paris, Workspace Expo, salons régionaux CCI
- SEA Google : mots clés « logiciel pointage », « gestion congés », « SaaS RH » (CPC élevé mais conversion forte)
- Référencement annuaires : Capterra, GetApp, Appvizer

**Tarification** : EUR, TVA française, facturation Stripe (entreprise FR)

### 14.2 Belgique
**Positionnement** : extension naturelle France, conformité RGPD identique, langue française pour la Wallonie + Bruxelles.

**Canaux** :
- Partenariats secrétariats sociaux (Acerta, SD Worx, Partena Professional)
- LinkedIn ciblage Bruxelles / Wallonie
- Adaptation petite : références belges, témoignages clients
- Connecteurs paie locaux (priorité Acerta sur roadmap)

**Tarification** : EUR, TVA belge, conformité ONSS / Limosa documentée

### 14.3 Afrique francophone (Maghreb + UEMOA)
**Positionnement** : modernisation du pointage et de la paie pour PME/ETI dont les outils actuels sont obsolètes (Excel, logiciels desktop monopostes). Argument fort : **mobile-first** (pénétration smartphone élevée), **bio-token sans connexion permanente**.

**Canaux** :
- Partenariats intégrateurs locaux (Maroc : pôle Casablanca, Tunisie : pôle Tunis, Sénégal : pôle Dakar)
- LinkedIn et Facebook Business ciblage DRH PME locales
- Présence salons : SIDIB Tunis, Africa CEO Forum, GITEX Africa
- **Pricing adapté** : grille spécifique en MAD/TND/DZD/XOF (-30 à -50% vs grille EUR pour s'aligner aux salaires locaux)
- Témoignages clients locaux mis en avant

**Spécificités techniques** :
- Skew horloge 90 min (couverture DST Maroc/Algérie/Tunisie)
- Multi-devise sur missions et notes de frais
- Hébergement région optionnel (Premium add-on) pour souveraineté de la donnée

### 14.4 Calendrier indicatif marketing
| Trimestre | France | Belgique | Afrique fr. |
|---|---|---|---|
| T1 V1 | Lancement public, SEA, salons | — | — |
| T2 V1 | Capterra/GetApp, contenus blog | Lancement Wallonie | Pilote 2-3 partenaires |
| T3 V1 | Salons régionaux | Salons Bruxelles | Lancement officiel Maroc + Tunisie |
| T4 V1 | Account-based marketing ETI | Roadmap connecteur Acerta | Extension UEMOA |

---

## 15. Préparation App Store et Google Play

### 15.1 Prérequis comptes
- [ ] Compte Apple Developer (99$/an) au nom de l'entité Concorde
- [ ] Compte Google Play Developer (25$ one-shot) au nom de l'entité Concorde
- [ ] Certificats iOS (distribution + push) générés via Apple Developer Portal
- [ ] Keystore Android signé (production) backupé hors repo

### 15.2 Prérequis techniques (en place)
- [x] Build EAS Expo configuré (`eas.json` avec channels prod/preview)
- [x] Bundle ID iOS et `applicationId` Android distincts (cohérents avec slug bundle)
- [x] Icône adaptive Android paddée (script `generate-padded-icon.js`)
- [x] `network_security_config.xml` Android prêt pour cert pinning prod
- [x] `Info.plist` iOS avec `NSPinnedDomains` + permissions location/camera/biometric/microphone
- [x] Versioning automatique via Expo

### 15.3 Métadonnées stores (à finaliser)
- [ ] **Description courte** (80 chars max)
- [ ] **Description longue** (4000 chars Apple / 4000 Google)
- [ ] **Captures d'écran** : 5-6 par store (login, home pointage, vault, signature, dashboard)
- [ ] **Vidéo de démonstration** 30s (optionnel mais recommandé Apple)
- [ ] **Catégorie** : Business / Productivity
- [ ] **Classification d'âge** : 4+ (Apple) / Tout public (Google)
- [ ] **Mots-clés ASO** : pointage, RH, paie, congés, employé, présence, biométrique
- [ ] **Politique de confidentialité** publique (URL accessible HTTPS)
- [ ] **Privacy Manifest iOS** (iOS 17+ : déclaration des APIs sensibles utilisées)
- [ ] **Data Safety Google** : déclaration des données collectées (location, biométrie, fichiers)

### 15.4 Tests pré-soumission
- [ ] Build release Android (AAB signé) installé en interne
- [ ] Build release iOS distribué via TestFlight (groupe interne 5-10 utilisateurs)
- [ ] Validation des permissions runtime (location, camera, photos, notifications)
- [ ] Test cert pinning sur production (rotation certificat simulée)
- [ ] Test bio-token end-to-end (enrôlement, login, expiry, rotation)
- [ ] Soumission TestFlight externe (50 testeurs beta) avant prod

### 15.5 Risques de rejet (anticipés)
| Risque | Mitigation |
|---|---|
| Apple : « app trop similaire à un site web » | Justifier les fonctions natives : GPS, biométrie, push, capture signature, mode hors-ligne (à venir) |
| Apple : usage géolocalisation en arrière-plan | Pas en arrière-plan dans l'app — uniquement on-demand au pointage. À documenter en review notes. |
| Google : Data Safety incohérent | Audit checklist data collected vs déclaré, alignement code ↔ store |
| Cert pinning trop strict bloque review | Pinning conditionnel build prod uniquement ; build dev pointe vers staging avec pins staging |

---

## 16. Éléments pour démonstrations commerciales

### 16.1 Scénarios de démo (15-20 min)

**Démo 1 — Le pointage simplifié (5 min)**
1. Connexion mobile employé
2. Pointage entrée avec GPS visible sur carte
3. (côté admin) Vue temps réel du pointage sur le dashboard
4. Démonstration geofence : tentative de pointage hors zone → refus 422

**Démo 2 — Cycle congé complet (5 min)**
1. Demande de congé mobile (sélection dates + motif)
2. Notification push reçue par le manager
3. Approbation manager → notification employé
4. Solde congé mis à jour automatiquement, titre PDF généré

**Démo 3 — Coffre-fort & signature (5 min)**
1. Admin upload bulletin de paie pour un employé
2. Notification reçue par l'employé
3. Employé ouvre le bulletin, signe tactilement, statut signé verrouillé
4. Audit log montre signataire + date + IP

**Démo 4 — Préparation paie (5 min)**
1. Pointage du mois agrégé (employés × jours × heures)
2. Export Excel rubriques
3. État périodique PDF
4. Vue dashboard KPIs : présence, retards, h.supp

### 16.2 Tenant de démo
- **Slug** : `demo`
- **URL** : `demo.concorde-work-force.com`
- **Compte démo** : `demo@concorde-work-force.com` / mot de passe rotatif fourni au commercial
- **Données** : 50 employés fictifs, 6 mois de pointages générés, congés en différents statuts, vault avec docs exemples
- **Reset hebdomadaire** automatique des données pour garder une démo propre

### 16.3 Supports commerciaux
- [ ] Pitch deck 12 slides (PDF + PowerPoint)
- [ ] One-pager A4 par segment (Startups / PME / ETI)
- [ ] Vidéos screencast démos (à enregistrer post-V1)
- [ ] Témoignages clients pilotes (à collecter pendant beta)
- [ ] Comparatif vs concurrents (Factorial, Skello, Combo) — feature matrix
- [ ] ROI calculator (gain heures admin × tarif horaire — vs coût SaaS)
- [ ] Page « Pourquoi Concorde » avec arguments différenciants : RGPD natif, mobile-first, multi-tenant strict, IA contextuelle, cert pinning

### 16.4 Arguments différenciants à valoriser
1. **Sécurité mobile bancaire** : cert pinning + screenshot blocking + auto-lock + bio-token sans password (rare sur le marché RH)
2. **IA contextuelle** : assistant RAG qui répond sur **vos** documents (contrats, conventions, procédures internes) — pas sur des données génériques
3. **Multi-tenant strict** : 1 base SQL par client, isolation forte, hébergement région possible
4. **Mobile-first** : 22 écrans natifs, pas une web-view dégradée
5. **Geofence natif** : pas un add-on payant, inclus dès Standard
6. **Conformité RGPD** : retention dates, soft delete, export, registre, audit log
7. **Internationalisation** : FR/EN + multi-devise + skew horloge 90 min DST-safe

---

## 17. Structure de la page pricing

### 17.1 Architecture de la page (`/pricing`)

```
┌─────────────────────────────────────────────────┐
│  TopNavBar (logo + nav + CTA login/signup)      │
├─────────────────────────────────────────────────┤
│  HERO                                           │
│  H1 « Une tarification simple, transparente »   │
│  Sous-titre + toggle Mensuel / Annuel (-20%)    │
├─────────────────────────────────────────────────┤
│  3 PLAN CARDS côte à côte (mobile : stack)      │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐          │
│  │Essentiel│  │Standard │  │ Premium │          │
│  │ Gratuit │  │  7,50€  │  │ 11,00€  │          │
│  │         │  │ POPULAR │  │         │          │
│  │ - Liste │  │ - Liste │  │ - Liste │          │
│  │ - feat. │  │ - feat. │  │ - feat. │          │
│  │ [CTA]   │  │ [CTA]   │  │ [CTA]   │          │
│  └─────────┘  └─────────┘  └─────────┘          │
├─────────────────────────────────────────────────┤
│  COMPARATIF DÉTAILLÉ (table)                    │
│  Feature × Plan, ✓/✗/quota                      │
├─────────────────────────────────────────────────┤
│  TÉMOIGNAGES (3 logos clients + quotes)         │
├─────────────────────────────────────────────────┤
│  FAQ (4-6 questions, accordion)                 │
├─────────────────────────────────────────────────┤
│  CTA FINAL « Prêt à digitaliser votre RH ? »    │
│  [Démarrer essai gratuit]  [Demander une démo]  │
├─────────────────────────────────────────────────┤
│  FOOTER (legal, RGPD, status, careers)          │
└─────────────────────────────────────────────────┘
```

### 17.2 Conventions UI
- **Format prix** : 2 décimales max, sans padding (`8` reste `8`, pas `8,00` — sauf si nécessaire). Locale `fr-FR` (virgule). Élimine les artefacts float (8.8 × 12 ≠ `105.60000000000001`).
- **Toggle mensuel/annuel** : annuel affiche le prix mensualisé barré + nouveau prix avec mention « -20% » badge
- **Badge POPULAR** : sur Standard, accentué visuellement (border primary, slight scale-up)
- **CTA différenciés** :
  - Essentiel : « Démarrer gratuitement » → `/signup?plan=essentiel`
  - Standard : « Essayer Standard » → `/signup?plan=standard&trial=14`
  - Premium : « Contacter les ventes » → `/contact-sales` (formulaire de qualification, pas de CB)
- **FAQ** : cible objections classiques (changement plan, calcul utilisateur, sécurité, intégrations existantes)
- **Section comparatif** : table dépliable avec ✓ / quota / ✗, pour aider la décision

### 17.3 Composants existants
- [PricingPage.tsx](abrpoint.client/src/components/Pricing/PricingPage.tsx) — page publique
- [PlanConfigurationPage.tsx](abrpoint.client/src/components/Pricing/PlanConfigurationPage.tsx) — page admin de gestion abonnement
- [ContactSalesPage.tsx](abrpoint.client/src/components/Pricing/ContactSalesPage.tsx) — formulaire Premium
- [stripeCheckout.ts](abrpoint.client/src/components/Pricing/stripeCheckout.ts) — intégration Stripe Checkout

---

## 18. Limitations actuelles & optimisations avant lancement

### 18.1 Backend
- [ ] Ajouter Redis (`IDistributedCache`) — nécessaire pour scale horizontal
- [ ] Migrer rapports lourds en queue asynchrone (Hangfire ou worker dédié)
- [x] Index DB ciblés (livré : `presence`, `notification`, `documentvault`, `demconge`, `pushtoken`, `employe`, `demandeautorisation`, `auditlog`)
- [x] Auto-migration de schéma à chaud (`BaseDataSchemaMigrator`) — plus besoin de SQL manuel
- [ ] Métriques Prometheus / OpenTelemetry exposées
- [x] Healthchecks `/healthz` + `/readyz`
- [x] Rate limiting login + signup
- [ ] Audit log automatisé sur DELETE et PUT critiques

### 18.2 Frontend web
- [ ] Code splitting par route (Vite dynamic imports)
- [ ] PWA manifest + service worker pour mode offline limité
- [ ] Tests unitaires composants critiques (Vitest + Testing Library)
- [ ] Lighthouse audit a11y / performance / SEO
- [ ] Vérifier toutes les routes ont `<AccessDenied>` quand permission manquante

### 18.3 Mobile
- [x] Cert pinning prod (G1) — config en place, pins à renseigner à la veille du build
- [x] Screenshot protection (G4)
- [x] Auto-lock après inactivité (G5)
- [x] Bio-token sans password (G2)
- [x] Device trust assessment (G3)
- [x] Refresh token quota (G6)
- [ ] Detox e2e sur golden paths (login, pointage, demande congé)
- [ ] Crash reporting (Sentry / Bugsnag)
- [ ] Mise en cache offline (TanStack Query persist) pour vault et historique présence
- [ ] Build EAS production (Android signed AAB + iOS TestFlight)

### 18.4 Infrastructure
- [x] Backup script SQL + uploads (`backup.sh` / `restore.sh` créés, à brancher en cron)
- [ ] Monitoring nginx (4xx/5xx, latence)
- [ ] Plan de DR documenté
- [ ] Rotation logs Docker (max-size + max-file)
- [x] HSTS preload, headers sécurité complets, CSP

### 18.5 Sécurité
- [ ] Pen-test externe avant V1
- [ ] Audit dépendances `npm audit` + `dotnet list package --vulnerable` en CI
- [ ] WAF (Cloudflare ou ModSecurity)
- [ ] CAPTCHA sur signup et password reset
- [ ] Conformité RGPD complète : page droits utilisateurs + export/effacement données

---

## 19. Synthèse des tests disponibles

### 19.1 Tests stabilité (unitaires + intégration)
**Stack** : xUnit + Moq, fixtures déterministes
**Couverture actuelle** ([ABRPOINT.Server.Tests/](ABRPOINT.Server.Tests/)) :

| Fichier | Couverture |
|---|---|
| `HeureSuppServiceTests.cs` | Calcul h.sup journalier (sections 1-4 + garde-fou) |
| `HeureAbsencesServiceTests.cs` | Calcul absences |
| `EtatPeriodiquCalculationTests.cs` | Agrégation périodique multi-employés |
| `EtatsControllersTests.cs` | Contrôleurs états (smoke) |
| `PointageMoisServiceTests.cs` | Pointage du mois |
| `AbsenceCalculationParameterTests.cs` | Paramétrage des règles d'absence |
| `GenericMethodesTests.cs` | Helpers (parsing horaires, conversions HH:mm) |
| Fixtures | `ParametreFixtures`, `PosteFixtures`, `PresenceDtoFixtures` |

**À ajouter** : tests d'intégration full-stack avec base SQLite ou TestContainers.

### 19.2 Tests sécurité

**Existant** :
- Statique : Semgrep (overrides postcss / fast-uri commentés dans `package.json`)
- Tags `// SEC-XX` ou `// G<N>` dans le code marquent les durcissements appliqués
- Documents : `SECURITY_AUDIT_MODULES.md`, `SECURITY_ISSUES.md`, `SECURITY_PERFORMANCE_AUDIT.md`

**À automatiser** :
- OWASP ZAP DAST sur staging (CI nightly)
- `dotnet list package --vulnerable` en CI
- `npm audit --omit=dev` en CI
- Pen-test externe avant V1 (mandataire qualifié — recommandé qualifs PASSI ou équivalent)

### 19.3 Tests API
- **Manuel** via Swashbuckle (Swagger UI exposé en dev `/swagger`)
- **À automatiser** : suite Postman / Bruno collection à versionner
- **Smoke en CI** : builder + tests + healthcheck `/readyz` après `compose up`

### 19.4 Tests mobile
- **Aucun e2e** automatisé pour l'instant
- **Tests manuels** validés sur Android (Expo Go + builds EAS)
- **À automatiser** : Detox sur Android (golden paths login + pointage + demande congé + signature)
- **Test cert pinning** : rotation manuelle staging à automatiser

### 19.5 Tests performances
- **Cible** : 100 utilisateurs concurrents par tenant, 10 tenants, p95 < 500 ms sur endpoints HOT
- **Outil suggéré** : k6 + Grafana k6 cloud OU Apache Bench
- **Inputs spécifiques** :
  - `POST /Presences/mark-presence` × 6/min/IP (rate-limited — vérifier 429 OK)
  - `GET /Dashboard/kpis` avec filtres période variable
  - `POST /Vault/upload` 10 Mo

### 19.6 Tests multi-utilisateurs
- **À mettre en place** : k6 ou Locust scénarios — login simultané, pointage concurrent, lecture KPIs
- **Vérification thread-safety** : `PointageMoisService` désormais séquentiel pour éviter la contention DbContext (un seul DbContext scoped par requête, EF Core non thread-safe)

### 19.7 Tests géolocalisation et pointage
| Cas | Attendu |
|---|---|
| Aucun geofence configuré, GPS absent | Pointage accepté |
| Geofence configuré, GPS absent | 422 `gps_required` |
| Geofence configuré, GPS dans rayon | Accepté + log info |
| Geofence configuré, GPS hors rayon | 422 `outside_geofence` avec distance |
| Geofence configuré, GPS imprécis (acc > rayon) | Accepté (acc loggée pour audit) — *à durcir si voulu* |
| Skew client +/- 89 min | Accepté |
| Skew client +/- 91 min | 422 `clock_skew` |
| Pointage avant date d'embauche | 422 `before_hire_date` |
| Pointage par employé pour autrui | 403 |
| Pointage 7 fois/min depuis même IP | 429 (rate limit) |

### 19.8 Tests signature électronique
| Cas | Attendu |
|---|---|
| Signature web SignaturePad → upload | Fichier `sig_<uuid>.png` créé, statut signé |
| Signature mobile tactile → upload | Idem |
| Tentative supprimer doc signé (mobile) | Bloqué côté UI + côté backend |
| Lecture audit log signature | Trace user, IP, date |
| Signature de doc inexistant | 404 |
| Re-signature d'un doc déjà signé | Nouvelle version (à valider produit) |
| Tentative screenshot pendant la signature | Capture bloquée Android (FLAG_SECURE), alerte iOS |

---

## 20. Risques techniques

| Risque | Probabilité | Impact | Plan |
|---|---|---|---|
| Indispo SQL Server (instance unique) | Moyenne | Élevé | Backup horaire + restauration testée + plan failover documenté |
| Quota Expo Push dépassé | Faible | Moyen | Monitoring + bascule FCM direct si nécessaire |
| Saturation volume uploads | Moyenne | Élevé | Alerte 80% + rotation/archivage |
| Stripe webhook désynchronisé | Faible | Moyen | Job de réconciliation quotidien |
| Charge IA (OpenRouter) imprévisible | Moyenne | Moyen | Quota par tenant, fallback modèle moins coûteux |
| Faille 0-day .NET / dépendance | Faible-moyenne | Élevé | `dotnet list package --vulnerable` en CI, alerting GitHub Dependabot |
| Cert pinning bloque app si rotation imprévue | Faible | Élevé | Pinning intermédiaires (LE R10/R11) + procédure de rotation documentée |

---

## 21. Roadmap de développement

### Phase 1 — Hardening V1 (T+0 à T+3 semaines)
- [x] Plan gating end-to-end (backend + frontend + mobile) — **livré V2**
- [x] Tarification commerciale verrouillée (Starter/Standard/Premium + Stripe base+seat) — **livré V2**
- [x] Période d'essai 30 j sans CB — **livré V2**
- [x] Job de synchronisation seats Stripe (BackgroundService quotidien) — **livré V2**
- [x] Catalogue nomenclature templates (catégories canoniques imposées) — **livré V2**
- [x] Seed pays/nations automatique au provisioning tenant — **livré V2**
- [x] CSP frame-src blob: pour aperçus PDF — **livré V2**
- [ ] Backups uploads + SQL automatisés (cron production) — *en cours, cf. §24.4*
- [ ] Monitoring Prometheus + alerting basique — *cf. §24.3*
- [ ] Pen-test externe et remédiation
- [ ] Documentation utilisateur (admin & employé)
- [ ] Tests E2E mobile golden paths (Detox)
- [ ] Build EAS production iOS + Android signés
- [ ] Serveur de production Ubuntu 24.04 LTS provisionné + durci (UFW, Fail2Ban, SSH clés, séparation prod/staging) — *commande passée, mise en place §24*

### Phase 2 — Lancement V1 (T+3 à T+5 semaines)
- Pricing public + landing page (page tarifaire alignée avec PlanCatalog)
- Stripe en mode live (price_id de production à renseigner dans `appsettings.json`)
- Onboarding tenant guidé pas-à-pas enrichi
- Centre d'aide / FAQ
- Status page publique
- Métriques business : MRR, churn, activation rate
- Soumission stores (TestFlight élargi puis App Store, Google Play interne puis prod)

### Phase 3 — V1.1 (T+6 à T+10 semaines)
- Redis + scale horizontal backend
- Queue asynchrone rapports (Hangfire)
- Réindexation RAG automatique sur événement upload vault
- Connecteurs paie externes (Sage Paie, Cegid Quadra) — promis sur la grille Premium
- API publique pour intégrateurs partenaires — promise sur la grille Premium
- SSO entreprise (SAML / OIDC) — promis sur la grille Premium
- Moteur de branding personnalisé (rendu CustomBranding effectif au-delà du flag déclaratif)
- Mode offline limité mobile (TanStack Query persist)

### Phase 4 — V2 horizon (T+3 mois et plus)
- Workflow personnalisable (BPMN-light)
- Multi-langue étendu (AR, ES)
- Hébergement régional (FR / BE / MA / SN)
- Failover SQL Server + load balancer multi-AZ (Premium SLA 99,9 %)

---

## 22. Checklist technique pré-production

### Code
- [ ] Aucune branche feature ouverte non mergée
- [ ] Tous les `TODO`/`FIXME` audités, ticketés ou résolus
- [x] `dotnet build` 0 erreur
- [ ] `tsc --noEmit` 0 erreur sur tous les packages
- [ ] `npm audit` & `dotnet list package --vulnerable` propres

### Sécurité
- [ ] Pen-test externe terminé + corrections appliquées
- [x] Headers HSTS, CSP, COOP/CORP, Permissions-Policy configurés
- [x] Cert pinning mobile activé (pins à renseigner avant build prod)
- [x] Bio-token sans password (G2)
- [x] Auto-lock + screenshot blocking (G4/G5)
- [x] Refresh token quota (G6)
- [ ] Tous les secrets via env vars (jamais en clair dans le repo)
- [x] Rate limiting login + signup
- [ ] CAPTCHA signup
- [ ] Politique mots de passe affichée (longueur ≥ 12, complexité)
- [ ] Audit log testé sur actions critiques

### Infra
- [ ] DNS production (A + AAAA) + sous-domaines wildcard tenants
- [x] Certificats SSL Let's Encrypt avec renouvellement auto vérifié
- [ ] Backup SQL automatique (chiffré) testé en restauration
- [ ] Backup volume uploads testé en restauration
- [x] Healthchecks `/healthz` + `/readyz` exposés
- [ ] Monitoring uptime externe (UptimeRobot, Pingdom)
- [ ] Logs centralisés (Loki / ELK / Datadog)
- [ ] Alerting on-call configuré
- [ ] Plan DR documenté et testé

### Données
- [x] Migrations EF appliquées sur master + tous les tenants (auto-migration)
- [ ] Seeding rôles/permissions cohérent
- [ ] RGPD : conditions, politique privacy, CGU publiées
- [ ] Procédure d'export/effacement données utilisateur
- [ ] DPO désigné, registre RGPD à jour

### Performance
- [ ] Test de charge passé (100 users / tenant, p95 < 500 ms)
- [x] Index DB ciblés validés via plan d'exécution
- [ ] CDN configuré devant les assets statiques (optionnel mais recommandé)

### Légal / business
- [ ] Stripe live keys configurées
- [ ] Webhooks Stripe testés avec event replay
- [ ] Tarification finale validée
- [ ] Page de status publique
- [ ] Centre d'aide accessible

### Apps mobiles
- [ ] Build EAS production signé Android (AAB)
- [ ] Build EAS production signé iOS (TestFlight)
- [ ] Métadonnées stores (descriptions, screenshots, classification d'âge)
- [ ] Comptes Apple Developer + Google Play Developer actifs
- [ ] Politique privacy mobile (URL accessible)
- [ ] Privacy Manifest iOS / Data Safety Google complétés

---

## 23. Dépendances et services tiers

### 23.1 Services externes payants
| Service | Usage | Plan estimé V1 |
|---|---|---|
| **Stripe** | Billing abonnements + webhooks | Standard, frais 1.4% + 0.25€ EU |
| **OpenRouter** (Gemini 2.0 Flash) | LLM RAG | Pay-as-you-go ; switch Anthropic Claude possible |
| **Expo Push API** | Notifications mobile | Gratuit (limite ~6000 push/min) |
| **Let's Encrypt** | TLS | Gratuit |
| **SMTP** (à choisir) | Emails transactionnels | SendGrid / Mailgun / Amazon SES |
| **Apple Developer** | Distribution iOS | 99$/an |
| **Google Play Developer** | Distribution Android | 25$ one-shot |

### 23.2 Stack open-source critique
- **.NET 8** (LTS jusqu'à nov 2026)
- **EF Core 8** + **SQL Server 2022**
- **React 19**, **MUI 5/6**, **TanStack Query 5**
- **Expo SDK 54** + **React Native 0.81**
- **Qdrant 1.12** (vector DB)
- **nginx alpine**

### 23.3 Bibliothèques métier sensibles
- `BCrypt.Net-Next 4.0.3` — hashage passwords
- `Otp.NET 1.4.1` — TOTP 2FA
- `Stripe.net 47.x` — billing
- `MailKit 4.7.1` — SMTP
- `Microsoft.SemanticKernel 1.30` — orchestration IA
- `DinkToPdf` (wkhtmltopdf binding) — PDF
- `FastReport.OpenSource` — états réguliers
- `PdfPig` — extraction texte PDFs uploadés
- `DocumentFormat.OpenXml` — Excel paie
- `expo-screen-capture` — protection screenshot mobile
- `expo-local-authentication` — biométrie

---

## 24. Plan de durcissement infrastructure de production

> Section ajoutée en V2 (mai 2026) suite à la commande du serveur de production. Détaille
> l'architecture cible, les étapes de sécurisation et la cadence opérationnelle envisagée.
> Périmètre : préparation du serveur dédié → mise en production → continuité de service.

### 24.1 Spécifications du serveur commandé

| Caractéristique | Valeur retenue | Justification |
|---|---|---|
| **Hébergement** | Serveur dédié, datacenter France | Souveraineté donnée + faible latence FR/BE, conformité RGPD facilitée (CNIL : transferts UE/EEE non assimilés à un transfert hors UE) |
| **OS** | Ubuntu Server 24.04 LTS | LTS jusqu'à avril 2029, support Microsoft .NET 8, Docker officiellement supporté |
| **Stockage** | SSD NVMe | Performance critique pour SQL Server (tempdb + logs) et les rapports synchrones (DinkToPdf, FastReport) |
| **RAM** | 64 Go | SQL Server 2022 réserve typiquement 50 % ; reste partagé entre Kestrel, nginx, Qdrant, sidecar RAG |
| **Architecture** | Scalable (montée verticale + ajout instances horizontales possible) | Compatible avec l'évolution multi-instance prévue (Redis cache distribué dès >2 instances API) |

### 24.2 Architecture cible (3 environnements)

Séparation physique ou logique stricte pour éviter qu'une bétâ casse la prod :

```
┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐
│   PRODUCTION       │  │   STAGING          │  │   TESTS / CI       │
│   *.concorde-...   │  │   staging.*        │  │   ephémère docker  │
│   Stripe live keys │  │   Stripe test keys │  │   data réinitialisée│
│   Données réelles  │  │   Données dump anon│  │   à chaque run     │
│   Backups quotidiens│  │   Backups hebdo   │  │   pas de backup    │
└────────────────────┘  └────────────────────┘  └────────────────────┘
```

- **Production** : trafic clients réels, monitoring strict, déploiement après validation staging
- **Staging** : pré-prod accessible aux équipes commerciales pour démos & onboarding, intégration Stripe en mode test
- **Tests** : éphémère, montée à chaque PR via docker-compose, déchirée après tests

Recommandation forte : la promotion staging → prod doit être manuelle (pas de CI/CD auto sur main) tant que la batterie de tests e2e n'est pas en place.

### 24.3 Étapes de sécurisation (avant exposition publique)

**Phase 0 — Provisioning initial** (J0 à J+1)
1. Installation Ubuntu Server 24.04 LTS (image officielle vérifiée, partition `/var/lib/docker` séparée pour cloisonner)
2. Création utilisateur non-privilégié `concorde-ops` avec `sudo`, désactivation login root
3. Authentification SSH par clé uniquement (`PasswordAuthentication no`, `PermitRootLogin no`, `Port 22` redirigé ou laissé selon politique)
4. `ufw` activé : INPUT default deny ; autorisations `22/tcp` (SSH, idéalement source IP allowlist), `80/tcp`, `443/tcp` uniquement
5. `fail2ban` activé sur `sshd` (jail 24 h après 3 tentatives) — et plus tard sur nginx `bad-bots`
6. `unattended-upgrades` configuré pour appliquer automatiquement les mises à jour sécurité
7. `auditd` activé (logs syscalls sensibles)

**Phase 1 — Stack applicative**
1. Docker Engine + Docker Compose v2 (depuis le repo officiel Docker, pas snap)
2. Volumes Docker dédiés sur le disque NVMe : `sqlserver-data`, `uploads_data`, `letsencrypt_data`
3. Pull des images, application des `appsettings.json` de prod (secrets via variables d'environnement / `.env` non commité)
4. Premier `docker compose up -d` avec healthchecks attendus → confirme readiness avant DNS propagé

**Phase 2 — DNS et TLS**
1. Pointage A/AAAA `concorde-work-force.com` et `*.concorde-work-force.com` vers IP serveur
2. Certbot wildcard via challenge DNS-01 (provider DNS supportant ACME : OVH, Cloudflare, Gandi…) — wildcard impératif pour les sous-domaines tenant
3. Renouvellement automatique cron (déjà géré par le service certbot du compose)
4. HSTS preload après stabilisation 1 semaine (soumission `hstspreload.org` une fois la production réellement stable)

**Phase 3 — Monitoring & alerting**
1. UptimeRobot externe sur `https://concorde-work-force.com/api/healthz` (1 min) + `/readyz` (5 min)
2. Logs Docker centralisés (loki + grafana, ou Datadog, ou self-hosted)
3. Alertes : 5xx > 1 % sur 5 min, latency p95 > 2 s, disque > 80 %, RAM > 85 %, certificats < 14 j d'expiration
4. Slack / email pour les alertes critiques (PagerDuty ou alternative à terme)

### 24.4 Politique de sauvegarde

| Quoi | Quand | Où | Rétention | Test restore |
|---|---|---|---|---|
| **SQL Server master + tenants** | Quotidien 03:00 UTC | Stockage chiffré hors-serveur (S3 EU, OVH Object Storage, ou équivalent FR) | 30 jours rolling + 1 fin de mois × 12 | Mensuel sur staging |
| **Volume `uploads_data`** | Quotidien 03:30 UTC | Idem | 30 jours rolling | Mensuel |
| **Configuration nginx + appsettings + docker-compose** | Versionnés Git + snapshot serveur hebdo | Git + S3 chiffré | Indéfini (Git) | À chaque modification |
| **Volume Qdrant (RAG)** | Hebdomadaire | Idem | 4 semaines | Trimestriel |

Recommandation : **test de restore mensuel obligatoire sur staging** — une sauvegarde non testée est une sauvegarde absente. Procédure documentée : restore master.bak + tenant.bak → relance `docker compose up` staging → vérification login + lecture employés + génération PDF.

**Snapshots VM** (si le provider hébergeur l'offre) : snapshot hebdomadaire complémentaire de la VM, indépendant de la stratégie SQL/uploads. Couvre les cas de corruption Docker / OS qui rendent les backups applicatifs difficiles à exploiter rapidement.

### 24.5 Données sensibles et conformité

- **Coffre numérique** : les documents sont chiffrés au repos via `EncryptionService` (clé tenant rotable). Garantie complétée par chiffrement du volume Docker au niveau OS si LUKS activé sur le disque NVMe.
- **Données de géolocalisation** : traçabilité du `clock-in` GPS journalisée pour audit anti-fraude, rétention 12 mois maximum (par défaut RGPD pour les pointages). À documenter dans le registre RGPD côté client final.
- **Données RH** : DPA (Data Processing Agreement) à signer avec chaque tenant — le tenant est responsable de traitement, Concorde Workforce est sous-traitant au sens RGPD.

### 24.6 Plan de continuité simplifié (V1)

- **RPO cible** : 24 h (sauvegarde quotidienne)
- **RTO cible** : 4 h (restore + redéploiement)
- **Pas de failover automatique en V1** — acceptable pour un démarrage SaaS avec engagement SLA Standard 99 %, mais à durcir pour Premium (réplication SQL + load balancer multi-AZ à terme).

---

## 25. Conclusion

La plateforme est dans un état de **maturité fonctionnelle élevée** : modules métier complets, multi-tenant opérationnel avec auto-migration de schéma, calculs paie couverts par tests, sécurité socle forte (JWT + 2FA + permissions matricielles + multi-tenant scoping) **et durcissements mobiles bancaires** (cert pinning, bio-token, device trust, screenshot blocking, auto-lock, RT quota) — ces deux derniers gatés Premium au runtime.

La **tarification commerciale est désormais verrouillée** (Starter 29,50 € / Standard 59,50 € / Premium 119 €) avec un modèle forfait + overage par salarié, période d'essai 30 jours sans CB, et facturation Stripe à 2 items (base + seat) avec synchronisation automatique de la quantité seats par job de fond quotidien.

Le **plan gating est appliqué de bout en bout** : couche backend (`RequirePlanFeatureAttribute`), couche frontend (`planAllows` dans `useAuth`), couche mobile (hooks de sécurité conditionnés au plan, `/MobileAuth/me` expose `planFeatures`). Un tenant Starter ne peut pas accéder à l'app mobile, ni au coffre, ni à la signature, ni au reporting avancé, ni à l'IA — y compris par appel direct à l'API.

Les **trois axes critiques** avant lancement commercial restent :
1. **Continuité de service** (sauvegardes testées, monitoring, alerting) — plan détaillé §24, mise en œuvre en cours sur le serveur fraîchement commandé
2. **Audit sécurité externe** (pen-test) — sécurité par défaut ≠ sécurité prouvée. À budgétiser avant le premier client Premium réel
3. **Tests de charge** sur le serveur dédié final, confirmant les capacités annoncées

Le code est globalement sain (commentaires explicatifs sur les décisions de sécurité, tests sur les calculs critiques, compilation TypeScript stricte côté frontend, séparation des préoccupations propre, auto-migration robuste).

L'architecture multi-tenant choisie (DB-per-tenant) est adaptée au segment PME/ETI ciblé et offre une isolation forte entre clients. Elle pourra évoluer vers un modèle hybride (DB partagée pour les très petits tenants, DB dédiée pour les comptes Premium) si la croissance le justifie.

La stratégie commerciale tri-marché (France / Belgique / Afrique francophone) est cohérente avec les capacités techniques (multi-devise, skew horloge DST-safe, mobile-first), et la nouvelle structure tarifaire à 3 paliers couvre l'ensemble du spectre TPE / PME / ETI sans laisser de zone de friction (le pack Starter est le sas d'entrée commercial, Premium devient la cible naturelle dès 50+ salariés ou besoin sécurité renforcée).

---

*Document généré à partir de l'inventaire de la base de code à date — 64 contrôleurs API, 131 entités EF, 22 écrans mobile, ~30 modules web. Version 2 du 2026-05-12 : intègre le plan gating commercial complet, la tarification définitive, et le plan de durcissement infrastructure post-commande du serveur de production. Mises à jour à chaque itération significative.*
