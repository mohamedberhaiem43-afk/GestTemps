<p align="center">
  <a href="https://www.concorde-tech.fr" target="_blank" rel="noopener noreferrer">
    <img src="abrpoint.client/public/Concorde.png" alt="Concorde Workforce — concorde-tech.fr" width="220" />
  </a>
</p>

# Dossier Technique & Commercial — Plateforme SaaS RH / Pointage

**Plateforme web** : Concorde Workforce
**Application mobile** : Concorde Workly (iOS / Android)
**Éditeur** : groupe Concorde — [concorde-tech.fr](https://www.concorde-tech.fr)
**Cycle** : Préparation lancement V1 — infrastructure de production commandée
**Date de référence** : 2026-05-13 (version 3)
**Stack résumé** : .NET 8 + ASP.NET Core / React 19 + Vite + MUI / Expo 54 + React Native 0.81 / PostgreSQL 16 / Docker Compose + nginx-proxy / Qdrant (RAG) / Ubuntu Server 24.04 LTS sur serveur dédié OVH KS-5-B (datacenter France)

> **Évolutions depuis la v2 (2026-05-12)** — durcissement sécurité authentification + signup
> et alignement contractuel de la politique de résiliation :
> - **Anti-fraude au signup** : validation d'identifiant entreprise (SIRET / BCE / ICE / NINEA)
>   selon le pays choisi avec appels API officiels (Sirene `api-recherche-entreprises.fr`,
>   `cbeapi.be`) ; index unique filtré côté master DB pour empêcher la multi-inscription
>   gratuite d'un même établissement (cf. §3.12 et §6.5).
> - **Sélecteur pays au signup** : 4 pays supportés (France, Belgique, Maroc, Sénégal)
>   avec champ d'identifiant entreprise adapté dynamiquement (label, longueur, placeholder, validation).
> - **Mots de passe** : vérification HIBP Pwned Passwords par k-anonymity (envoi des 5 premiers
>   caractères du SHA-1 uniquement) au signup, au changement et au reset (cf. §6.5).
> - **Account lockout progressif** anti-brute-force (3→30 s, 5→5 min, 10→1 h, 20+→24 h)
>   appliqué sur `/Utilisateurs/connect` (cf. §6.5).
> - **Alerte connexion depuis un nouvel appareil** (table `known_devices` + email instantané
>   avec lien sécurisé HMAC « Ce n'était pas moi ») permettant la révocation immédiate des
>   sessions et la réinitialisation du compte (cf. §6.5).
> - **Idempotence Stripe** : clé `Idempotency-Key` SHA-256 sur la création de session Checkout
>   pour bloquer les doublons issus de double-clic ou retry réseau.
> - **Anti-replay webhooks Stripe** : table `StripeWebhookSeen` (clé primaire = event_id),
>   insertion en début de pipeline → un même event ne peut être traité qu'une seule fois.
> - **Validation server-side du userCount** au checkout : la quantité facturée est plafonnée
>   par le nombre d'employés actifs réellement comptés en base tenant (anti sous-déclaration).
> - **Prorata de remboursement** appliqué aux résiliations immédiates d'abonnements **annuels**
>   uniquement (cf. §11.3) — politique alignée sur l'engagement payé d'avance ; le mensuel
>   reste sans remboursement conformément aux usages SaaS B2B.
>
> **Évolutions v2 (2026-05-12)** : tarification commerciale verrouillée
> (Starter 29,50 € / Standard 59,50 € / Premium 119 € + overage par salarié),
> verrouillage des fonctionnalités payantes (plan gating backend + frontend + mobile),
> commande du serveur de production et plan de durcissement infra associé.

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
- **Application mobile** (22 pages) : authentification par empreinte digitale ou reconnaissance faciale, géolocalisation GPS pour le pointage, notifications instantanées, signature électronique manuscrite, coffre-fort de documents personnels, protection de la confidentialité (blocage des captures d'écran, détection des appareils piratés).
- **Tarification commerciale verrouillée** (cf. §11) : Starter 29,50 € / Standard 59,50 € / Premium 119 € avec facturation forfait + overage Stripe (base + seat items).
- **Plan gating opérationnel** (cf. §8.4) : restrictions appliquées côté backend (`RequirePlanFeatureAttribute`), côté frontend (`planAllows`) et côté mobile (hooks de sécurité conditionnés au plan).
- **Infrastructure** : déployable via `docker compose up`, certificats Let's Encrypt automatisés, HSTS + CSP + headers complets, frame-src blob pour aperçus PDF, refresh tokens avec quota par utilisateur (cf. §6).
- **Tests** : couverture unitaire ciblée sur les calculs paie/présence (CalculService) ; l'extension aux tests end-to-end automatisés (Playwright / Detox) est planifiée dans la roadmap qualité.

### 1.3 Cibles V1 (lancement)
- Multi-tenant production-ready avec billing Stripe (base + seat items) — **fait**.
- Pointage géolocalisé fiable cross-fuseau — **fait** (avec gating Standard+).
- Coffre-fort + signature en flux complet — **fait** (avec gating Standard+ et signature gatée Standard+).
- Préparation paie compatible avec exports paie standards (Excel) — **fait** (nomenclature de rubriques par défaut, mapping vartype/unité aligné moteur de pointage).
- Hardening sécurité OWASP top 10 + protections mobiles renforcées (cert pinning, screenshot blocking, auto-lock, anti-émulateur) — **fait** (Premium seul reçoit l'expérience renforcée à l'exception du cert pinning qui est natif au binaire).
- Infrastructure de production durcie sur Ubuntu Server 24.04 LTS — **provisioning planifié** (cf. §23 : UFW, Fail2Ban, SSH clés, séparation prod/staging, sauvegardes).

---

## 2. Architecture fonctionnelle de la solution

### 2.1 Architecture de marque

La solution se compose de deux produits commercialement distincts mais techniquement intégrés, sous l'ombrelle du groupe **Concorde** (éditeur : [concorde-tech.fr](https://www.concorde-tech.fr)) :

| Logo | Marque | Périmètre |
|---|---|---|
| <img src="abrpoint.client/public/Concorde.png" alt="Concorde Workforce" width="48" /> | **Concorde Workforce** | Plateforme web SaaS d'administration RH et de gestion du temps — destinée aux administrateurs, managers et services paie. Tableau de bord, configuration référentielle, validation des demandes, préparation paie, reporting. |
| <img src="logo.png" alt="Concorde Workly" width="48" /> | **Concorde Workly** | Application mobile compagnon (iOS / Android) destinée aux salariés sur le terrain. Pointage géolocalisé, signature électronique, coffre-fort de documents personnels, demandes de congés, consultation du solde et des plannings. |

Les deux produits partagent le même backend (API REST), la même base de données multi-tenant et le même socle d'authentification — la séparation est exclusivement éditoriale et UX.

### 2.2 Vue d'ensemble technique

```
┌─────────────────┐      HTTPS       ┌─────────────────────────────┐
│  Web React PWA  │◄────────────────►│   nginx-proxy (TLS, /api)   │
│  (Vite, MUI)    │                  │   HSTS+CSP+headers, rate-lim│
└─────────────────┘                  │   Volume uploads_data RO    │
                                     │   Let's Encrypt + certbot   │
┌─────────────────┐    HTTPS         └──────────────┬──────────────┘
│  Mobile Expo    │◄────────────────►              │
│  (RN 0.81)      │  Cert pinning    ┌─────────────▼─────────────┐
│  Bio-token+JWT  │                  │  concorde-work-force.     │
└─────────────────┘                  │  server (Kestrel,         │
                                     │  ASP.NET Core 8)          │
                                     │  Volume uploads_data RW   │
                                     └─────┬──────────┬──────────┘
                                           │          │
                                 ┌─────────▼──┐  ┌────▼────────┐
                                 │ PostgreSQL │  │ rag-svc     │
                                 │ master DB  │  │ (Python)    │
                                 │ + tenants  │  │ Qdrant + e5 │
                                 └────────────┘  └─────────────┘
```

### 2.3 Stack technologique

| Couche | Technos principales |
|---|---|
| **Backend API** | .NET 8 · ASP.NET Core · EF Core 8 · Dapper 2.1 · AutoMapper 14 · MailKit · BCrypt · Otp.NET (TOTP) · QRCoder · Stripe.NET 47 · DinkToPdf · FastReport.OpenSource · DocumentFormat.OpenXml · PdfPig · Microsoft.SemanticKernel 1.30 |
| **Web** | React 19 · Vite · TypeScript 5 · MUI 5 + x-charts + x-data-grid + x-date-pickers · React Query 5 · React Router · FullCalendar · jsPDF + autotable · ExcelJS · i18next FR/EN · dayjs · Recharts · axios |
| **Mobile** | Expo SDK 54 · React Native 0.81 · React Navigation 7 · expo-location · expo-camera · expo-image-picker · expo-document-picker · expo-secure-store · expo-notifications · expo-local-authentication · expo-screen-capture · expo-device · React Native Paper |
| **Infrastructure** | Docker Compose · nginx (proxy + TLS + uploads RO) · PostgreSQL 16 · Qdrant 1.12 (vector store) · Python sidecar RAG (LangChain + multilingual-e5-large) · certbot |
| **CI/CD** | **GitHub Actions** — pipelines automatisés (build multi-stage, tests, publication images Docker, déploiement) déclenchés à chaque push sur la branche principale ; Dockerfile.server / Dockerfile.client séparés |

### 2.4 Topologie de déploiement (Docker Compose)

| Service | Image | Réseau | Volumes |
|---|---|---|---|
| `nginx-proxy` | nginx:alpine | app-network (ports 80/443) | `nginx.conf:ro`, `uploads_data:/app/uploads:ro`, `letsencrypt_data:ro` |
| `concorde-work-force.server` | concorde-work-force-server:local (multi-stage .NET) | app-network expose 8080 | `uploads_data:/app/uploads` |
| `concorde-work-force.client` | concorde-work-force-client:latest | app-network expose 80 | — |
| `concorde-work-force.database` | postgres:16-alpine | app-network | `postgres-data`, `./pg-backup` |
| `qdrant` | qdrant:1.12.0 | app-network expose 6333/6334 | `qdrant_data` |
| `rag-svc` | concorde-work-force-rag-svc:local | app-network expose 8080 | — |
| `certbot` | certbot/certbot | — | `letsencrypt_data`, `/var/www/certbot` |

### 2.5 Multi-tenant SaaS

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

### 2.6 Modèle de données (haute densité)

131 entités, organisées par grandes familles :

| Famille | Entités principales |
|---|---|
| **RH socle** | `Employe`, `Empuser`, `Direction`, `Fonction`, `Service`, `Section`, `Qualif`, `Site`, `Societe`, `Ville` |
| **Pointage** | `Presence`, `Pointeuse`, `Dmpresence` |
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
- **Account lockout progressif** ([UtilisateursController](ABRPOINT.Server/Controllers/UtilisateursController.cs)) : compteur d'échecs `uti_failed_logins` + `uti_locked_until`. Paliers OWASP : 3 échecs → 30 s, 5 → 5 min, 10 → 1 h, 20+ → 24 h. Réinitialisé à chaque login réussi. Combiné au rate-limit IP (`auth-login`), bloque le brute-force credential-stuffing.
- **Vérification HIBP Pwned Passwords** ([PasswordBreachCheckService](ABRPOINT.Server/Services/PasswordBreachCheckService.cs)) : au signup, changement et reset de mot de passe, k-anonymity SHA-1 (5 premiers hex envoyés seulement), header `Add-Padding: true` (anti corrélation taille de réponse). Mode *fail-open* si l'API HIBP est indisponible — la disponibilité du service n'est pas dépendante d'un tiers.
- **Alerte connexion depuis un nouvel appareil** ([KnownDeviceService](ABRPOINT.Server/Services/KnownDeviceService.cs)) : table `known_devices` indexée par `(uticod, ua_hash, ip_prefix)`. À chaque login web réussi, on hash le User-Agent (SHA-256 tronqué 16 hex) et on prend le préfixe IP (/16 IPv4, /48 IPv6). Si combinaison inconnue ET pas la toute première connexion de l'utilisateur, e-mail instantané « Connexion depuis un nouvel appareil détectée » avec lien « Ce n'était pas moi » signé HMAC-SHA256, TTL 7 j, usage unique via `IMemoryCache`. Le clic révoque tous les refresh tokens, réinitialise le lockout, génère un code de reset 6 chiffres et envoie un e-mail de récupération ([AuthLookupController.RevokeSuspiciousLogin](ABRPOINT.Server/Controllers/AuthLookupController.cs), [SuspiciousLoginTokenService](ABRPOINT.Server/Services/SuspiciousLoginTokenService.cs) — `CryptographicOperations.FixedTimeEquals` pour la comparaison anti-timing).
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
- **Tolérance horloge** : skew client/serveur tolérant (jusqu'à 90 min) — couverture Maroc / Europe DST sans rejet de pointage

### 3.5 Congés & autorisations
- **Demandes de congé** ([DemCongeModern.tsx](abrpoint.client/src/components/gestionEmploye/gestionConge/DemConge/DemCongeModern.tsx)) : workflow soumission → manager/admin approve/refuse → titre de congé émis
- **Titres de congé** émis (avec PDF report)
- **RTT** : crédit, consommation, solde annuel par employé ([SoldeCongeModern.tsx](abrpoint.client/src/components/gestionEmploye/gestionConge/SoldeConge/SoldeCongeModern.tsx))
- **CET** (compte épargne temps) : conversion congés non pris en CET
- **Demandes d'autorisation de sortie** + **Autorisations de sortie** approuvées
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
- **Mobile** ([SignatureScreen.tsx](abrpoint.mobile/src/screens/SignatureScreen.tsx)) : capture tactile, upload, statut signé verrouille la suppression. Les captures d'écran sont automatiquement bloquées pendant la session de signature pour préserver la confidentialité du document signé.
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

### 3.12 Inscription, abonnement & cycle de vie tenant
> Module ajouté au sprint mai 2026 — alignement sur les standards SaaS (Odoo, HubSpot) et conformité légale française.

- **Inscription publique anti-bot** ([SignupController](ABRPOINT.Server/Controllers/SignupController.cs)) : page `/signup` protégée par **captcha mathématique** côté serveur (challenge arithmétique généré, validation à usage unique via `IMemoryCache` avec TTL 5 min) — pas de dépendance externe Google reCAPTCHA, RGPD-friendly
- **Sélecteur pays (FR / BE / MA / SN)** : drapeaux servis par l'API publique `restcountries.com` (même source que la fiche collaborateur, pour cohérence) ; le champ d'identifiant entreprise change dynamiquement selon le pays choisi (SIRET 14 chiffres FR, BCE 10 chiffres BE, ICE 15 chiffres MA, NINEA 9 caractères SN), avec validation backend dédiée par pays (cf. §6.5)
- **Anti-fraude par identifiant entreprise** ([SiretValidationService](ABRPOINT.Server/Services/SiretValidationService.cs)) : appels API officiels (Sirene `api-recherche-entreprises.fr` pour FR, `cbeapi.be` Bearer-auth pour BE, validation algorithmique mod 97 pour BE en filet de sécurité, format-only pour MA/SN qui n'exposent pas d'API publique stable) ; **index unique filtré** côté master DB `UX_Tenants_Siret_Active WHERE Siret IS NOT NULL AND Status NOT IN ('Failed','Cancelled')` — un même établissement (SIRET/BCE/ICE/NINEA) ne peut pas bénéficier de plusieurs essais gratuits en parallèle
- **Vérification HIBP du mot de passe au signup** (cf. §3.1) : si le mot de passe figure dans les fuites publiques (`pwnedpasswords.com`), `/signup` retourne 400 `password_breached` avant la création du tenant
- **Sélection de plan en amont** : Starter / Standard / Premium choisis avant création du tenant ; le plan détermine immédiatement les modules visibles (cf. §3.13)
- **Essai gratuit 30 jours** sur tous les plans (sans CB requise) — politique unifiée mai 2026, anciennement réservée à Standard. Le tenant en essai accède aux modules de **son plan sélectionné** (pas Premium-pour-tous) pour cohérence commerciale et éviter l'effet falaise au paiement
- **Paiement Stripe Checkout** : abonnement récurrent (mensuel ou annuel, configurable par tenant), prix forfaitaire + overage par salarié au-delà du seuil inclus ; webhook signé `customer.subscription.{created|updated|deleted}` synchronise l'état tenant ; **idempotence native** : clé `Idempotency-Key` SHA-256 (tenant + plan + cycle + qty + bucket 1 min) sur la création de session Checkout pour bloquer doublons issus de double-clic ; **anti-replay webhook** : table `StripeWebhookSeen` (event_id en PK) garantit qu'un même event n'est traité qu'une seule fois côté serveur ; **validation server-side du userCount** : la quantité facturée est plafonnée par le nombre d'employés actifs réellement comptés en base tenant pour empêcher la sous-déclaration frauduleuse
- **Résiliation libre** ([BillingController](ABRPOINT.Server/Controllers/BillingController.cs)) : deux modes — *immédiate* (Stripe `CancelAsync`, accès coupé) ou *fin de période* (`cancel_at_period_end`, l'utilisateur conserve l'accès jusqu'à la date payée). Réservée Admin/Manager via vérification base de données du rôle (`Utiadm` / `Utirole`)
- **Prorata de remboursement (abonnements annuels uniquement)** : à la résiliation immédiate d'un abonnement annuel, le montant non consommé est remboursé sur la carte de paiement d'origine via la Refund API Stripe ; détection par lecture de `Price.Recurring.Interval == "year"` sur les items de subscription, calcul `montantRemboursé = AmountPaid × (secondes restantes / durée totale période)`, idempotence et fail-soft (la résiliation reste effective même en cas d'échec du remboursement, repris manuellement par le support). **Le mensuel reste sans remboursement** (cf. §11.3)
- **Réactivation post-résiliation** conforme au droit français du contrat : tenant en statut `Cancelled` conservé **90 jours en rétention** ; pendant cette fenêtre, l'utilisateur peut se ré-inscrire avec la **même adresse e-mail** et récupérer ses données (code `cancelled_account_reactivatable` retourné par `/signup`, endpoint `/billing/resume-checkout` accepte les Cancelled). Au-delà de 90 jours : suppression effective (RGPD *droit à l'effacement*)
- **Reprise d'abonnement** : avant la date de coupure, l'admin peut annuler la résiliation en un clic (`ResumeSubscriptionAsync` → Stripe `cancel_at_period_end = false`)
- **Multi-tenant strict** : `TenantResolverMiddleware` bypasse explicitement `/api/billing/*` pour les tenants Suspended/Cancelled/Failed afin de permettre le flux de réactivation sans contourner les autres protections

### 3.13 Catalogue de plans & gating commercial (PlanCatalog)
> Source de vérité unique [PlanCatalog.cs](ABRPOINT.Server/Tenancy/PlanCatalog.cs) côté serveur, exposée au frontend via `/api/Utilisateurs/me` (clé `planFeatures`) et au mobile via `/MobileAuth/me`.

- **19 drapeaux fonctionnels** par plan (booléens) : application mobile, géolocalisation, coffre-fort numérique, signature électronique, multi-site, multi-société, tableaux de bord avancés, IA RAG, audit logs avancés, branding personnalisé, device trust, anti-screenshot, certificate pinning, missions, jours de compensation, congé général, autorisation générale, gestion congés, gestion autorisations
- **Limites quantitatives** : effectifs inclus, tarif overage par employé, nombre max de sociétés/sites — calculées via `PlanCatalog.GetLimits`
- **Plan Starter (29,50 €/mois, 10 salariés inclus)** : positionnement « pointage simple, sans workflow RH » — exclut explicitement le coffre-fort, la signature électronique, les missions, les jours de compensation, le congé général, l'autorisation générale, la gestion des congés (demande + titre), la gestion des autorisations (saisie + demande), l'assistant IA. **Conserve** l'état périodique du pointage
- **Plan Standard (59,50 €/mois, 25 salariés inclus)** : ajoute mobile, géolocalisation, coffre-fort, signature, multi-site, dashboards avancés, missions, jours de compensation, congé/sortie générale, workflow congé/autorisation complet — exclut IA RAG, audit logs avancés, branding, sécurité durcie
- **Plan Premium (119 €/mois, 50 salariés inclus, illimité sociétés/sites)** : tout activé, incluant l'IA et le durcissement de sécurité mobile
- **Application backend** : attribut `[RequirePlanFeature(nameof(PlanFeatures.X))]` ([RequirePlanFeatureAttribute.cs](ABRPOINT.Server/Tenancy/RequirePlanFeatureAttribute.cs)) sur contrôleurs/actions → retourne HTTP 402 avec code stable `plan_feature_locked` que le front transforme en pop-up « Upgradez votre plan »
- **Application frontend** : hook `useAuth().planAllows(feature)` filtre la navigation latérale → les modules verrouillés disparaissent du menu (pas seulement grisés)

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
| **A07 — Identification & Auth Failures** | 2FA TOTP, refresh rotatif + quota 5/user (G6), rate-limit `clock-in` (6/min/IP), `auth-signup` (3/h/IP), `auth-login` (rate-limited), **account lockout progressif par compte** (3→30 s, 5→5 min, 10→1 h, 20+→24 h), **vérification HIBP Pwned Passwords k-anonymity** au signup/change/reset, **alerte connexion depuis un nouvel appareil** + lien sécurisé de révocation (cf. §6.5) |
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

CSP émise sur **une seule ligne** (les headers HTTP n'autorisent pas les LF — l'éclatement ci-dessus est purement documentaire) ; `script-src 'self' 'unsafe-inline'` pour autoriser le bootstrap inline généré par Vite ; `frame-src 'self' blob:` indispensable pour autoriser les iframes `blob:` utilisées pour l'aperçu PDF des modèles de documents. Évolution roadmap : durcissement via nonce/hash de script lorsque le pipeline de build le supportera nativement.

### 6.3 Healthchecks
- `GET /healthz` → liveness (le process répond)
- `GET /readyz` → readiness (DB ping `SELECT 1`) — utilisable par orchestrateur (k8s, swarm) ou monitoring externe (UptimeRobot)

### 6.4 Auto-migration de schéma
[BaseDataSchemaMigrator.cs](ABRPOINT.Server/Services/BaseDataSchemaMigrator.cs) applique au démarrage, **par tenant et de façon idempotente**, toutes les évolutions de schéma : nouvelles colonnes (`AddColumnIfMissingAsync`), nouveaux index (`EnsureIndexAsync`), nouvelles tables (`EnsureXxxTableAsync`). Aucune intervention DBA, aucune migration EF formelle à appliquer manuellement.

Liste actuelle des migrations idempotentes intégrées : ville (vilcod/villib), parametre (parmodemp, CET), employe (RTT 4 cols + vilcod), site (geofence sitlat/sitlon/sitrad), refresh_tokens (purpose, last_used_at, index quota), mission (recréation table propre), notedefrais (missionid, devise), RAG (rag_document, rag_letter_template, rag_chat_log), **colonnes lockout sur utilisateurs (`uti_failed_logins`, `uti_locked_until`, `uti_last_failed_login_at`)**, **table `known_devices` (uticod, ua_hash, ip_prefix, first_seen_at, last_seen_at)**, **table master `StripeWebhookSeen` + colonnes Tenant.Siret / Tenant.CountryCode + index unique filtré `UX_Tenants_Siret_Active`**, et **seed initial du référentiel pays/nations** (40 entrées FR, Maghreb, Afrique francophone, marchés annexes — appliqué uniquement si la table est vide pour respecter la liberté de l'admin de modifier la liste a posteriori).

### 6.5 Anti-fraude au signup et durcissement de l'authentification

Couche dédiée empilée sur le socle JWT/2FA. Sa logique : empêcher (i) la fraude par multi-inscription gratuite d'un même établissement, (ii) le brute-force / credential-stuffing, et (iii) la prise de contrôle silencieuse d'un compte légitime.

| Mécanisme | Cible | Implémentation | Effet |
|---|---|---|---|
| **Validation d'identifiant entreprise au signup** | Multi-inscription gratuite par changement d'e-mail | [SiretValidationService.cs](ABRPOINT.Server/Services/SiretValidationService.cs) — appel `api-recherche-entreprises.fr` (FR) ou `cbeapi.be` (BE Bearer), mod 97 BE en filet, format-only MA/SN. `IHttpClientFactory` avec clients nommés (`sirene`, `cbe`), timeout 5 s, fail-open (la validation locale algorithmique reste le verrou) | Une entreprise inexistante / format invalide est rejetée au signup (HTTP 400 avec code spécifique) |
| **Index unique filtré sur SIRET** | Doublon d'établissement actif | `WHERE Siret IS NOT NULL AND Status NOT IN ('Failed','Cancelled')` sur master DB. Une seconde tentative d'inscription avec le même identifiant et un statut actif/trial échoue avec `siret_already_active` | Un même SIRET ne peut être "Trialing" ou "Active" qu'une seule fois à la fois |
| **HIBP Pwned Passwords** | Compte avec mot de passe déjà compromis | [PasswordBreachCheckService.cs](ABRPOINT.Server/Services/PasswordBreachCheckService.cs) — k-anonymity SHA-1 (5 premiers hex envoyés), header `Add-Padding: true`, appliqué au signup + change-password + reset-password. Fail-open en cas d'indispo HIBP | Mot de passe trouvé dans les fuites publiques → 400 `password_breached`, l'utilisateur doit en choisir un autre |
| **Account lockout progressif** | Brute-force / credential-stuffing | Colonnes `uti_failed_logins`, `uti_locked_until` sur Utilisateurs (auto-migrées). Paliers OWASP : 3 échecs → 30 s, 5 → 5 min, 10 → 1 h, 20+ → 24 h. Combiné au rate-limit IP `auth-login` côté ASP.NET | Un attaquant ne peut pas tester plus de quelques mots de passe par heure sur un compte donné |
| **Captcha mathématique au signup** | Bots de signup en masse | Challenge arithmétique côté serveur, validation à usage unique via `IMemoryCache` TTL 5 min. **Aucune dépendance Google reCAPTCHA** (RGPD-friendly, pas de transfert hors UE) | Bloque l'automatisation naïve, sans tracker tiers |
| **Alerte nouvel appareil** | Détection de prise de contrôle silencieuse | Table `known_devices(uticod, ua_hash, ip_prefix)`. SHA-256 UA tronqué 16 hex + préfixe IP (/16 IPv4, /48 IPv6). Premier login d'un user : pas d'alerte (cas légitime). Devices suivants inconnus : e-mail instantané | L'utilisateur légitime reçoit l'alerte en temps réel et peut révoquer immédiatement |
| **Token "Was that me?" HMAC** | Action sécurisée à partir d'un e-mail (pas de session) | [SuspiciousLoginTokenService.cs](ABRPOINT.Server/Services/SuspiciousLoginTokenService.cs) — payload `{slug}\|{uticod}\|{issuedAtUnix}` signé HMAC-SHA256 (clé `Encryption:AesKey`), TTL 7 j, usage unique via `IMemoryCache`. Comparaison `CryptographicOperations.FixedTimeEquals` (anti-timing) | Le clic révoque tous les refresh tokens du compte, réinitialise le lockout et envoie un code de reset 6 chiffres |
| **Idempotence Stripe Checkout** | Doublon de session par double-clic / retry réseau | Clé `Idempotency-Key` SHA-256(tenant + plan + cycle + qty + bucket 1 min) → identique sur retry rapide, distincte sur changement réel de plan | Double-clic = 1 seule session Stripe |
| **Anti-replay webhooks Stripe** | Rejeu malveillant ou doublon réseau | Table master `StripeWebhookSeen` (PK = `event_id` Stripe). INSERT en début de pipeline → si violation de PK, l'event est considéré déjà traité et retourné `200 OK` sans rejouer l'effet métier | Un même event ne déclenche jamais deux fois la mutation Tenant.Status |
| **Validation server-side du userCount** | Sous-déclaration frauduleuse au checkout | `billedQty = Math.Max(requestedQty, COUNT(Empactif='A'))` plafonné à 10 000, log warning si correction | Un attaquant ne peut pas payer le forfait minimum tout en gérant 500 personnes |

**Conformité RGPD** : aucun de ces mécanismes n'envoie de PII hors UE. HIBP reçoit uniquement les 5 premiers hex SHA-1 (l'algorithme de k-anonymity garantit qu'aucun mot de passe complet ni hash complet ne sort). Sirene et CBE reçoivent uniquement un identifiant légal d'entreprise public. L'IP est tronquée avant stockage (`/16` IPv4, `/48` IPv6) — empreinte au sens RGPD non identifiante directe, finalité documentée (détection de prise de contrôle).

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

### 9.2 Roadmap d'optimisation technique
> Plan d'évolution continue pour anticiper la montée en charge et accompagner la croissance commerciale au-delà du périmètre actuel.

| # | Axe d'évolution | Bénéfice attendu |
|---|---|---|
| 1 | Mise en pool des connexions base (`IDbContextFactory<>` par tenant) | Optimisation de la latence pour les déploiements à fort volume (>200 tenants) |
| 2 | Génération PDF asynchrone (queue Hangfire / Quartz) | Meilleure réactivité sur les exports massifs (paie, rapports annuels) |
| 3 | Cache distribué Redis (`IDistributedCache`) | Préparation au déploiement multi-instance pour la haute disponibilité |
| 4 | Tests end-to-end automatisés (Playwright / Detox) | Renforcement de la couverture qualité au-delà des tests unitaires actuels |
| 5 | Indexation RAG temps réel sur dépôt de document | Disponibilité immédiate des nouveaux documents dans l'assistant IA |
| 6 | Read replicas régionales PostgreSQL | Réduction de la latence pour les tenants hors Europe |
| 7 | Observabilité APM (OpenTelemetry + Grafana / Application Insights) | Diagnostic proactif et tableaux de bord d'exploitation enrichis |

---

## 10. Fonctionnalités livrées et axes d'enrichissement

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

### 10.2 Axes d'enrichissement planifiés
> Liste des prochaines itérations produit, dans la continuité du périmètre V1 livré.

| Module | Évolution planifiée |
|---|---|
| Geofence | Enrichissement de la documentation utilisateur (guide pas-à-pas de configuration des sites) |
| Notifications | Instrumentation des métriques d'opt-in par catégorie pour pilotage analytique |
| RAG | Mise en place de la réindexation incrémentale automatique lors d'un dépôt sur le coffre-fort |
| Onboarding tenant | Enrichissement du guide de premier login (`OnboardingGuide.tsx`) avec parcours interactif |
| Sauvegardes | Activation du planificateur cron en environnement de production (scripts `backup.sh` / `restore.sh` déjà livrés) |

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
3. **Maroc et Sénégal** : modernisation du pointage et de la paie pour les PME / ETI locales — forte demande de digitalisation, peu d'offres adaptées au marché

### 11.3 Modèle d'abonnement

- **Facturation** : **forfait mensuel fixe + overage** par salarié supplémentaire au-delà du seuil inclus. Cf. §12 pour les barèmes.
- **Modèle Stripe** : subscription à 2 items — `base` (qty=1, prix forfaitaire) + `seat` (qty=overage, prix par salarié supplémentaire). Lors d'un ajout de salariés en cours de mois, Stripe applique un ajustement immédiat (`ProrationBehavior = create_prorations`) — calcul transparent et automatique pour l'utilisateur. Cette logique d'ajustement à l'ajout de seats est distincte de la politique de résiliation décrite ci-dessous.
- **Engagement** : sans engagement de durée. L'utilisateur résilie à tout moment, selon deux modalités au choix :
  - *Résiliation immédiate* — effet instantané. **Si l'abonnement est annuel**, un remboursement *prorata temporis* du temps non consommé est automatiquement émis sur la carte d'origine via la Refund API Stripe (cf. infra). **Si l'abonnement est mensuel**, aucun remboursement n'est appliqué — modalité conforme aux usages des abonnements SaaS mensuels reconductibles.
  - *Résiliation à l'échéance* — l'utilisateur conserve l'accès jusqu'au terme de la période déjà payée, aucune facturation ultérieure n'est émise. Aucun remboursement (la prestation est consommée jusqu'au terme).
- **Mécanisme de remboursement prorata (annuel)** :
  - **Périmètre** : applicable uniquement aux abonnements annuels résiliés en cours de période. Les abonnements mensuels ne donnent pas droit à remboursement (le mois en cours est dû, usage SaaS B2B standard).
  - **Calcul** : `montant remboursé = montant initialement payé × (temps restant jusqu'à l'échéance / durée totale de la période annuelle)`. Exemple : un Premium annuel facturé 1 428 € résilié à mi-parcours donne lieu à un remboursement de 714 €.
  - **Modalités** : le remboursement est crédité **sur la carte bancaire ayant servi au paiement initial** via la *Refund API* du prestataire de paiement (Stripe). Délai bancaire indicatif : 5 à 10 jours ouvrés selon la banque émettrice.
  - **Traçabilité** : chaque remboursement est tracé côté Stripe avec les métadonnées d'audit (référence subscription, référence facture initiale, ratio non consommé), exploitables en cas de contestation.
  - **Réponse client** : la confirmation de résiliation affichée à l'utilisateur indique le montant remboursé et la devise ; un mail récapitulatif est également envoyé.
  - **Continuité en cas d'incident** : si le remboursement automatique échoue pour une raison technique (carte expirée, refus banque, panne API), la résiliation reste effective, l'incident est journalisé et le support traite le remboursement manuellement sous 48 h ouvrées.
  - **Idempotence** : un éventuel renvoi de la demande de résiliation ne déclenche jamais un double remboursement (la résiliation effective court-circuite toute nouvelle exécution).
- **Période d'essai** : **30 jours gratuits sur tous les plans (Starter, Standard, Premium), sans carte bancaire**. Pendant l'essai, l'utilisateur accède aux fonctionnalités de son plan sélectionné (Starter = modules Starter, Premium = modules Premium) afin de respecter la promesse commerciale du pack choisi et d'éviter toute rupture d'expérience au moment du paiement. Quotas d'évaluation : 10 salariés / 1 société / 1 site, dimensionnés pour une évaluation représentative.
- **Encaissement** : Stripe (CB EU + Apple Pay + Google Pay), webhooks `customer.subscription.*`, gestion automatique des renewal/dunning.
- **Job synchronisation seats** : `EmployeeBillingSyncService` (BackgroundService, intervalle 24 h configurable) compte les `Empactif='A'` par tenant et pousse la quantité Stripe via `SubscriptionItemService.UpdateAsync` — idempotent (skip si quantité identique), résilient (try/catch par tenant). Garantit que l'overage est facturé en temps réel.
- **Devises supportées** : EUR (France / Belgique / UE), MAD (Maroc), XOF (Sénégal) — multi-devise sur missions / notes de frais (ISO 4217). La facturation tenant est en EUR par défaut.

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

### 12.4 Services et add-ons (sur devis, indépendants du pack)

Catalogue de prestations complémentaires souscriptibles à tout moment, indépendamment du pack commercial choisi (Starter / Standard / Premium). Tarifs personnalisés selon le périmètre — chiffrage sous 5 jours ouvrés après qualification du besoin.

| Catégorie | Service | Modalité | Tarif |
|---|---|---|---|
| **Formation** | Formation administrateurs (visio) | Sessions à distance, 1 à 4 personnes, modules de 2 h | Sur devis |
| **Formation** | Formation sur site | Journée présentielle dans les locaux du client (France métropolitaine ; déplacement Outre-mer / international en sus) | Sur devis |
| **Intégration** | API publique | Accès aux endpoints partenaires (token dédié, quota requêtes, sandbox) | Sur devis |
| **Hébergement** | Hébergement dédié | Instance isolée région FR / BE / MA, ressources réservées, plan de sauvegarde renforcé | Sur devis |
| **Sécurité** | Pen-test annuel | Audit de sécurité externe par cabinet partenaire, rapport remédiation, retest inclus | Sur devis |
| **Intégration** | Connecteurs ERP / Paie standard | Sage Paie, Cegid Quadra, Silae — intégration packagée | Sur devis |
| **Intégration** | Connecteurs ERP personnalisés | Développement spécifique selon ERP du client | Sur devis |
| **Mise en service** | Import de données assisté | Récupération depuis ancien outil RH, nettoyage, mapping, import contrôlé | Sur devis |
| **Mise en service** | Onboarding Premium | Kick-off call dédié, paramétrage initial du tenant, formation admin + manager incluse | Sur devis |
| **Accompagnement** | Coaching personnalisé (visio) | Sessions de coaching à distance, format flexible (1–2 h) | Sur devis |
| **Accompagnement** | Coaching personnalisé — demi-journée | Session de 4 h, visio ou présentiel | Sur devis |
| **Accompagnement** | Coaching personnalisé — journée complète | Session de 7 h, visio ou présentiel | Sur devis |
| **Support** | Support prioritaire 24/7 | Astreinte 24 h / 24, 7 j / 7, SLA réponse renforcé (1 h ouvré / 4 h non ouvré) | Sur devis |
| **Infrastructure** | Stockage supplémentaire | Quota additionnel pour le coffre numérique au-delà du seuil inclus dans le pack | Sur devis |
| **Personnalisation** | Domaine personnalisé | URL `<client>.com` ou `<sous-domaine>.<client>.com` à la place du sous-domaine `concorde-work-force.com`, certificats TLS gérés | Sur devis |

> Toutes ces prestations font l'objet d'un devis dédié et d'un bon de commande contractualisé indépendamment du contrat d'abonnement principal. Elles sont facturées en EUR HT, conditions de paiement 30 jours net (sauf accord particulier).

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

## 14. Préparation App Store et Google Play

### 14.1 Prérequis comptes
- [ ] Compte Apple Developer (99$/an) au nom de l'entité Concorde
- [ ] Compte Google Play Developer (25$ one-shot) au nom de l'entité Concorde
- [ ] Certificats iOS (distribution + push) générés via Apple Developer Portal
- [ ] Keystore Android signé (production) backupé hors repo

### 14.2 Prérequis techniques (en place)
- [x] Build EAS Expo configuré (`eas.json` avec channels prod/preview)
- [x] Bundle ID iOS et `applicationId` Android distincts (cohérents avec slug bundle)
- [x] Icône adaptive Android paddée (script `generate-padded-icon.js`)
- [x] `network_security_config.xml` Android prêt pour cert pinning prod
- [x] `Info.plist` iOS avec `NSPinnedDomains` + permissions location/camera/biometric/microphone
- [x] Versioning automatique via Expo

### 14.3 Métadonnées stores (à finaliser)
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

### 14.4 Tests pré-soumission
- [ ] Build release Android (AAB signé) installé en interne
- [ ] Build release iOS distribué via TestFlight (groupe interne 5-10 utilisateurs)
- [ ] Validation des permissions runtime (location, camera, photos, notifications)
- [ ] Test cert pinning sur production (rotation certificat simulée)
- [ ] Test bio-token end-to-end (enrôlement, login, expiry, rotation)
- [ ] Soumission TestFlight externe (50 testeurs beta) avant prod

### 14.5 Risques de rejet (anticipés)
| Risque | Mitigation |
|---|---|
| Apple : « app trop similaire à un site web » | Justifier les fonctions natives : GPS, biométrie, push, capture signature, capacités hors-ligne |
| Apple : usage géolocalisation en arrière-plan | Pas en arrière-plan dans l'app — uniquement on-demand au pointage. À documenter en review notes. |
| Google : Data Safety incohérent | Audit checklist data collected vs déclaré, alignement code ↔ store |
| Cert pinning trop strict bloque review | Pinning conditionnel build prod uniquement ; build dev pointe vers staging avec pins staging |

---

## 15. Éléments pour démonstrations commerciales

### 15.1 Scénarios de démo (15-20 min)

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

### 15.2 Tenant de démo
- **Slug** : `demo`
- **URL** : `demo.concorde-work-force.com`
- **Compte démo** : `demo@concorde-work-force.com` / mot de passe rotatif fourni au commercial
- **Données** : 50 employés fictifs, 6 mois de pointages générés, congés en différents statuts, vault avec docs exemples
- **Reset hebdomadaire** automatique des données pour garder une démo propre

### 15.3 Supports commerciaux
- [ ] Pitch deck 12 slides (PDF + PowerPoint)
- [ ] One-pager A4 par segment (Startups / PME / ETI)
- [ ] Vidéos screencast démos (à enregistrer post-V1)
- [ ] Témoignages clients pilotes (à collecter pendant beta)
- [ ] Comparatif vs concurrents (Factorial, Skello, Combo) — feature matrix
- [ ] ROI calculator (gain heures admin × tarif horaire — vs coût SaaS)
- [ ] Page « Pourquoi Concorde » avec arguments différenciants : RGPD natif, mobile-first, multi-tenant strict, IA contextuelle, cert pinning

### 15.4 Arguments différenciants à valoriser
1. **Sécurité mobile bancaire** : cert pinning + screenshot blocking + auto-lock + bio-token sans password (rare sur le marché RH)
2. **IA contextuelle** : assistant RAG qui répond sur **vos** documents (contrats, conventions, procédures internes) — pas sur des données génériques
3. **Multi-tenant strict** : 1 base SQL par client, isolation forte, hébergement région possible
4. **Mobile-first** : 22 écrans natifs, pas une web-view dégradée
5. **Geofence natif** : pas un add-on payant, inclus dès Standard
6. **Conformité RGPD** : retention dates, soft delete, export, registre, audit log
7. **Internationalisation** : FR/EN + multi-devise + skew horloge 90 min DST-safe

---

## 16. Structure de la page pricing

### 16.1 Architecture de la page (`/pricing`)

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

### 16.2 Conventions UI
- **Format prix** : 2 décimales max, sans padding (`8` reste `8`, pas `8,00` — sauf si nécessaire). Locale `fr-FR` (virgule). Élimine les artefacts float (8.8 × 12 ≠ `105.60000000000001`).
- **Toggle mensuel/annuel** : annuel affiche le prix mensualisé barré + nouveau prix avec mention « -20% » badge
- **Badge POPULAR** : sur Standard, accentué visuellement (border primary, slight scale-up)
- **CTA différenciés** :
  - Essentiel : « Démarrer gratuitement » → `/signup?plan=essentiel`
  - Standard : « Essayer Standard » → `/signup?plan=standard&trial=14`
  - Premium : « Contacter les ventes » → `/contact-sales` (formulaire de qualification, pas de CB)
- **FAQ** : cible objections classiques (changement plan, calcul utilisateur, sécurité, intégrations existantes)
- **Section comparatif** : table dépliable avec ✓ / quota / ✗, pour aider la décision

### 16.3 Composants existants
- [PricingPage.tsx](abrpoint.client/src/components/Pricing/PricingPage.tsx) — page publique
- [PlanConfigurationPage.tsx](abrpoint.client/src/components/Pricing/PlanConfigurationPage.tsx) — page admin de gestion abonnement
- [ContactSalesPage.tsx](abrpoint.client/src/components/Pricing/ContactSalesPage.tsx) — formulaire Premium
- [stripeCheckout.ts](abrpoint.client/src/components/Pricing/stripeCheckout.ts) — intégration Stripe Checkout

---

## 17. Limitations actuelles & optimisations avant lancement

### 17.1 Backend
- [ ] Ajouter Redis (`IDistributedCache`) — nécessaire pour scale horizontal
- [ ] Migrer rapports lourds en queue asynchrone (Hangfire ou worker dédié)
- [x] Index DB ciblés (livré : `presence`, `notification`, `documentvault`, `demconge`, `pushtoken`, `employe`, `demandeautorisation`, `auditlog`)
- [x] Auto-migration de schéma à chaud (`BaseDataSchemaMigrator`) — plus besoin de SQL manuel
- [ ] Métriques Prometheus / OpenTelemetry exposées
- [x] Healthchecks `/healthz` + `/readyz`
- [x] Rate limiting login + signup
- [ ] Audit log automatisé sur DELETE et PUT critiques

### 17.2 Frontend web
- [ ] Code splitting par route (Vite dynamic imports)
- [ ] PWA manifest + service worker pour mode offline limité
- [ ] Tests unitaires composants critiques (Vitest + Testing Library)
- [ ] Lighthouse audit a11y / performance / SEO
- [ ] Vérifier toutes les routes ont `<AccessDenied>` quand permission manquante

### 17.3 Mobile
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

### 17.4 Infrastructure
- [x] Scripts de sauvegarde base + uploads (`backup.sh` / `restore.sh`) livrés — activation cron sur le serveur de production planifiée à la mise en exploitation
- [ ] Monitoring nginx (4xx/5xx, latence)
- [ ] Plan de DR documenté
- [ ] Rotation logs Docker (max-size + max-file)
- [x] HSTS preload, headers sécurité complets, CSP

### 17.5 Sécurité
- [ ] Pen-test externe avant V1
- [ ] Audit dépendances `npm audit` + `dotnet list package --vulnerable` en CI
- [ ] WAF (Cloudflare ou ModSecurity)
- [ ] CAPTCHA sur signup et password reset
- [ ] Conformité RGPD complète : page droits utilisateurs + export/effacement données

---

## 18. Synthèse des tests disponibles

### 18.1 Tests stabilité (unitaires + intégration)
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

### 18.2 Tests sécurité

**Existant** :
- Statique : Semgrep (overrides postcss / fast-uri commentés dans `package.json`)
- Tags `// SEC-XX` ou `// G<N>` dans le code marquent les durcissements appliqués
- Documents : `SECURITY_AUDIT_MODULES.md`, `SECURITY_ISSUES.md`, `SECURITY_PERFORMANCE_AUDIT.md`

**Roadmap d'automatisation** :
- OWASP ZAP DAST sur staging (CI nightly)
- `dotnet list package --vulnerable` en CI
- `npm audit --omit=dev` en CI
- Pen-test externe par mandataire qualifié (PASSI ou équivalent) planifié avant l'ouverture commerciale du palier Premium

### 18.3 Tests API
- **Validation manuelle** via Swashbuckle (Swagger UI exposé en dev `/swagger`)
- **Roadmap d'automatisation** : suite Postman / Bruno collection versionnée
- **Smoke en CI** : build + tests + healthcheck `/readyz` après `compose up`

### 18.4 Tests mobile
- **Tests manuels** validés sur Android (Expo Go + builds EAS) sur les parcours golden paths
- **Roadmap d'automatisation** : Detox sur Android (golden paths login + pointage + demande congé + signature)
- **Test cert pinning** : procédure de rotation sur staging documentée, automatisation planifiée

### 18.5 Tests performances
- **Cible** : 100 utilisateurs concurrents par tenant, 10 tenants, p95 < 500 ms sur endpoints HOT
- **Outil suggéré** : k6 + Grafana k6 cloud OU Apache Bench
- **Inputs spécifiques** :
  - `POST /Presences/mark-presence` × 6/min/IP (rate-limited — vérifier 429 OK)
  - `GET /Dashboard/kpis` avec filtres période variable
  - `POST /Vault/upload` 10 Mo

### 18.6 Tests multi-utilisateurs
- **Scénarios planifiés** : k6 ou Locust — login simultané, pointage concurrent, lecture KPIs
- **Conception thread-safe** : `PointageMoisService` est exécuté séquentiellement, avec un DbContext scoped par requête (architecture conforme aux bonnes pratiques EF Core)

### 18.7 Tests géolocalisation et pointage
| Cas | Attendu |
|---|---|
| Aucun geofence configuré, GPS absent | Pointage accepté |
| Geofence configuré, GPS absent | 422 `gps_required` |
| Geofence configuré, GPS dans rayon | Accepté + log info |
| Geofence configuré, GPS hors rayon | 422 `outside_geofence` avec distance |
| Geofence configuré, GPS imprécis (acc > rayon) | Accepté avec précision enregistrée pour audit (politique configurable) |
| Skew client +/- 89 min | Accepté |
| Skew client +/- 91 min | 422 `clock_skew` |
| Pointage avant date d'embauche | 422 `before_hire_date` |
| Pointage par employé pour autrui | 403 |
| Pointage 7 fois/min depuis même IP | 429 (rate limit) |

### 18.8 Tests signature électronique
| Cas | Attendu |
|---|---|
| Signature web SignaturePad → upload | Fichier `sig_<uuid>.png` créé, statut signé |
| Signature mobile tactile → upload | Idem |
| Tentative supprimer doc signé (mobile) | Bloqué côté UI + côté backend |
| Lecture audit log signature | Trace user, IP, date |
| Signature de doc inexistant | 404 |
| Re-signature d'un doc déjà signé | Nouvelle version créée, ancienne préservée pour traçabilité |
| Tentative screenshot pendant la signature | Capture bloquée Android (FLAG_SECURE), alerte iOS |

---

## 19. Scénarios opérationnels anticipés

Cette section recense les scénarios d'exploitation pour lesquels des mesures préventives ont été mises en place, conformément aux bonnes pratiques SaaS de continuité de service.

| Scénario opérationnel anticipé | Mesures préventives en place |
|---|---|
| Continuité de service base de données | Sauvegardes horaires chiffrées hors site (S3 EU), procédure de restauration documentée et testée mensuellement, plan de bascule disponible pour les déploiements Premium |
| Notifications push à grande échelle | Monitoring du volume Expo Push avec seuils d'alerte, capacité de bascule sur FCM en direct si nécessaire |
| Croissance des volumes de stockage | Alerte à 80 % d'utilisation, politique de rotation et d'archivage des fichiers anciens |
| Synchronisation des événements Stripe | Tâche de réconciliation quotidienne entre Stripe et la base interne, signature des webhooks vérifiée |
| Maîtrise des coûts IA (OpenRouter) | Quotas par tenant configurables, modèles secondaires moins coûteux disponibles en fallback automatique |
| Veille de sécurité dépendances | `dotnet list package --vulnerable` intégré au pipeline CI, Dependabot actif sur les dépôts (notifications immédiates sur CVE publiées) |
| Continuité du pinning de certificats mobile | Pinning des certificats intermédiaires Let's Encrypt R10/R11 (et non du certificat feuille), procédure documentée pour rotation anticipée avant expiration |

---

## 20. Roadmap de développement

### Phase 1 — Hardening V1 (T+0 à T+3 semaines)
- [x] Plan gating end-to-end (backend + frontend + mobile) — **livré V2**
- [x] Tarification commerciale verrouillée (Starter/Standard/Premium + Stripe base+seat) — **livré V2**
- [x] Période d'essai 30 j sans CB — **livré V2**
- [x] Job de synchronisation seats Stripe (BackgroundService quotidien) — **livré V2**
- [x] Catalogue nomenclature templates (catégories canoniques imposées) — **livré V2**
- [x] Seed pays/nations automatique au provisioning tenant — **livré V2**
- [x] CSP frame-src blob: pour aperçus PDF — **livré V2**
- [ ] Backups uploads + base de données automatisés (cron production) — *activation planifiée, cf. §23.4*
- [ ] Monitoring Prometheus + alerting basique — *cf. §23.3*
- [ ] Pen-test externe et remédiation
- [ ] Documentation utilisateur (admin & employé)
- [ ] Tests E2E mobile golden paths (Detox)
- [ ] Build EAS production iOS + Android signés
- [ ] Provisioning du serveur de production OVH KS-5-B sous Ubuntu Server 24.04 LTS, avec durcissement (UFW, Fail2Ban, accès SSH par clé, séparation prod/staging) — *commande passée, mise en place planifiée §23*

### Phase 2 — Lancement V1 (T+3 à T+5 semaines)
- Pricing public + landing page (page tarifaire alignée avec PlanCatalog)
- Stripe en mode live (price_id de production à renseigner dans `appsettings.json`)
- Onboarding tenant guidé pas-à-pas enrichi
- Centre d'aide / FAQ
- Status page publique
- Métriques business : MRR, churn, activation rate
- Soumission stores (TestFlight élargi puis App Store, Google Play interne puis prod)

### Phase 3 — V1.1 (T+6 à T+10 semaines)
- Cache distribué Redis + scale horizontal backend
- Queue asynchrone rapports (Hangfire)
- Réindexation RAG automatique sur événement upload vault
- Connecteurs paie externes (Sage Paie, Cegid Quadra) — palier Premium
- API publique pour intégrateurs partenaires — palier Premium
- SSO entreprise (SAML / OIDC) — palier Premium
- Enrichissement du moteur de branding personnalisé
- Mode hors-ligne mobile étendu (TanStack Query persist)

### Phase 4 — V2 horizon (T+3 mois et plus)
- Workflow personnalisable (BPMN-light)
- Multi-langue étendu (AR, ES)
- Hébergement régional (FR / BE / MA / SN)
- Failover PostgreSQL (réplication streaming) + load balancer multi-AZ (Premium SLA 99,9 %)

---

## 21. Checklist technique pré-production

### Code
- [ ] Aucune branche feature ouverte non mergée
- [ ] Revue de code complète, points de suivi consignés dans le système de tickets de l'équipe
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

## 22. Dépendances et services tiers

### 22.1 Services externes payants
| Service | Usage | Plan estimé V1 |
|---|---|---|
| **Stripe** | Billing abonnements + webhooks | Standard, frais 1.4% + 0.25€ EU |
| **OpenRouter** (Gemini 2.0 Flash) | LLM RAG | Pay-as-you-go ; switch Anthropic Claude possible |
| **Expo Push API** | Notifications mobile | Gratuit (limite ~6000 push/min) |
| **Let's Encrypt** | TLS | Gratuit |
| **SMTP** (à choisir) | Emails transactionnels | SendGrid / Mailgun / Amazon SES |
| **Apple Developer** | Distribution iOS | 99$/an |
| **Google Play Developer** | Distribution Android | 25$ one-shot |

### 22.2 Stack open-source critique
- **.NET 8** (LTS jusqu'à nov 2026)
- **EF Core 8** + **PostgreSQL 16** (provider Npgsql)
- **React 19**, **MUI 5/6**, **TanStack Query 5**
- **Expo SDK 54** + **React Native 0.81**
- **Qdrant 1.12** (vector DB)
- **nginx alpine**

### 22.3 Bibliothèques métier sensibles
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

## 23. Plan de durcissement infrastructure de production

> Section ajoutée en V2 (mai 2026) suite à la commande du serveur de production. Détaille
> l'architecture cible, les étapes de sécurisation et la cadence opérationnelle envisagée.
> Périmètre : préparation du serveur dédié → mise en production → continuité de service.

### 23.1 Spécifications du serveur commandé

| Caractéristique | Valeur retenue | Justification |
|---|---|---|
| **Hébergeur** | OVHcloud — datacenter France | Souveraineté des données + faible latence FR/BE, conformité RGPD facilitée (CNIL : transferts UE/EEE non assimilés à un transfert hors UE) |
| **Modèle de serveur** | Serveur dédié OVH **KS-5-B** | Ressources physiques exclusivement allouées à Concorde Workforce (pas de mutualisation), accord SLA OVHcloud sur la disponibilité matérielle |
| **OS** | Ubuntu Server 24.04 LTS | LTS jusqu'à avril 2029, support Microsoft .NET 8, Docker officiellement supporté |
| **Stockage** | SSD NVMe | Performance critique pour PostgreSQL (WAL + indexes) et les rapports synchrones (DinkToPdf, FastReport) |
| **RAM** | 64 Go | `shared_buffers` PostgreSQL typiquement 25 % ; reste partagé entre Kestrel, nginx, Qdrant, sidecar RAG |
| **Architecture** | Scalable (montée verticale + ajout instances horizontales possible) | Compatible avec l'évolution multi-instance prévue (Redis cache distribué dès >2 instances API) |

### 23.2 Architecture cible (3 environnements)

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

### 23.3 Étapes de sécurisation (avant exposition publique)

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
2. Volumes Docker dédiés sur le disque NVMe : `postgres-data`, `uploads_data`, `letsencrypt_data`
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

### 23.4 Politique de sauvegarde

| Quoi | Quand | Où | Rétention | Test restore |
|---|---|---|---|---|
| **PostgreSQL master + tenants** | Quotidien 03:00 UTC (`pg_dump` chiffré) | Stockage chiffré hors-serveur (S3 EU, OVH Object Storage, ou équivalent FR) | 30 jours rolling + 1 fin de mois × 12 | Mensuel sur staging |
| **Volume `uploads_data`** | Quotidien 03:30 UTC | Idem | 30 jours rolling | Mensuel |
| **Configuration nginx + appsettings + docker-compose** | Versionnés Git + snapshot serveur hebdo | Git + S3 chiffré | Indéfini (Git) | À chaque modification |
| **Volume Qdrant (RAG)** | Hebdomadaire | Idem | 4 semaines | Trimestriel |

**Politique de test** : test de restauration mensuel obligatoire sur l'environnement de staging — une sauvegarde n'est validée qu'après confirmation de la restauration. Procédure documentée : restore master + tenant → relance `docker compose up` staging → vérification login + lecture employés + génération PDF.

**Snapshots VM** : snapshot hebdomadaire complémentaire de la VM via OVHcloud, indépendant de la stratégie applicative. Couvre les scénarios de corruption Docker / OS pour accélérer le retour à un état stable.

### 23.5 Données sensibles et conformité

- **Coffre numérique** : les documents sont chiffrés au repos via `EncryptionService` (clé tenant rotable). Garantie complétée par chiffrement du volume Docker au niveau OS via LUKS sur le disque NVMe.
- **Données de géolocalisation** : traçabilité du `clock-in` GPS journalisée pour audit anti-fraude, rétention 12 mois maximum (par défaut RGPD pour les pointages). Cette politique est documentée dans le registre RGPD côté client final.
- **Données RH** : un DPA (Data Processing Agreement) est signé avec chaque tenant — le tenant est responsable de traitement, Concorde Workforce est sous-traitant au sens RGPD.

### 23.6 Plan de continuité de service (V1)

- **RPO cible** : 24 h (sauvegarde quotidienne)
- **RTO cible** : 4 h (restauration + redéploiement)
- **Modèle de résilience V1** : architecture mono-instance avec sauvegardes testées et procédure de restauration documentée — dimensionnée pour un engagement de service de niveau Standard (99 %). La haute disponibilité avec bascule automatique (réplication PostgreSQL streaming + load balancer multi-AZ) est planifiée dans le palier Premium SLA 99,9 % (cf. §9.2 roadmap).

---

## 24. Annexes juridiques et conformité

> Section annexée à l'attention du conseil juridique. Elle consolide, sans les recréer, les éléments épars dans le corps du document afin de faciliter la rédaction des CGV / DPA / politique de confidentialité et la tenue du registre des traitements (art. 30 RGPD). Toutes les durées et finalités citées sont implémentées dans le code (références entre crochets) ; toute évolution doit être propagée simultanément ici, dans le code et dans les documents contractuels publiés.

### 24.1 Sous-processeurs (art. 28 RGPD)

Le service est hébergé en France et la chaîne de sous-traitance est volontairement limitée. Liste exhaustive à date :

| Sous-processeur | Localisation | Finalité | Données traitées | Encadrement |
|---|---|---|---|---|
| **OVHcloud (OVH SAS)** | France (datacenter Roubaix / Gravelines) | Hébergement serveur dédié + sauvegardes Object Storage | Toutes données plateforme (base SQL, uploads, logs) | DPA OVHcloud signé, hébergement UE strict, certifications ISO 27001 / HDS partielle (selon offre souscrite) |
| **Stripe Payments Europe Ltd** | Irlande (UE) | Encaissement abonnements, traitement CB | Données de facturation : email admin, raison sociale, identifiant entreprise, montant, IP de paiement, 4 derniers chiffres CB | DPA Stripe inclus dans les conditions Stripe Connect, certifié PCI-DSS niveau 1 |
| **HIBP (Have I Been Pwned)** | Royaume-Uni (décision d'adéquation UE en vigueur) | Vérification de mot de passe compromis | **Aucune PII transférée** — seuls les 5 premiers hex du SHA-1 du mot de passe (k-anonymity) ; le mot de passe complet ni le hash complet ne sortent jamais | Pas de DPA requis (pas de donnée personnelle au sens RGPD ; cf. note ci-dessous) |
| **api-recherche-entreprises.fr** | France (DINUM, service public) | Validation SIRET au signup | Identifiant SIRET (donnée publique INSEE) | Service public ouvert, pas de DPA — donnée publique légalement |
| **cbeapi.be** | Belgique (UE) | Validation BCE au signup | Identifiant BCE (donnée publique) | Idem, donnée publique légalement |
| **restcountries.com** | UE (hébergement Hetzner DE / FR selon CDN) | Liste pays + drapeaux au signup | **Aucune donnée utilisateur transmise** — appel statique côté navigateur, charge un JSON public | Pas de transfert de données utilisateur |
| **OpenRouter Inc.** | États-Unis | Inférence LLM pour l'assistant IA contextuel (RAG, plan Premium uniquement) | Extrait du document consulté (chunk de ~500 tokens) + question utilisateur | **Transfert hors UE** encadré par CCT (clauses contractuelles types) ou Data Privacy Framework selon statut. **Option Anthropic UE** disponible en alternative. **Désactivable** par tenant Premium (feature flag `RagAi`) |
| **Expo Push API (Expo Inc.)** | États-Unis | Acheminement des notifications push mobile | Token Expo (identifiant opaque), corps de notification (titre/texte uniquement, pas de PII détaillée) | Service technique pass-through ; corps des notifications conçus pour ne pas révéler de PII sensible (« Une demande de congé est en attente », pas le nom du salarié) |
| **OVH SMTP (ssl0.ovh.net)** | France | Envoi d'emails transactionnels (welcome, alertes, reset password, alerte nouvel appareil) | Adresse email, contenu de l'email | Inclus dans le contrat d'hébergement OVHcloud |
| **Let's Encrypt** | États-Unis (ISRG) | Émission certificats TLS | Nom de domaine uniquement (CT log public) | Pas de PII utilisateur |
| **Apple Push Notification Service** *(roadmap mobile)* | États-Unis | Push iOS | Token APNs, corps notification | CCT applicables, opt-in utilisateur via permissions OS |
| **Google Firebase Cloud Messaging** *(roadmap mobile)* | États-Unis | Push Android | Token FCM, corps notification | CCT applicables, opt-in utilisateur via permissions OS |

> **Note HIBP / k-anonymity** : le protocole *Pwned Passwords* envoie au serveur HIBP les **5 premiers caractères hexadécimaux** du SHA-1 du mot de passe ; il reçoit en retour une liste de hashes suffixes complétant ce préfixe, et la comparaison finale a lieu **côté serveur Concorde**. Le mot de passe en clair, son hash complet, et l'identité de l'utilisateur ne sortent à aucun moment de notre infrastructure. La CNIL et l'ICO britannique considèrent ce protocole comme **non-identifiant** ; il n'est donc pas qualifié de transfert de données personnelles au sens RGPD.

### 24.2 Bases légales de traitement (art. 6 RGPD)

| Finalité | Base légale | Référence interne |
|---|---|---|
| Fourniture du service (gestion comptes, pointage, congés, paie, coffre, signature) | **Exécution du contrat** (art. 6.1.b) | CGV §3 *Objet du contrat* |
| Facturation et encaissement | **Exécution du contrat** + **Obligation légale** (art. 6.1.c, Code de commerce art. L.123-22) | §11.3, §3.12 |
| Conservation des bulletins de paie et contrats salariés | **Obligation légale** (Code du travail art. L.3243-4 — 5 ans ; art. D.3171-16 — 5 ans pointage) | §23.5 |
| Anti-fraude SIRET / index unique filtré | **Intérêt légitime** (art. 6.1.f) — prévention de la fraude commerciale ; documenté par AIPD interne | §6.5 |
| Vérification HIBP, lockout, alerte nouvel appareil | **Obligation légale de sécurité** (art. 32 RGPD) + **Intérêt légitime** | §3.1, §6.5 |
| Géolocalisation au pointage | **Exécution du contrat de travail** côté client final + **Information préalable des salariés** (Code du travail art. L.1222-4, jurisprudence Cass. soc. 3 nov. 2011) | §3.4 — l'éditeur fournit l'outil, le tenant (employeur) est responsable de la base légale opérationnelle |
| Notifications push commerciales / rappels essai | **Consentement** (art. 6.1.a) — opt-in via `NotificationUserSettings` | §3.9 |
| Logs d'audit et journalisation sécurité | **Obligation légale de sécurité** (art. 32 RGPD) + **Intérêt légitime** | §6.1, table `AuditLog` |
| Assistant IA (RAG) | **Consentement** explicite tenant Premium (feature opt-in) ; transfert hors UE encadré | §3.11, §24.1 |

### 24.3 Durées de conservation des données

Politique de rétention par catégorie. Les durées « légales » s'imposent ; les durées « contractuelles » sont configurables par tenant dans les limites des minimums légaux.

| Catégorie | Durée | Fondement | Mise en œuvre |
|---|---|---|---|
| **Compte utilisateur actif** | Pendant la durée du contrat + 30 j de grâce | Contrat | Soft-delete après inactivité, suppression effective sur demande |
| **Bulletins de paie générés** | 5 ans (Code du travail art. L.3243-4) | Légal | Coffre numérique chiffré, purge automatique au-delà sauf instruction tenant |
| **Données de pointage / présence** | 5 ans (art. D.3171-16) — souvent 1 à 3 ans en pratique selon politique tenant | Légal min., contractuel | Table `Presence`, archivage froid au-delà de 13 mois |
| **Coordonnées GPS journalisées au pointage** | **12 mois maximum** par défaut (recommandation CNIL secteur RH) | CNIL — délibération 2018-101 et lignes directrices | Configurable côté tenant, purge planifiée |
| **Logs de connexion / authentification** | 12 mois | LCEN art. 6-II + recommandations ANSSI/CNIL | Table `AuditLog`, rotation logs nginx 12 mois |
| **Refresh tokens / sessions** | Inactif > 30 j → révoqué automatiquement ; quota 5 actifs max/utilisateur | Sécurité art. 32 | Cleanup background + quota G6 |
| **Données de facturation Stripe** | 10 ans (Code de commerce art. L.123-22 — pièces comptables) | Légal | Stripe conserve nativement ; pas de duplication locale au-delà du nécessaire |
| **Tenant résilié** | **90 jours en rétention** post-résiliation (réactivation self-service) → puis suppression effective | Contractuel + RGPD *droit à l'effacement* (art. 17) | §3.12, statut `Cancelled`, purge planifiée J+90 |
| **Données après droit à l'effacement** | 30 j de délai technique max (sauf obligation légale concurrente, ex : paie 5 ans) | RGPD art. 17, 12 | Procédure documentée, registre des suppressions |
| **Embeddings RAG (Premium)** | Durée du contrat + suppression à la résiliation | Contractuel | Qdrant collections par tenant, purgeables |
| **Sauvegardes chiffrées** | 30 j rolling + 1 sauvegarde fin de mois × 12 | Contrat de service / RTO | §23.4 |

### 24.4 Récapitulatif des engagements contractuels

Synthèse des engagements de l'éditeur opposables au client, à reprendre tels quels (ou à raffiner) dans les CGV.

| Engagement | Modalité actuelle | Référence |
|---|---|---|
| **Essai gratuit** | 30 jours sur tous les plans (Starter / Standard / Premium), **sans carte bancaire requise**, accès aux modules du plan choisi | §11.3 |
| **Durée d'engagement** | Sans engagement de durée. L'utilisateur résilie à tout moment | §11.3 |
| **Résiliation à l'échéance** | Accès maintenu jusqu'au terme de la période payée, aucune facturation ultérieure | §11.3, §3.12 |
| **Résiliation immédiate — mensuel** | Effet instantané, **pas de remboursement** du mois en cours | §11.3 |
| **Résiliation immédiate — annuel** | Effet instantané, **remboursement prorata temporis automatique** sur la CB d'origine via Stripe Refund API, délai bancaire 5–10 jours ouvrés | §11.3, [StripeBillingService.IssueProratedRefundAsync](ABRPOINT.Server/Billing/StripeBillingService.cs) |
| **Rétention post-résiliation** | 90 jours de réactivation self-service avec récupération intégrale des données ; au-delà, suppression effective (sauf obligations légales concurrentes : bulletins de paie 5 ans) | §3.12 |
| **Hébergement** | France (OVH datacenter Roubaix / Gravelines) — données primaires et sauvegardes en UE | §24.1, §23.5 |
| **Conformité RGPD** | Plateforme conçue *privacy by design*, DPA disponible, registre des traitements interne tenu | §23.5 |
| **Sécurité** | Mesures techniques conformes art. 32 RGPD (chiffrement transport TLS 1.2+, chiffrement repos LUKS, BCrypt mots de passe, refresh tokens chiffrés AES, lockout, HIBP, alerte nouvel appareil) | §6, §6.5 |
| **Disponibilité** | SLA Standard 99 % (V1), Premium 99,9 % (palier roadmap) | §23.6 |
| **Notification d'incident de sécurité** | Notification client sous 72 h conformément à l'art. 33 RGPD si fuite de données personnelles affecte ses utilisateurs | À formaliser CGV §[XX] |
| **Audit client** | Possibilité pour le client de demander un audit annuel de conformité (modalités à préciser CGV, préavis raisonnable, frais éventuels) | À formaliser CGV §[XX] |
| **Signature électronique** | Valeur probante de niveau « simple » au sens eIDAS (règlement UE 910/2014) — horodatage, IP signataire, hash document conservés ; **pas qualifiée** (sans certificat de signature électronique avancée) | §3.8 |
| **Validation identifiant entreprise** | SIRET / BCE / ICE / NINEA vérifiés contre registres officiels au signup ; un même établissement ne peut bénéficier que d'un essai gratuit à la fois | §3.12, §6.5 |

### 24.5 Transferts internationaux et garanties

| Transfert | Justification | Garantie applicable |
|---|---|---|
| **HIBP (UK)** | Pas un transfert de données personnelles (k-anonymity, cf. §24.1) | Sans objet |
| **OpenRouter (US)** | Sous-traitant IA pour la fonctionnalité RAG Premium | Clauses contractuelles types UE→US et/ou inscription DPF, **opt-in** au niveau du tenant via feature flag |
| **Expo Push (US), Let's Encrypt (US)** | Services techniques (push token, certificats domaine) | Pas de PII utilisateur transférée ; CCT applicables |
| **APNs / FCM (US)** | Notifications mobile via stores | Inhérent aux écosystèmes Apple / Google, opt-in via permissions OS |

### 24.6 Trous à combler côté juridique (action attendue)

Éléments **non couverts** par le code et qui doivent être produits / publiés par le département juridique :

- [ ] **CGV / CGU** finalisées et opposables, intégrant les engagements §24.4
- [ ] **Mentions légales** publiques (RCS, capital social, identité du DPO si désigné, contact, hébergeur)
- [ ] **Politique de confidentialité** publique (URL HTTPS obligatoire pour soumission App Store / Play Store, cf. §14.3)
- [ ] **DPA-type** (modèle d'accord de sous-traitance) annexable aux contrats clients
- [ ] **Privacy Manifest iOS** (iOS 17+, requis Apple) — déclaration des APIs sensibles utilisées
- [ ] **Data Safety Google Play** — alignement des données déclarées avec la réalité collectée
- [ ] **Registre des traitements** RGPD (art. 30) tenu côté éditeur ; modèle disponible auprès de la CNIL
- [ ] **Analyse d'impact (AIPD/PIA)** sur le traitement « pointage géolocalisé » et sur le traitement « signature électronique avec stockage IP » — recommandé par la CNIL pour ce type de traitement RH
- [ ] **Procédure interne de notification de violation** (art. 33 — 72 h) — chaîne de responsabilité interne, modèle de notification client
- [ ] **Procédure de demande RGPD** (accès, rectification, effacement, portabilité) — formulaire et SLA de réponse 1 mois (art. 12)
- [ ] **Désignation d'un DPO** — recommandée mais non obligatoire au sens strict (l'éditeur ne fait pas du traitement à grande échelle au sens art. 37) ; le tenant employeur peut être tenu de désigner le sien

---

## 25. Conclusion

La plateforme est dans un état de **maturité fonctionnelle élevée** : modules métier complets, multi-tenant opérationnel avec auto-migration de schéma, calculs paie couverts par tests, sécurité socle forte (JWT + 2FA + permissions matricielles + multi-tenant scoping) **et durcissements mobiles bancaires** (cert pinning, bio-token, device trust, screenshot blocking, auto-lock, RT quota) — ces deux derniers gatés Premium au runtime. La **v3 ajoute une couche anti-fraude au signup** (identifiant entreprise vérifié auprès des registres officiels Sirene/CBE, index unique filtré pour empêcher la multi-inscription gratuite, sélecteur pays FR/BE/MA/SN dynamique) **et un durcissement de l'authentification** (lockout progressif, vérification HIBP des mots de passe, alerte instantanée sur nouvel appareil avec révocation HMAC). Côté paiement, **idempotence Stripe Checkout**, **anti-replay des webhooks** et **validation server-side du userCount** ferment les vecteurs classiques (double facturation, rejeu, sous-déclaration).

La **tarification commerciale est désormais verrouillée** (Starter 29,50 € / Standard 59,50 € / Premium 119 €) avec un modèle forfait + overage par salarié, période d'essai 30 jours sans CB, et facturation Stripe à 2 items (base + seat) avec synchronisation automatique de la quantité seats par job de fond quotidien. La **politique de résiliation** est alignée sur l'engagement payé d'avance : **remboursement prorata temporis automatique sur les abonnements annuels** (Refund API Stripe vers la carte d'origine, métadonnées tracées pour audit) ; les abonnements mensuels conservent l'usage SaaS B2B standard (mois en cours dû, pas de remboursement).

Le **plan gating est appliqué de bout en bout** : couche backend (`RequirePlanFeatureAttribute`), couche frontend (`planAllows` dans `useAuth`), couche mobile (hooks de sécurité conditionnés au plan, `/MobileAuth/me` expose `planFeatures`). Un tenant Starter ne peut pas accéder à l'app mobile, ni au coffre, ni à la signature, ni au reporting avancé, ni à l'IA — y compris par appel direct à l'API.

Les **trois axes prioritaires** de la phase de mise en production sont :
1. **Continuité de service** (sauvegardes testées, monitoring, alerting) — plan détaillé §23, déploiement planifié sur le serveur OVH KS-5-B nouvellement provisionné
2. **Audit sécurité externe** (pen-test indépendant) — démarche complémentaire de validation pour les clients Premium, planifiée avant l'ouverture commerciale du palier Premium
3. **Tests de charge** sur le serveur dédié final, validant les capacités annoncées dans le SLA

Le code est globalement sain (commentaires explicatifs sur les décisions de sécurité, tests sur les calculs critiques, compilation TypeScript stricte côté frontend, séparation des préoccupations propre, auto-migration robuste).

L'architecture multi-tenant choisie (DB-per-tenant) est adaptée au segment PME/ETI ciblé et offre une isolation forte entre clients. Elle pourra évoluer vers un modèle hybride (DB partagée pour les très petits tenants, DB dédiée pour les comptes Premium) si la croissance le justifie.

La stratégie commerciale tri-marché (France / Belgique / Afrique francophone) est cohérente avec les capacités techniques (multi-devise, skew horloge DST-safe, mobile-first), et la nouvelle structure tarifaire à 3 paliers couvre l'ensemble du spectre TPE / PME / ETI sans laisser de zone de friction (le pack Starter est le sas d'entrée commercial, Premium devient la cible naturelle dès 50+ salariés ou besoin sécurité renforcée).

---

*Document généré à partir de l'inventaire de la base de code à date — 64 contrôleurs API, 131 entités EF, 22 écrans mobile, ~30 modules web. **Version 3 du 2026-05-13** : intègre la couche anti-fraude au signup (validation SIRET/BCE/ICE/NINEA + index unique filtré + sélecteur pays FR/BE/MA/SN), le durcissement de l'authentification (lockout progressif, HIBP, alerte nouvel appareil + révocation HMAC), les protections paiement (idempotence Stripe, anti-replay webhooks, validation server-side du userCount) et la politique de remboursement prorata temporis sur les abonnements annuels résiliés en cours de période. Mises à jour à chaque itération significative.*
