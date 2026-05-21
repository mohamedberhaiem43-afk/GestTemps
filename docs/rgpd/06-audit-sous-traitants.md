# Audit des sous-traitants ultérieurs — Annexe II du DPA

**Article 28 RGPD** — version 1.0 — dernière mise à jour : 2026-05-20

> **Objet** : ce document recense de manière exhaustive les sous-traitants
> ultérieurs auxquels Concorde recourt pour fournir le Service. Il fait office
> d'**Annexe II du Data Processing Agreement** (DPA) signé avec chacun des
> clients responsables de traitement.
>
> **Mécanisme d'information** : conformément à l'article 28.2 du RGPD,
> l'ajout ou le remplacement d'un sous-traitant ultérieur est notifié aux
> clients avec un préavis de **30 jours** ; chaque client dispose alors d'un
> droit d'opposition motivé. À défaut d'opposition dans ce délai, le
> changement est réputé accepté.
>
> **Statut DPA** :
> - ✅ Contrat signé et archivé
> - ⏳ Contrat en cours de négociation / signature
> - ⚠️ DPA standard de l'éditeur appliqué (clauses publiques acceptées) — à
>   formaliser par signature électronique
> - ❌ Pas de DPA — action immédiate requise

---

## 1. Tableau de synthèse

| # | Sous-traitant | Service | Lieu de traitement | Données traitées | Cadre transfert | DPA |
|---|---|---|---|---|---|---|
| 1 | **OVH SAS** | Hébergement infrastructure (serveurs, bases de données) | France (UE) | Toutes les données du tenant | UE — pas de transfert | ⚠️ DPA OVH standard à signer |
| 2 | **Amazon Web Services EMEA SARL** | Sauvegardes chiffrées hors site (S3) | Région UE (eu-west-3 Paris ou eu-central-1 Frankfurt) | Dumps chiffrés AES-256-CBC de l'ensemble des tenants (clé `BACKUP_ENC_KEY` détenue uniquement par Concorde) | UE — pas de transfert | ⚠️ DPA AWS (clauses publiques) à formaliser |
| 3 | **Stripe Payments Europe Ltd.** | Traitement des paiements (abonnements, webhooks, refunds) | Irlande (UE) + sous-traitance vers Stripe Inc. (US) | Coordonnées de facturation du client B2B (raison sociale, email, adresse, montants). **Aucune donnée RH des salariés du client n'est transmise à Stripe.** | CCT 2021 + DPF | ⚠️ DPA Stripe (clauses publiques) à formaliser |
| 4 | **Expo Application Services LLC** | Distribution APK/IPA + service de push (Apple APNs, Google FCM en bout de chaîne) | États-Unis | Identifiant push de l'appareil, identifiant interne utilisateur, plateforme | CCT 2021 | ⚠️ DPA Expo à signer |
| 5 | **Apple Distribution International Ltd.** | Apple Push Notification service (APNs) | Irlande (UE) + États-Unis | Identifiant push iOS, contenu de la notification | CCT 2021 + DPF | ⚠️ ADL / DPA Apple à signer |
| 6 | **Google Ireland Ltd.** | Firebase Cloud Messaging (FCM) — notifications Android | Irlande (UE) + États-Unis | Identifiant push Android, contenu de la notification | CCT 2021 + DPF | ⚠️ DPA Google Cloud à signer |
| 7 | **OpenRouter, Inc.** | Routage LLM pour l'assistant IA (option dev uniquement — **désactivé par défaut depuis v1.0**) | États-Unis | Question de l'utilisateur, extraits récupérés du tenant (CIN automatiquement masqué avant transmission ; `provider.data_collection=deny` + `provider.allow_fallbacks=false` ajoutés en defense in depth) | CCT 2021 — clause « no training » technique | ⚠️ Non activé en production — option dev seulement |
| 8 | **Anthropic PBC** | **LLM par défaut** pour l'assistant IA (compte Enterprise, résidence UE) | Région UE | Question + extraits (CIN masqué) | UE — pas de transfert | ⚠️ DPA Anthropic à signer + activer la résidence UE sur le compte Enterprise |
| 9 | **OVH SAS — service SMTP** | Envoi des emails transactionnels (reset MDP, alertes, notifications) | France (UE) | Email destinataire, contenu du message | UE — pas de transfert | ✅ Couvert par le DPA OVH global (cf. #1) |
| 10 | **Let's Encrypt (ISRG)** | Émission automatisée des certificats TLS | États-Unis | Nom de domaine uniquement (aucune donnée personnelle) | Sans objet — pas de PII | Sans objet |
| 11 | **api-recherche-entreprises.fr (INSEE)** | Validation SIRET au signup France | France (UE) | SIRET / raison sociale soumis pour vérification | UE — pas de transfert | Service public — pas de DPA |
| 12 | **cbeapi.be** | Validation BCE au signup Belgique | Belgique (UE) | BCE soumis pour vérification | UE — pas de transfert | ⚠️ Conditions d'utilisation à archiver |
| 13 | **api.pwnedpasswords.com (HIBP)** | Vérification anti-réutilisation de mot de passe (k-anonymity SHA-1) | Royaume-Uni | Préfixe 5 caractères du hash SHA-1 du mot de passe (5 caractères — pas de PII) | RU — décision d'adéquation Commission UE 2021/1772 | Sans objet — pas de PII transmise |
| 14 | **Qdrant** | Vector store auto-hébergé pour la recherche sémantique RAG | Conteneur Docker dans l'infrastructure OVH (France) | Embeddings des documents du tenant | UE — pas de transfert | Sans objet — auto-hébergé |
| 15 | **Comptable / expert-comptable** | Tenue de la comptabilité Concorde | France (UE) | Factures clients (raison sociale, montants, échéances) | UE — pas de transfert | [À COMPLÉTER — DPA à signer si applicable] |

---

## 2. Fiche détaillée par sous-traitant

### 2.1. OVH SAS (#1)

| Rubrique | Valeur |
|---|---|
| Coordonnées | 2 rue Kellermann, 59100 Roubaix, France — RCS Lille 424 761 419 |
| Engagement contractuel | DPA OVH cloud — version applicable au [À COMPLÉTER — date de signature] |
| Garanties RGPD | Hébergement UE certifié ISO 27001, ISO 27017, ISO 27018, HDS, SecNumCloud (sur offres concernées) |
| Sous-traitants ultérieurs de OVH | Listés publiquement par OVH ; consultables sur leur site |
| Délai notification de violation | 72 h à compter de la connaissance |
| Audit | Rapports d'audit ISO/SOC mis à disposition |
| Localisation effective | Datacenters France (Roubaix, Strasbourg, Gravelines) |

### 2.2. Amazon Web Services EMEA SARL (#2)

| Rubrique | Valeur |
|---|---|
| Coordonnées | 38 avenue John F. Kennedy, L-1855 Luxembourg |
| Engagement contractuel | AWS GDPR DPA — annexes CCT 2021 module 2 (RT→ST) |
| Garanties | ISO 27001, ISO 27017, ISO 27018, SOC 2, certification eIDAS |
| Région utilisée | **eu-west-3 (Paris)** ou **eu-central-1 (Frankfurt)** uniquement — garde-fou applicatif dans `scripts/backup.sh` |
| Chiffrement | (1) Chiffrement **côté client** AES-256-CBC + PBKDF2 100 000 itérations avant upload ; (2) SSE-S3 AES-256 côté serveur ; (3) Object Lock + versioning + bucket policy SSE forcée |
| Clé de chiffrement | Détenue par Concorde uniquement — jamais stockée sur S3 |

### 2.3. Stripe Payments Europe Ltd. (#3)

| Rubrique | Valeur |
|---|---|
| Coordonnées | 1 Grand Canal Street Lower, Grand Canal Dock, Dublin, Irlande |
| Engagement contractuel | Stripe DPA — version publique acceptée à l'activation du compte |
| Périmètre des données | Coordonnées de facturation **du client B2B uniquement** (jamais des salariés des clients) |
| Stockage du PAN | Stripe Vault — Concorde ne stocke jamais le numéro de carte (PCI-DSS niveau 1) |
| Transferts | Stripe Inc. (US) en sous-traitance — CCT module 3 |

### 2.4. Expo Application Services LLC (#4)

| Rubrique | Valeur |
|---|---|
| Coordonnées | États-Unis |
| Engagement contractuel | Expo Application Services Agreement + DPA |
| Périmètre | Distribution APK/IPA (build EAS), service de push relay vers APNs/FCM |
| Données | Identifiant push de l'appareil, identifiant interne utilisateur (anonymisé), métadonnées de plateforme |
| Conservation chez Expo | Selon la configuration du compte EAS (à vérifier) |

### 2.5. OpenRouter, Inc. (#7)

| Rubrique | Valeur |
|---|---|
| Coordonnées | États-Unis |
| Engagement contractuel | OpenRouter Terms + addendum « no training » |
| Statut en production | **Désactivé par défaut depuis v1.0** — `Rag:Anthropic:UseOpenRouter = false`. Conservé uniquement comme option de développement. Toute réactivation en production exige une décision documentée par le DPO. |
| Périmètre (si réactivé) | Routage transparent vers Llama 3 / DeepSeek / Gemini 2.0 Flash (selon configuration `appsettings.json:Rag`) |
| Données transmises (si réactivé) | Question utilisateur + extraits du tenant (CIN automatiquement masqué via `EncryptionService` avant transmission) |
| Defense in depth (si réactivé) | Chaque requête inclut `provider.data_collection = "deny"` et `provider.allow_fallbacks = false` (cf. `Services/Rag/ClaudeRagService.cs`) — bloque l'entraînement et empêche le fallback vers un provider non choisi |

### 2.6. Anthropic PBC (#8) — **LLM par défaut**

| Rubrique | Valeur |
|---|---|
| Coordonnées | San Francisco, US — entité UE Anthropic EU (Irlande) |
| Engagement contractuel | Anthropic Commercial Terms + DPA + Privacy Policy |
| Statut en production | **Provider LLM par défaut** depuis v1.0 (`Rag:Anthropic:UseOpenRouter = false`) |
| Région utilisée | UE — paramétrable via `Rag:Anthropic:BaseUrl`. La résidence UE doit être activée sur le compte Anthropic Enterprise (clause contractuelle « data residency: EU »). Sans cette activation contractuelle, l'endpoint par défaut `https://api.anthropic.com` peut router vers des datacenters US — la configuration UE Enterprise est donc **obligatoire** avant le go-live. |
| Conservation des prompts | Selon politique Anthropic (zéro rétention sur demande pour les comptes Enterprise — à confirmer dans l'addendum DPA) |
| Pas de réutilisation | Clause contractuelle interdisant l'utilisation des prompts pour l'entraînement |
| Action ops obligatoire | (1) Souscrire au plan Enterprise Anthropic ; (2) activer la résidence UE sur le compte ; (3) confirmer l'absence de rétention dans l'addendum ; (4) archiver le DPA signé |

---

## 3. Processus de gestion des sous-traitants

### 3.1. Admission d'un nouveau sous-traitant

| Étape | Responsable | Critères |
|---|---|---|
| 1. Évaluation du besoin | Tech lead | Existe-t-il une alternative UE/auto-hébergée raisonnable ? |
| 2. Due diligence | DPO + Tech lead | Politique de confidentialité, DPA disponible, certifications (ISO 27001, SOC 2, HDS…), localisation des serveurs, antécédents de violation |
| 3. Signature du DPA | Direction + DPO | DPA contractuel signé avant tout début de traitement |
| 4. Notification aux clients | DPO | Préavis 30 j, par email aux contacts DPO/admin tenants |
| 5. Mise à jour du présent document | DPO | Versionner ce fichier en Git |

### 3.2. Notification de violation par un sous-traitant

En cas de violation chez un sous-traitant, ce dernier doit notifier Concorde
**sans retard injustifié** (en pratique, 24 à 72 h selon les contrats).
Concorde notifie alors :

- la **CNIL** dans les 72 h si la violation présente un risque pour les
  personnes (art. 33) ;
- les **clients RT** impactés sans retard, pour leur permettre de notifier
  leurs propres salariés si nécessaire (art. 34).

### 3.3. Audit

Concorde se réserve le droit d'auditer chaque sous-traitant (sur pièces, ou
sur site selon les contrats) **une fois par an** au minimum, et à tout moment
en cas de soupçon d'incident.

---

## 4. Actions immédiates avant publication des CGU

| # | Action | Responsable | Échéance |
|---|---|---|---|
| 1 | Vérifier la signature du DPA OVH | DPO | Avant publication |
| 2 | Activer formellement AWS GDPR DPA (case à cocher dans la console AWS) | Ops | Avant publication |
| 3 | Vérifier la signature du DPA Stripe (case à cocher dans le compte Stripe) | DPO | Avant publication |
| 4 | Vérifier la signature du DPA Expo / Apple / Google | Dev mobile | Avant publication |
| 5 | Vérifier la signature du DPA OpenRouter + Anthropic | DPO | Avant publication |
| 6 | Trancher : OpenRouter (US, CCT) vs Anthropic UE par défaut | Direction + DPO | Décision à documenter |
| 7 | Archiver tous les DPA signés dans un coffre-fort interne (Bitwarden « DPA » ou équivalent) | DPO | À chaque signature |
| 8 | Mettre à jour le présent document à chaque ajout/retrait de sous-traitant | DPO | Continu |

---

**Documents liés :**
- [Registre des traitements](./01-registre-traitements.md)
- [Politique de confidentialité](./04-politique-confidentialite.md)
- [Procédure d'exercice des droits](./03-procedure-droits-personnes.md)
- [AIPD pointage RH](./02-aipd-pointage-rh.md)
- [Checklist sécurité infrastructure](../SECURITY_INFRA_CHECKLIST.md)
