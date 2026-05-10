# Dossier Technique — Plateforme SaaS RH / Pointage

**Produit** : Concorde Workforce / ABRPOINT
**Cycle** : Phase de développement → préparation V1 commerciale
**Date de référence** : 2026-05-10
**Stack résumé** : .NET 8 + ASP.NET Core / React 19 + Vite + MUI / Expo 54 + React Native 0.81 / SQL Server 2022 / Docker Compose + nginx-proxy / Qdrant (RAG)

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
- **Backend** : 64 contrôleurs API, 131 entités EF Core, multi-tenant master/tenant opérationnel, RAG branché
- **Web** : ~30 modules métier complets en MUI, i18n FR/EN, animations, dashboard admin/employé/manager différencié
- **Mobile** : 22 écrans (Expo SDK 54), GPS, push, biométrie, signature, vault
- **Infrastructure** : déployable via `docker compose up`, certificats Let's Encrypt automatisés
- **Tests** : couverture unitaire ciblée sur les calculs paie/présence (CalculService) — pas encore d'e2e ni de tests UI automatisés

### 1.3 Cibles V1
- Multi-tenant production-ready avec billing Stripe (présent en code, à éprouver en charge)
- Pointage géolocalisé fiable cross-fuseau
- Coffre-fort + signature en flux complet
- Préparation paie compatible avec exports paie standards
- Hardening sécurité OWASP top 10

---

## 2. Architecture technique

### 2.1 Vue d'ensemble

```
┌─────────────────┐      HTTPS       ┌─────────────────────────────┐
│  Web React PWA  │◄────────────────►│   nginx-proxy (TLS, /api)   │
│  (Vite, MUI)    │                  │   Volume uploads_data RO    │
└─────────────────┘                  │   Let's Encrypt + certbot   │
                                     └──────────────┬──────────────┘
┌─────────────────┐    HTTPS          ┌─────────────▼─────────────┐
│  Mobile Expo    │◄─────────────────►│  abrpoint.server (Kestrel)│
│  (RN 0.81)      │  Bearer JWT       │  ASP.NET Core 8           │
└─────────────────┘                   │  Volume uploads_data RW   │
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
| **Backend API** | .NET 8 · ASP.NET Core · EF Core 8 · Dapper 2.1 · AutoMapper 14 · MailKit · BCrypt · Otp.NET (TOTP) · QRCoder · Stripe.NET 47 · DinkToPdf (wkhtmltopdf) · FastReport.OpenSource · DocumentFormat.OpenXml · PdfPig · Microsoft.SemanticKernel 1.30 |
| **Web** | React 19 · Vite · TypeScript 5 · MUI 5 + x-charts + x-data-grid + x-date-pickers · React Query 5 · React Router · FullCalendar · jsPDF + autotable · ExcelJS · i18next FR/EN · dayjs · date-fns · Recharts · axios |
| **Mobile** | Expo SDK 54 · React Native 0.81 · React Navigation 7 · expo-location · expo-camera · expo-image-picker · expo-document-picker · expo-secure-store · expo-notifications · expo-local-authentication · React Native Paper · Reanimated · Vector Icons |
| **Infrastructure** | Docker Compose · nginx (proxy + TLS + uploads RO) · SQL Server 2022 · Qdrant 1.12 (vector store) · Python sidecar RAG (LangChain + multilingual-e5-large) · certbot |
| **CI/CD** | (manuel actuellement) — Dockerfile.server / Dockerfile.client séparés, image client publiée sur Docker Hub |

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
│  Plans, Subscriptions  │                │  (schéma cloné via       │
│                        │                │   BaseDataSchemaMigrator)│
└────────────────────────┘                └──────────────────────────┘
```

- **Résolution tenant** : `TenantResolverMiddleware` lit le header `X-Tenant-Slug` ou le sous-domaine, hydrate `ICurrentTenant`.
- **DbContext factory dynamique** ([Program.cs:45](ABRPOINT.Server/Program.cs#L45)) : si tenant résolu, connection string générée via `TenantTemplate` ; sinon fallback sur `DefaultConnection` (mode legacy mono-tenant).
- **Quotas** ([TrialPolicy.cs](ABRPOINT.Server/Tenancy/TrialPolicy.cs)) : essai gratuit, plan Essentiel/Standard mono-filiale, Premium illimité. Renvoi HTTP 402 (`plan_limit_*`) en cas de dépassement.
- **Provisioning** : signup → master DB créée automatiquement → tenant DB créée à la demande au 1er signup, schéma migré via `BaseDataSchemaMigrator`.

### 2.5 Modèle de données (haute densité)

131 entités, organisées par grandes familles :

| Famille | Entités principales |
|---|---|
| **RH socle** | `Employe`, `Empaff`, `Empcat`, `Empgrh`, `Empuser`, `Direction`, `Fonction`, `Service`, `Section`, `Qualif`, `Site`, `Societe`, `Ville` |
| **Pointage** | `Presence`, `Pointeuse`, `Dmpoint`, `Dmpresence`, `Lpointjour`, `Lmotifpoint` |
| **Horaires** | `Poste`, `Lposte`, `Lplanhoraire`, `Calendsoc`, `Lcalendsoc`, `Ferier`, `Lferier` |
| **Congés / absences** | `Conge`, `Demconge`, `Congenon`, `Absence`, `Lcategorie`, `Categorie`, `Sanction`, `DemandeAutorisation`, `Autoriser`, `Allaitement`, `Compenser` |
| **Paie** | `Rubrique`, `Echelle`, `Grille`, `Hsalaire`, `Cnss`, `Banque`, `Avance`, `NoteDeFrais`, `Mission`, `Billet` |
| **Gestion droits** | `Roles`, `RolePermission`, `RolePointdroit`, `Module`, `Modusers` |
| **Contrats / docs** | `Contrat`, `Contrat2`, `Lcontrat`, `DocumentVault`, `LetterTemplate` |
| **Tenancy** | `Tenant`, `TenantEmailIndex` (master DB) |
| **Audit / sécu** | `AuditLog`, `RefreshToken` (table dédiée) |
| **Notifications** | `PushToken`, `Notification`, `NotificationCategoryCatalog` |
| **RAG / IA** | `RagDocument`, `RagChunk` (côté .NET), index Qdrant |

Convention de nommage SQL : tables/colonnes en minuscule 3-7 caractères (`emp*`, `con*`, `sit*`, etc.) — héritée du schéma legacy ABRPOINT. Clés composites fréquentes (`Soccod` + clé métier) pour l'isolation tenant intra-DB legacy.

---

## 3. Modules développés

### 3.1 Authentification & sécurité
- **Login web/mobile** : email + mot de passe BCrypt, JWT 8.0
- **2FA TOTP** ([Otp.NET](ABRPOINT.Server/ABRPOINT.Server.csproj)) : QR code via QRCoder lors de l'enrôlement, validation à chaque login si activée
- **Tokens** : access token courte durée + `RefreshToken` long terme stocké en DB chiffré (cf. `EncryptionService`, `SETUP_SECURE_TOKENS.md`)
- **Mobile biométrie** : `expo-local-authentication` pour déverrouillage rapide (Face ID / empreinte)
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
  - `PointageMoisService`
  - `PointageOptimizer` (ajustement automatique entrées/sorties manquantes)
- États : périodique, journalier, retards, assiduité, global

### 3.4 Géolocalisation (récemment ajouté)
- **Schéma** : colonnes `sitlat`, `sitlon`, `sitrad` (rayon m) sur table `site` (migration SQL `AddGeofencingToSite.sql`)
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
- **Pointage du mois** : agrégation présences par employé
- **États** : périodique, retard, présence (PDF via FastReport / DinkToPdf)
- **Export paie** : DocumentFormat.OpenXml (Excel) et PDF
- **Avances**, notes de frais, missions, primes/sanctions
- **Bulletins** : génération via `LetterTemplates` (templates personnalisables HTML/Razor-like)

### 3.7 Coffre-fort numérique ([VaultController](ABRPOINT.Server/Controllers/VaultController.cs))
- Upload via FormData multipart (mobile + web)
- **Whitelist extensions** ([FileHelper.cs](ABRPOINT.Server/Helpers/FileHelper.cs)) : pdf, doc/docx, xls/xlsx, csv, png/jpg, etc. — bloque les exécutables et SVG/HTML scriptables
- **Plafond 10 Mo** par fichier (override via env `Uploads__MaxSizeMb`)
- **Path traversal** : noms régénérés en GUID, jamais du nom client
- Notification employé à chaque dépôt admin
- Vue admin/manager scopée au service
- Téléchargement direct via nginx (volume `uploads_data` RO) — performant, sans hop backend
- Mobile : œil/téléchargement délègue à `Linking.openURL` (Safari/Chrome système)

### 3.8 Signature électronique
- **Web** : SignaturePad + base64 → backend via `SaveBase64Image`, fichier `sig_*.png` dans uploads
- **Mobile** ([SignatureScreen.tsx](abrpoint.mobile/src/screens/SignatureScreen.tsx)) : capture tactile, upload, statut signé verrouille la suppression
- Métadonnées : signataire, date, IP — visibles dans l'audit log

### 3.9 Notifications
- **Push mobile** ([ExpoPushService.cs](ABRPOINT.Server/Services/ExpoPushService.cs)) : Expo Push API, tokens stockés en `PushToken`
- **Email** : MailKit + SMTP, templates HTML
- **In-app** : centre de notifications web + mobile, badge unread
- **Catalogue** ([NotificationCategoryCatalog.cs](ABRPOINT.Server/Authorization/NotificationCategoryCatalog.cs)) : catégories opt-in/opt-out par employé
- **Quiet hours** ([QuietHoursResolver.cs](ABRPOINT.Server/Services/QuietHoursResolver.cs)) : blocage des notifications hors plage horaire configurée
- **Rappels ponctualité** ([PunctualityReminderHostedService.cs](ABRPOINT.Server/Services/PunctualityReminderHostedService.cs)) : hosted service qui balaie périodiquement et notifie

### 3.10 Reporting
- **PDF** : DinkToPdf (HTML→PDF via wkhtmltopdf), FastReport pour les états réguliers
- **Excel** : DocumentFormat.OpenXml (backend) + ExcelJS (web export client)
- **Rapports disponibles** : état périodique, retards, présence, congés, autorisations, sanctions, paie, RTT, contrat
- **Dashboard analytics** (admin/manager) : KPIs présence/absence/ponctualité/h.supp, courbes Recharts, animations count-up

### 3.11 Dashboard
- **3 vues** : `EmployeeDashboard` (self), `ManagerDashboard` (équipe), `DashboardModernAdmin` (global)
- **Personnalisable** : widgets affichables/masquables, persistance localStorage par soccod
- **Filtres période** : aujourd'hui / semaine / mois — toutes les métriques scopées
- **Animations** : `useCountUp` (RAF + easeOutCubic) sur les KPIs et chiffres bento
- **PDF export** : snapshot dashboard

### 3.12 Modules transverses
- **RAG** ([RagController](ABRPOINT.Server/Controllers/RagController.cs), [ChatRagController](ABRPOINT.Server/Controllers/ChatRagController.cs)) : indexation documents vault, recherche sémantique via Qdrant + LangChain, LLM via OpenRouter (Gemini 2.0 Flash par défaut, switchable Anthropic Claude)
- **Document Scan** ([DocumentScanController](ABRPOINT.Server/Controllers/DocumentScanController.cs)) : OCR/extraction structurée des justificatifs
- **Stripe billing** ([BillingController](ABRPOINT.Server/Controllers/BillingController.cs), [StripeWebhookController](ABRPOINT.Server/Controllers/StripeWebhookController.cs)) : abonnements, webhooks
- **Support / Contact** ([ContactController](ABRPOINT.Server/Controllers/ContactController.cs))
- **Tenant Pilot** ([TenantPilotController](ABRPOINT.Server/Controllers/TenantPilotController.cs)) : opérations master sur les tenants

---

## 4. Workflows techniques

### 4.1 Workflow employé (mobile, golden path)
```
Login email/pwd ──► (2FA TOTP si activé) ──► JWT + refresh
        │
        ▼
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
   ├─ Vault ──► Upload bulk pour employés
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

### 4.4 Workflow signup tenant
```
Landing /signup ──► [SignupController]
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

## 5. Structure du code

### 5.1 Backend (`ABRPOINT.Server/`)
```
Controllers/         64 contrôleurs REST
Models/              131 entités EF + Code-first
Repository/          Repos par agrégat (CRUD + queries spécialisées)
Interfaces/          Contrats des repos / services
Services/            EmailService, ExpoPushService, EncryptionService,
                     GeoZoneValidator, PunctualityReminderHostedService,
                     QuietHoursResolver, AiService, Rag/, etc.
CalculService/       Logique métier pure paie/présence (testable)
  ├ HeureSupp/       (CalculateHeureSupp, optimisé, hebdomadaire)
  ├ HeureAbsences/
  ├ CalcTotHeures/
  └ DashboardService/
Authorization/       PermissionCatalog, RequirePermissionAttribute,
                     ValidateSoccodAttribute, SystemRoleSeeder
Tenancy/             Master/Tenant DI, TenantResolverMiddleware,
                     TrialPolicy (quotas)
Migrations/          EF migrations + scripts SQL (.sql) explicites
Helpers/             FileHelper (whitelist, sandboxing uploads),
                     GenericMethodes, SequentialCodeGenerator
Annotations/         Attributs custom métier (CanGetEtatPeriodique, etc.)
Dtaos/               DTO pour transit API
Mappings/            Profils AutoMapper
Billing/             Logique Stripe + plan limits
Provisioning/        Bootstrap signup + seeding
Data/                ApplicationDbContext + MasterDbContext
```

### 5.2 Frontend web (`abrpoint.client/`)
```
src/
├ components/
│  ├ Dashboard/            Admin / Employee / Manager + bento, charts
│  ├ Login/ Signup/        Auth flows + 2FA QR enrollment
│  ├ Navbar/ Drawer/       Shell + i18n switcher
│  ├ DonneeDeBase/         Filiales, Villes, Qualifs, Fonctions, …
│  ├ ClasseHoraire/        Postes, Repos, Calendriers, Fériés
│  ├ gestionEmploye/       EmployeModern (Odoo-style), Contrats,
│  │                       SoldeConge, GestionSanctions, Allaitement,
│  │                       DemandeAutorisation, jourCompensation/AutSortie,
│  │                       Cet, NoteDeFrais, Mission
│  ├ Pointeuse/            EtatPeriodique, EtatJournalier
│  ├ PreparationPaie/      Rubrique, PointageDuMois, Echelles, Hsalaire
│  ├ Etats/                Présence, Retard, Anomalies, Global
│  ├ ParamSoc/             Société, plan, paie, sanctions
│  ├ Profil/               2FA, prefs notifications
│  ├ Pricing/              Plans Stripe
│  ├ Rag/                  Chatbot RAG
│  └ Support/              Centre d'aide
├ hooks/                   ~150 hooks React Query par agrégat
├ services/                Adaptateurs Axios + ReportService
├ models/                  Types TS miroirs des DTO
├ helper/                  AuthProvider, contexts, i18n setup,
│                          animations (Stagger, Skeleton, ActionButton)
└ locales/{fr,en}/         translation.json (~3500 clés)
```

### 5.3 Mobile (`abrpoint.mobile/`)
```
src/
├ screens/
│  ├ LoginScreen, HomeScreen
│  ├ DigitalVaultScreen (upload, view, sign, delete)
│  ├ SignatureScreen
│  ├ LeaveRequestScreen, DemandeAutorisationScreen, BalanceScreen
│  ├ HolidaysScreen, ScheduleScreen, MissionsScreen, ExpenseScreen
│  ├ PresenceHistoryScreen, NotificationsScreen, NotificationPreferencesScreen
│  ├ ProfileScreen, AuthorizationScreen, ChatRagScreen
│  └ manager/             Sous-écrans manager (dashboard équipe)
├ services/
│  ├ api.ts                Axios client + tous les endpoints (markPresence, vault, …)
│  ├ geolocation.ts        Wrapper expo-location avec timeout
│  └ pushNotifications.ts  Enrôlement Expo Push + permissions
├ contexts/                AuthContext (JWT + biométrie)
├ config/env.ts            API_BASE_URL, COLORS, THEME
├ assets/                  Concorde.png, icon.png, adaptive-foreground.png
└ scripts/generate-padded-icon.js
```

---

## 6. APIs et architecture des services

### 6.1 Conventions REST
- Préfixe `/api`
- Routes : `/api/<Resource>` + `/{soccod}/...` quand soccod fait partie du chemin
- Verbes : GET (read), POST (create), PUT (update), DELETE
- **Headers requis** : `Authorization: Bearer <jwt>`, `X-Tenant-Slug` (sauf endpoints publics : signup, /healthz, /api/uploads)
- **Statuts métier custom** :
  - `402` — quota plan dépassé (avec `code: plan_limit_*`)
  - `422` — règle métier violée (codes : `gps_required`, `outside_geofence`, `clock_skew`, `before_hire_date`, `after_termination_date`)
  - `403` — permission refusée (`PermissionCatalog`)

### 6.2 Services horizontaux
| Service | Rôle |
|---|---|
| `EncryptionService` | Chiffrement symétrique des refresh tokens et données sensibles |
| `EmailService` + `EmailTemplates` | Envoi MailKit avec templates HTML |
| `ExpoPushService` | Push mobile via Expo Push API (batchs, retries, expiry token cleanup) |
| `GeoZoneValidator` | Validation Haversine geofence (DB + config) |
| `PunctualityReminderHostedService` | Background service rappels ponctualité |
| `QuietHoursResolver` | Filtre notifications hors plage |
| `AiService` + `Rag/` | Indexation, search sémantique, génération |
| `BaseDataSchemaMigrator` | Provisionnement schéma tenant à la volée |
| `MobileTablesInstaller` | Migrations mobile-spécifiques (push tokens, etc.) |

### 6.3 Validateurs et middlewares
- `[ValidateSoccod]` ([ValidateSoccodAttribute.cs](ABRPOINT.Server/Authorization/ValidateSoccodAttribute.cs)) — empêche un user de la société A de lire/écrire celles de B
- `[CanGetEtatPeriodique]`, `[CanAddEtatPeriodique]`, etc. — basés sur `RolePermission`
- `[EnableRateLimiting("clock-in")]` — ~6 pointages/min/IP
- `TenantResolverMiddleware` — injecte le tenant courant dans le scope
- Middleware sécurité : headers `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`, `Permissions-Policy: geolocation=(self), camera=(self)`

---

## 7. Gestion des rôles et permissions

### 7.1 Modèle
- **Role** : entité avec `RoleName` (e.g. `Administrator`, `Manager`, `ResponsableRH`, `Employe`, `Comptable`)
- **RolePermission** : matrice rôle × module avec drapeaux `RpConsult`, `RpAdd`, `RpModify`, `RpDelete`
- **Modules** : ~30 modules métier (Pointage, Préparation Paie, Données de Base, Gestion des Congés, Coffre-fort, Notifications, Paramètres, etc.)
- **`Utiadm` = '1'** : super-admin tenant, bypass total

### 7.2 Application
```csharp
[CanGetEtatPeriodique]                  // attribut -> lookup matrix RolePermission
public async Task<IActionResult> Get(...)

// Côté service :
PermissionCatalog.IsAdminRole(user.Utirole) // bypass
```

### 7.3 Garde-fous métier
- `CallerOwnsOrManagesEmpAsync` : empêche un employé de pointer/consulter pour un collègue
- Manager scopé à son service via `Empgrh` / `Empaff`
- Cache permissions par utilisateur (`IMemoryCache`) pour éviter le hot-path DB sur chaque request

---

## 8. Sécurité et authentification

### 8.1 Surface protégée
| Vecteur | Mitigation |
|---|---|
| **OWASP A01 — Broken Access Control** | `[Authorize]` + `[ValidateSoccod]` + permissions par module + caller-owns checks |
| **A02 — Cryptographic Failures** | BCrypt (hashs mots de passe), refresh tokens chiffrés AES, TLS 1.2/1.3 only (`ssl_protocols` nginx) |
| **A03 — Injection** | EF Core paramétré ; pas de SQL concat utilisateur |
| **A04 — Insecure Design** | Garde-fous métier explicites (skew clock, hire/termination dates, GPS requis si geofence) |
| **A05 — Security Misconfig** | Server header masqué (`AddServerHeader = false`), erreurs masquées en prod (`MaskedError`), env-driven secrets |
| **A07 — Identification & Auth Failures** | 2FA TOTP, refresh rotatif, rate-limit `clock-in` (6/min/IP) |
| **A08 — Software & Data Integrity** | Whitelist d'extensions uploads (anti-RCE, anti-XSS via SVG/HTML) |
| **A09 — Logging & Monitoring** | Logging structuré (`ILogger<>`), `AuditLog` table pour actions critiques |
| **A10 — SSRF** | RAG sidecar isolé sur réseau interne uniquement |
| **Path traversal** | UUID file naming, parent dir constant |
| **Mass assignment** | DTOs explicites, `[Bind]` ou récupération entité serveur avant patch |
| **CORS** | Whitelisté par environnement |
| **CSRF** | Stateless JWT (Bearer header, pas cookie session) → non applicable |
| **Supply chain** | overrides `package.json` mobile pour postcss / fast-uri (Semgrep) |

### 8.2 Documents existants
- `SECURITY_AUDIT_MODULES.md` — audit module-par-module
- `SECURITY_ISSUES.md` — backlog
- `SECURITY_PERFORMANCE_AUDIT.md`
- `SECURE_TOKEN_NEXT_STEPS.md` + `SETUP_SECURE_TOKENS.md`
- Tags `// SEC-XX` ou `// S<N>` dans le code marquent les durcissements appliqués

---

## 9. Performances et scalabilité

### 9.1 Techniques en place
- **EF Core** : `AsNoTracking()` sur tous les reads ; queries `.Select(...)` projetées ; pas de N+1 connus dans les écrans HOT
- **Pagination** systématique (rate-limit & UX)
- **Cache permissions** : `IMemoryCache` ttl ~minute (RequirePermissionAttribute)
- **Static uploads** : servis directement par nginx (alias `/app/uploads/`), bypass backend → CDN-friendly
- **Tenant DB pooling désactivé** : conscient du trade-off (connexion dynamique par tenant), acceptable < 100 tenants
- **Charts mobile** : virtualisation FlatList sur listes longues (vault, notifications)
- **Filter dataflow web** : `useMemo` partout, key-based memoization avec `data + searchQuery + ...`

### 9.2 Limites identifiées
- **Pas de Redis** : sessions JWT stateless OK, mais cache distribué absent (multi-instance backend nécessitera Redis)
- **DbContext non-pooled** côté tenant : ~5-10ms overhead par requête vs DbContextPool
- **Reports synchrones** (DinkToPdf via `SynchronizedConverter` singleton) : génération PDF bloquante, à passer en queue async pour rapports massifs
- **EvolutionChart** : 30 points sans virtualisation, OK pour ≤ 30j, à paginer côté API si > 90j

---

## 10. État actuel — Finalisé vs en cours

### 10.1 Modules finalisés
| Module | Statut |
|---|---|
| Auth login + 2FA | ✅ Complet, testé |
| Multi-tenant master/tenant | ✅ Provisioning fonctionnel |
| Pointage manuel + mobile | ✅ Complet |
| Géolocalisation pointage | ✅ Schéma + service + UI admin (livré dans cette itération) |
| Calculs présence/retard/h.supp | ✅ Couvert par tests unitaires |
| Congés (demandes, titres, RTT, CET) | ✅ Workflow complet, filtres unifiés |
| Autorisations de sortie + demandes | ✅ Complet, filtres unifiés (livré dans cette itération) |
| Coffre-fort | ✅ Web + mobile (œil/download câblé dans cette itération) |
| Signature électronique | ✅ Web + mobile |
| Notifications push + email + in-app | ✅ Avec quiet hours et catalogue |
| Dashboard admin/manager/employee | ✅ Avec animations count-up |
| Reporting PDF/Excel | ✅ Suite complète |
| Préparation paie | ✅ Rubriques (avec import Excel), pointage mois, exports |
| Stripe billing | ✅ Webhooks + plan limits 402 |
| RAG / chatbot IA | ✅ Indexation vault + chat contextuel |

### 10.2 En cours / à consolider
| Module | Détail |
|---|---|
| Geofence — pédagogie utilisateur | UI ok, mais doc utilisateur (« comment configurer un site ») à rédiger |
| Notifications — A/B test catégories | Catalogue présent, métriques d'opt-in à instrumenter |
| RAG — fraîcheur index | Pas de réindexation incrémentale automatique sur upload vault — TODO scheduler |
| Mobile — déconnexion biométrie expirée | Edge case Face ID après changement de visage |
| Onboarding tenant — guidage premier login | `OnboardingGuide.tsx` existe, à enrichir |

### 10.3 Bugs corrigés récemment
| Bug | Correctif |
|---|---|
| H.Sup illogiques (6h04 pour 3h17 travaillées) | Sections 2 + 4 de `HeureSuppService` recadrées sur l'arrivée réelle ; garde-fou final `H.Sup ≤ Tothre` |
| Division entière `nbHeurSupp / 60` | Cast en `(double)` dans la version non optimisée |
| Snackbar « ajouté » sur erreur (AutSortie) | `onError` dédié au lieu d'appeler `onSuccess()` |
| Erreurs silencieuses sur ajout (TitreConge, DemandeAutorisation) | Callbacks `onError` avec message serveur explicite |
| Œil vault mobile inactif | `Linking.openURL` câblé sur le bouton et la carte |
| Skew d'horloge cross-fuseau | Tolérance bumpée 10 → 90 min |
| Icône d'app mobile énorme | Image paddée à 22% (script jimp) |
| KPI statiques | Hook `useCountUp` + `AnimatedNumber` |

---

## 11. Limitations techniques actuelles

| # | Limitation | Impact | Mitigation prévue |
|---|---|---|---|
| 1 | DbContext non-pooled (multi-tenant) | Overhead ~5-10ms/req | Acceptable < 100 tenants ; passer à `IDbContextFactory<>` poolé par tenant si > 200 |
| 2 | Génération PDF synchrone | Blocage thread sur gros rapports | Queue Hangfire/Quartz pour rapports massifs |
| 3 | Cache distribué absent | Multi-instance backend = sticky sessions ou Redis | Ajouter Redis pour `IDistributedCache` avant scaling horizontal |
| 4 | Skew horloge basé local time | Pas de TZ-awareness propre | TODO : envoyer UTC depuis client, comparer UtcNow |
| 5 | Pas d'e2e automatisé | Régression UI possible | Playwright/Detox à mettre en place |
| 6 | RAG indexation manuelle | Documents vault récents pas dans le LLM | Scheduler auto sur événement upload |
| 7 | Single-region SQL Server | Latence tenants outre-mer | Read replicas régionales si demand|
| 8 | Pas de monitoring APM | Diagnostic prod manuel | OpenTelemetry + Grafana / Application Insights |
| 9 | Volume `uploads_data` non sauvegardé automatiquement | Risque perte fichiers (incident 90c80f62-… déjà observé) | Backup périodique du volume |
| 10 | Tokens push expirés non purgés en push event | Quota Expo wasted | Cleanup au retour 410 ou batch quotidien |

---

## 12. Optimisations restantes avant lancement

### Backend
- [ ] Ajouter Redis (`IDistributedCache`) — nécessaire pour scale horizontal
- [ ] Migrer rapports lourds en queue asynchrone (Hangfire ou worker dédié)
- [ ] Index DB ciblés : `presence(soccod, predat)`, `notification(uticod, isread)`, `documentvault(soccod, empcod, docdate)`
- [ ] Migration EF formelle pour les `.sql` ad-hoc (`ADD_RGPD_COLUMNS.sql`, `AddGeofencingToSite.sql`, etc.)
- [ ] Métriques Prometheus / OpenTelemetry exposées
- [ ] Healthchecks `/healthz` + `/readyz` enrichis (DB, Stripe, Qdrant, RAG)
- [ ] Rate limiting plus large (login, signup, password reset)
- [ ] Audit log automatisé sur DELETE et PUT critiques

### Frontend web
- [ ] Code splitting par route (Vite dynamic imports) — bundle actuel non analysé
- [ ] PWA manifest + service worker pour mode offline limité
- [ ] Tests unitaires composants critiques (Vitest + Testing Library)
- [ ] Lighthouse audit a11y / performance / SEO
- [ ] Vérifier toutes les routes ont `<AccessDenied>` quand permission manquante

### Mobile
- [ ] Detox e2e sur golden paths (login, pointage, demande congé)
- [ ] Crash reporting (Sentry / Bugsnag)
- [ ] Migration vers expo SDK 55 quand stable
- [ ] Mise en cache offline (TanStack Query persist) pour vault et historique présence
- [ ] Build EAS production (Android signed AAB + iOS TestFlight)

### Infrastructure
- [ ] Sauvegarde quotidienne SQL + uploads_data sur S3-compatible
- [ ] Monitoring nginx (4xx/5xx, latence)
- [ ] Plan de DR documenté
- [ ] Rotation logs Docker (max-size + max-file)
- [ ] HSTS preload, `X-Robots-Tag` selon page

### Sécurité
- [ ] Pen-test externe avant V1
- [ ] Audit dépendances `npm audit` + `dotnet list package --vulnerable` en CI
- [ ] WAF (Cloudflare ou ModSecurity)
- [ ] CAPTCHA sur signup et password reset
- [ ] Conformité RGPD : page droits utilisateurs + export/effacement données

---

## 13. Tests et validations

### 13.1 Tests unitaires existants ([ABRPOINT.Server.Tests/](ABRPOINT.Server.Tests/))
| Fichier | Couverture |
|---|---|
| `HeureSuppServiceTests.cs` | Calcul h.sup journalier (sections 1-4 + garde-fou) |
| `HeureAbsencesServiceTests.cs` | Calcul absences |
| `EtatPeriodiquCalculationTests.cs` | Agrégation périodique multi-employés |
| `EtatsControllersTests.cs` | Contrôleurs états (smoke) |
| `PointageMoisServiceTests.cs` | Pointage du mois |
| `AbsenceCalculationParameterTests.cs` | Paramétrage des règles d'absence |
| `GenericMethodesTests.cs` | Helpers (parsing horaires, conversions HH:mm) |
| Fixtures : `ParametreFixtures`, `PosteFixtures`, `PresenceDtoFixtures` | Données déterministes pour les calculs |

Stack tests : xUnit + Moq (implicite via DI). Détails dans [SETUP_TESTS.md](SETUP_TESTS.md).

### 13.2 Tests API
- **Manuel** via Swashbuckle (Swagger UI exposé en dev `/swagger`)
- **À automatiser** : suite Postman / Bruno collection à versionner
- **Smoke en CI** : builder + tests + healthcheck container après `compose up`

### 13.3 Tests sécurité
- **Statique** : Semgrep (overrides postcss / fast-uri commentés dans `package.json`)
- **À ajouter** : OWASP ZAP DAST sur staging, `dotnet list package --vulnerable`, `npm audit --omit=dev` en CI

### 13.4 Tests mobile
- **Aucun e2e** automatisé pour l'instant
- **Tests manuels** : scénarios clés validés sur Android (Expo Go + builds EAS)
- **À automatiser** : Detox sur Android (golden paths)

### 13.5 Tests multi-utilisateurs
- **À mettre en place** : k6 ou Locust scénarios — login simultané, pointage concurrent, lecture KPIs

### 13.6 Tests performances
- **Cible suggérée** : 100 utilisateurs concurrents par tenant, 10 tenants, p95 < 500 ms sur endpoints HOT (pointage, dashboard)
- **Outil** : k6 + Grafana k6 cloud OU Apache Bench sur endpoints simples
- **Inputs spécifiques** :
  - `POST /Presences/mark-presence` × 6/min (rate-limited — vérifier 429 OK)
  - `GET /Dashboard/kpis` avec filtres période variable
  - `POST /Vault/upload` 10 Mo

### 13.7 Tests géolocalisation et pointage
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

### 13.8 Tests signature électronique
| Cas | Attendu |
|---|---|
| Signature web SignaturePad → upload | Fichier `sig_<uuid>.png` créé, statut signé |
| Signature mobile tactile → upload | Idem |
| Tentative supprimer doc signé (mobile) | Bloqué côté UI + côté backend |
| Lecture audit log signature | Trace user, IP, date |
| Signature de doc inexistant | 404 |
| Re-signature d'un doc déjà signé | À définir : refus ou nouvelle version (currently : nouvelle version) |

---

## 14. Bugs connus et risques techniques

### 14.1 Bugs ouverts
| ID | Description | Sévérité | Statut |
|---|---|---|---|
| B-001 | Volume `uploads_data` non sauvegardé → fichiers perdus si volume Docker recréé (incident `90c80f62-…` observé) | Élevée | Documenté ; backup à automatiser |
| B-002 | Indexation RAG manuelle uniquement | Moyenne | Scheduler à ajouter |
| B-003 | Push tokens expirés (410) non purgés | Faible | Cleanup batch à ajouter |
| B-004 | Pas de purge automatique des fichiers orphelins (DB-only) | Faible | Endpoint admin de cleanup à créer |

### 14.2 Risques techniques
| Risque | Probabilité | Impact | Plan |
|---|---|---|---|
| Indispo SQL Server (instance unique) | Moyenne | Élevé | Backup horaire + restauration testée + plan failover documenté |
| Quota Expo Push dépassé | Faible | Moyen | Monitoring + bascule FCM direct si nécessaire |
| Saturation volume uploads | Moyenne | Élevé | Alerte 80% + rotation/archivage |
| Stripe webhook désynchronisé | Faible | Moyen | Job de réconciliation quotidien |
| Charge IA (OpenRouter) imprévisible | Moyenne | Moyen | Quota par tenant, fallback modèle moins coûteux |
| Faille 0-day .NET / dépendance | Faible-moyenne | Élevé | `dotnet list package --vulnerable` en CI, alerting GitHub Dependabot |

---

## 15. Roadmap de développement (proposée)

### Phase 1 — Hardening V1 (T+0 à T+3 semaines)
- Backups uploads + SQL automatisés
- Migration `.sql` ad-hoc → migrations EF formelles
- Index DB ciblés
- Monitoring Prometheus + alerting basique
- Pen-test externe et remédiation
- Documentation utilisateur (admin & employé)
- Tests E2E mobile golden paths

### Phase 2 — Lancement V1 (T+3 à T+5 semaines)
- Pricing public + landing page
- Stripe en mode live
- Onboarding tenant guidé pas-à-pas
- Centre d'aide / FAQ
- Status page publique (statuspage.io ou self-hosted)
- Métriques business : MRR, churn, activation rate

### Phase 3 — V1.1 (T+6 à T+10 semaines)
- Redis + scale horizontal backend
- Queue asynchrone rapports (Hangfire)
- Réindexation RAG automatique
- App mobile sur stores (iOS App Store + Google Play)
- Connecteurs paie externes (Sage, Cegid — selon demande)

### Phase 4 — V2 horizon (T+3 mois et plus)
- API publique pour intégrateurs
- Workflow personnalisable (BPMN-light)
- SSO entreprise (SAML / OIDC)
- Multi-langue étendu (AR, ES)
- Support iOS natif des dernières versions

---

## 16. Checklist technique pré-production

### Code
- [ ] Aucune branche feature ouverte non mergée
- [ ] Tous les `TODO`/`FIXME` audités, ticketés ou résolus
- [ ] `dotnet build` & `tsc --noEmit` 0 warning critique
- [ ] `npm audit` & `dotnet list package --vulnerable` propres

### Sécurité
- [ ] Pen-test externe terminé + corrections appliquées
- [ ] Headers HSTS, CSP, COOP/COEP configurés
- [ ] Tous les secrets via env vars (jamais en clair dans le repo)
- [ ] Rate limiting login + signup + password reset
- [ ] CAPTCHA signup
- [ ] Politique mots de passe affichée (longueur ≥ 12, complexité)
- [ ] Audit log testé sur actions critiques

### Infra
- [ ] DNS production (A + AAAA) + sous-domaines wildcard tenants
- [ ] Certificats SSL Let's Encrypt avec renouvellement auto vérifié
- [ ] Backup SQL automatique (chiffré) testé en restauration
- [ ] Backup volume uploads testé en restauration
- [ ] Monitoring uptime externe (UptimeRobot, Pingdom)
- [ ] Logs centralisés (Loki / ELK / Datadog)
- [ ] Alerting on-call configuré
- [ ] Plan DR documenté et testé

### Données
- [ ] Migrations EF appliquées sur master + tous les tenants
- [ ] Seeding rôles/permissions cohérent
- [ ] RGPD : conditions, politique privacy, CGU publiées
- [ ] Procédure d'export/effacement données utilisateur
- [ ] DPO désigné, registre RGPD à jour

### Performance
- [ ] Test de charge passé (100 users / tenant, p95 < 500 ms)
- [ ] Index DB validés via plan d'exécution
- [ ] CDN configuré devant les assets statiques (optionnel mais recommandé)

### Légal / business
- [ ] Stripe live keys configurées
- [ ] Webhooks Stripe testés avec event replay
- [ ] Tarification finale validée
- [ ] Page de status publique
- [ ] Centre d'aide accessible

### Apps mobiles
- [ ] Build EAS production signé Android
- [ ] Build EAS production signé iOS (TestFlight)
- [ ] Métadonnées stores (descriptions, screenshots, classification d'âge)
- [ ] Comptes Apple Developer + Google Play Developer
- [ ] Politique privacy mobile (URL accessible)

---

## 17. Dépendances et services tiers

### 17.1 Services externes payants
| Service | Usage | Plan estimé V1 |
|---|---|---|
| **Stripe** | Billing abonnements + webhooks | Standard, frais 1.4% + 0.25€ EU |
| **OpenRouter** (Gemini 2.0 Flash) | LLM RAG | Pay-as-you-go ; switch Anthropic Claude possible (`Rag__Anthropic__UseOpenRouter=false`) |
| **Expo Push API** | Notifications mobile | Gratuit (limite ~6000 push/min) |
| **Let's Encrypt** | TLS | Gratuit |
| **SMTP** (à choisir) | Emails transactionnels | SendGrid / Mailgun / Amazon SES |

### 17.2 Stack open-source critique
- **.NET 8** (LTS jusqu'à nov 2026)
- **EF Core 8** + **SQL Server 2022**
- **React 19**, **MUI 5/6**, **TanStack Query 5**
- **Expo SDK 54** + **React Native 0.81**
- **Qdrant 1.12** (vector DB)
- **nginx alpine**

### 17.3 Bibliothèques métier sensibles
- `BCrypt.Net-Next 4.0.3` — hashage passwords
- `Otp.NET 1.4.1` — TOTP 2FA
- `Stripe.net 47.x` — billing
- `MailKit 4.7.1` — SMTP
- `Microsoft.SemanticKernel 1.30` — orchestration IA
- `DinkToPdf` (wkhtmltopdf binding) — PDF
- `FastReport.OpenSource` — états réguliers
- `PdfPig` — extraction texte PDFs uploadés
- `DocumentFormat.OpenXml` — Excel paie

---

## 18. Recommandations techniques pour la V1 commerciale

### Priorité 0 (bloquant lancement)
1. **Backups automatisés et testés** — uploads + SQL master + SQL tenants. Sans ça, un incident perte de volume comme `90c80f62-…` peut compromettre le service entier.
2. **Pen-test externe** suivi de remédiation, *avant* d'ouvrir au public.
3. **Monitoring & alerting** : indispo détectée < 2 min ; sans ça, on découvre les pannes via les clients.
4. **Stripe en mode live** + tests bout-en-bout (signup payant → upgrade → cancel → réactivation).
5. **Politique de mots de passe** & CAPTCHA signup pour limiter le bot abuse.

### Priorité 1 (recommandé dans les 30 jours suivant)
6. **Index DB ciblés** : présence (`soccod`, `predat`), notification (`uticod`, `isread`), vault (`soccod`, `empcod`, `docdate`)
7. **Migrations EF** unifiées (remplacer les scripts `.sql` parallèles)
8. **E2E mobile** Detox sur 5 golden paths
9. **Apps stores** : Google Play + App Store (ou TestFlight élargi)
10. **Centre d'aide** + status page

### Priorité 2 (V1.1)
11. **Redis** pour cache distribué (préalable au scale horizontal)
12. **Queue async** rapports lourds (Hangfire)
13. **Réindexation RAG** automatique sur événement vault
14. **Conformité RGPD** complète : export & effacement utilisateur, DPO, registre

### Priorité 3 (différée)
15. **Multi-région SQL** (read replicas)
16. **API publique** pour intégrateurs partenaires
17. **SSO entreprise** SAML/OIDC
18. **Connecteurs paie** Sage / Cegid

---

## 19. Conclusion technique

La plateforme est dans un état de **maturité fonctionnelle élevée** : les modules métier sont complets, le multi-tenant est opérationnel, les calculs paie sont couverts par tests, la sécurité socle est en place (JWT + 2FA + permissions matricielles + multi-tenant scoping).

Les **trois axes critiques** avant lancement commercial sont :
1. **Continuité de service** (backups, monitoring, alerting) — non négociable
2. **Audit sécurité externe** (pen-test) — sécurité par défaut ≠ sécurité prouvée
3. **Tests de charge** confirmant les capacités annoncées

Le code est globalement sain (commentaires explicatifs sur les décisions de sécurité, tests sur les calculs critiques, compilation TypeScript stricte côté frontend, séparation des préoccupations propre). Les zones d'attention sont l'absence d'e2e automatisé et la gestion encore artisanale des sauvegardes — points adressables en quelques semaines de travail ciblé.

L'architecture multi-tenant choisie (DB-per-tenant) est adaptée au segment PME/ETI ciblé et offre une isolation forte entre clients. Elle pourra évoluer vers un modèle hybride (DB partagée pour les très petits tenants, DB dédiée pour les comptes premium) si la croissance le justifie.

---

*Document généré à partir de l'inventaire de la base de code à date — 64 contrôleurs API, 131 entités EF, 22 écrans mobile, ~30 modules web. Mises à jour à chaque itération significative.*
