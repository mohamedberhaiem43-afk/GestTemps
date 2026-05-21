# Analyse d'impact relative à la protection des données (AIPD)

**Module : pointage RH + géolocalisation + assistance IA**
**Article 35 RGPD** — version 1.0 — date : 2026-05-20

> **Pourquoi une AIPD est obligatoire pour ce traitement** : le pointage des
> employés constitue une **surveillance systématique** (CNIL, liste de
> traitements soumis à AIPD du 11/10/2018, point 7) ; combiné à de la
> **géolocalisation** au moment du pointage et à un **scoring IA** sur
> documents, il dépasse à plusieurs titres le seuil de l'article 35.3 du
> RGPD. L'AIPD doit être faite **avant** la mise en production effective
> chez chaque client, et révisée à chaque évolution majeure.
>
> Cette AIPD est rédigée par Concorde **en tant que sous-traitant** (art. 28)
> pour aider chacun de ses clients responsables de traitement à conduire la
> leur. Le client reste seul juge de l'opportunité et des mesures finales.

---

## 1. Description systématique du traitement

### 1.1. Nature, portée, contexte et finalités

| Rubrique | Description |
|---|---|
| **Nature** | Traitement automatisé de données personnelles RH dans un SaaS multi-tenant (PostgreSQL par tenant, isolation logique stricte, hébergement OVH France) |
| **Portée** | Tous les salariés des entreprises clientes utilisatrices du module pointage |
| **Volumétrie cible** | De 5 à 500 salariés par client. Multi-tenants : volumétrie agrégée potentielle 10 000+ personnes physiques |
| **Contexte** | Service B2B de gestion du temps et des activités RH. Le client est responsable de traitement, Concorde est sous-traitant |
| **Finalités principales** | (1) Contrôle des temps de présence et conformité contractuelle ; (2) Préparation de la paie ; (3) Gestion des congés et absences ; (4) Coffre-fort numérique et signature ; (5) Assistance IA contextualisée aux documents internes du client |

### 1.2. Données traitées

Cf. [Registre des traitements §III T-ST-01](./01-registre-traitements.md).
Liste synthétique des PII traitées :
- **Identification** : nom, prénom, photo, n° matricule, CIN ou équivalent national, date de naissance, sexe, situation familiale
- **Coordonnées** : email pro, téléphone, mobile, adresse
- **Vie professionnelle** : poste, fonction, service, direction, horaires, contrat
- **Rémunération** : salaires (base, brut, net), primes, rubriques
- **Pointage** : entrées/sorties horodatées, **coordonnées GPS** au moment du pointage (lat/lon)
- **Congés/absences** : dates, motifs, soldes
- **Documents** : bulletins, contrats, justificatifs (susceptibles de contenir des données de santé déposées par le salarié — ex. arrêt maladie)
- **Authentification** : hash BCrypt du mot de passe, secret TOTP, jetons de session, empreinte d'appareil hashée
- **Logs d'audit** : actions sensibles horodatées (rétention 6 mois)
- **IA / RAG** : historique des questions de l'utilisateur et extraits retournés (rétention 90 j)

### 1.3. Acteurs

| Acteur | Rôle RGPD |
|---|---|
| Client utilisateur (entreprise) | Responsable de traitement |
| Concorde | Sous-traitant (art. 28) |
| OVH | Sous-traitant ultérieur — hébergement |
| Stripe | Sous-traitant ultérieur — paiement (relation Concorde ↔ client uniquement, pas PII salariés) |
| OpenRouter / Anthropic | Sous-traitant ultérieur — IA |
| Expo / Apple / Google | Sous-traitant ultérieur — push mobile |
| AWS (S3 EU) | Sous-traitant ultérieur — sauvegardes |
| Salariés du client | Personnes concernées |

### 1.4. Référentiels et standards applicables

- RGPD (Règlement UE 2016/679)
- Loi Informatique et Libertés (modifiée 2018)
- Code du travail français — art. L1121-1, L1222-4, L2312-38, L3171-1 et suivants
- Recommandations CNIL : « Pointage et badgeage » (mise à jour 2024), « Géolocalisation des véhicules » (par analogie), « Vidéosurveillance au travail »
- ANSSI : recommandations de sécurisation des architectures SaaS

---

## 2. Évaluation de la nécessité et de la proportionnalité

### 2.1. Bases légales mobilisées (au niveau du client RT)

| Finalité | Base légale | Justification |
|---|---|---|
| Pointage horaire | Obligation légale (art. 6.1.c) — art. L3171-2 du Code du travail | Le décompte des heures effectuées est obligatoire pour l'employeur |
| Préparation de la paie | Obligation légale (art. 6.1.c) | Émission des bulletins, déclarations sociales |
| Géolocalisation au pointage | Intérêt légitime (art. 6.1.f) — proportionné | Uniquement au moment du pointage ; jamais de suivi continu. Mode `off / warn / reject` paramétrable (`appsettings.json:GeoZones`) — peut être désactivé par le client |
| Congés/absences | Exécution du contrat (art. 6.1.b) | Inhérente à la relation de travail |
| Coffre-fort numérique | Exécution du contrat / intérêt légitime | Stockage sécurisé des documents contractuels |
| Signature électronique | Consentement (art. 6.1.a) au moment de chaque signature | Modèle eIDAS niveau « simple » par défaut |
| Assistance IA | Intérêt légitime (gestion documentaire) | Activable / désactivable par feature flag par client |
| Authentification & sécurité | Intérêt légitime + obligation légale (art. 32) | Sécurisation des accès |

### 2.2. Principes RGPD : application au traitement

| Principe | Application |
|---|---|
| **Licéité, loyauté, transparence** | Information aux salariés via la politique de confidentialité client + bandeau cookies + communication interne du client (CSE / règlement intérieur / note de service) |
| **Limitation des finalités** | Chaque finalité a une base légale propre ; pas de réutilisation à d'autres fins (ex. surveillance comportementale) |
| **Minimisation** | CIN automatiquement masqué avant transmission au LLM ; géoloc uniquement au pointage ; IP tronquée dans `known_devices.ip_prefix` ; champs facultatifs identifiés en BDD |
| **Exactitude** | Le salarié peut demander rectification via la procédure §3 (cf. document `03-procedure-droits-personnes.md`) |
| **Limitation de la conservation** | Audit logs 6 mois, refresh tokens rotatifs, RAG 90 j, données du tenant 90 j après résiliation puis suppression |
| **Intégrité et confidentialité** | Cf. CGU section II et `SECURITY_INFRA_CHECKLIST.md` |
| **Responsabilité (accountability)** | Tenue du présent registre, AIPD, journaux d'accès, formation des équipes, audits sous-traitants |

---

## 3. Évaluation des risques pour les droits et libertés

### 3.1. Cartographie des risques

| # | Événement redouté | Sources de risques | Vraisemblance | Gravité |
|---|---|---|---|---|
| R1 | **Accès illégitime** aux données RH d'un tenant par un attaquant externe | Vol de credentials, exploitation d'une CVE | Modérée | Importante |
| R2 | **Accès illégitime** aux données d'un tenant par un autre tenant (cross-tenancy leak) | Bug applicatif, oubli d'un filtre tenant | Limitée | Maximale |
| R3 | **Modification non désirée** des données de pointage (fraude) | Mauvaise séparation des rôles, employé manipule ses pointages | Modérée | Modérée |
| R4 | **Disparition** des données (perte de sauvegardes) | Incident hébergeur, ransomware, erreur humaine | Limitée | Importante |
| R5 | **Détournement de finalité** : géoloc utilisée pour surveiller en continu un salarié | Mauvaise configuration côté client | Modérée | Importante |
| R6 | **Réidentification** d'un salarié via un export anonymisé insuffisamment | Croisement avec d'autres bases | Limitée | Modérée |
| R7 | **Fuite via le LLM** (prompt injection ou inclusion accidentelle de PII dans la requête) | Configuration RAG insuffisante | Limitée | Modérée |
| R8 | **Compromission des sauvegardes** | Vol de credentials AWS, bucket mal configuré | Limitée | Importante |

### 3.2. Mesures existantes par risque

| # | Mesures de prévention déjà en place |
|---|---|
| R1 | TLS 1.2+, BCrypt, MFA TOTP, HIBP, verrouillage progressif, alerte nouvel appareil + HMAC, rate limiting, scan vulnérabilités dépendances (Dependabot + workflow `security-scan.yml`) |
| R2 | Isolation par base PostgreSQL distincte par tenant (pas de schéma partagé) ; claim `tenant_slug` obligatoire dans le JWT (`MobileAuthController.cs:614`) ; tests automatisés multi-tenant |
| R3 | Audit log de toute modification critique ; horodatage côté serveur ; séparation des rôles (RBAC) ; durée de conservation 6 mois minimum des logs |
| R4 | Sauvegardes quotidiennes chiffrées AES-256-CBC + PBKDF2 vers S3 EU (`scripts/backup.sh`) ; test de restauration mensuel automatisé (`scripts/restore-test.sh`) ; rotation 7 j / 4 sem / 6 mois ; manifests SHA-256 |
| R5 | Mode `GeoZones:Mode = off` par défaut ; le client active explicitement `warn` ou `reject` ; documentation client recommande l'information CSE ; aucune collecte hors pointage |
| R6 | Pseudonymisation progressive (`EncryptionService` AES-256-GCM sur PII sensibles) ; pas d'export brut de masse sans contrôle d'accès |
| R7 | Masquage automatique des CIN avant transmission au LLM ; option Anthropic UE pour éviter le transfert hors UE ; clause contractuelle « no training » avec OpenRouter et Anthropic |
| R8 | Chiffrement **côté client** des dumps avant upload S3 (clé `BACKUP_ENC_KEY` jamais sur le bucket) ; SSE-S3 en defense-in-depth ; bucket policy refusant tout `PutObject` non chiffré ; IAM role dédié scope minimal |

### 3.3. Risques résiduels après mesures

| # | Risque résiduel | Acceptabilité | Mesures complémentaires planifiées |
|---|---|---|---|
| R1 | Faible — la conjonction MFA + HIBP + lockout + alerte rend très difficile l'usurpation à distance | Acceptable | Pentest externe annuel (cf. D3) |
| R2 | Très faible — bases physiquement séparées, claim JWT vérifié | Acceptable | Tests d'intrusion ciblés multi-tenant |
| R3 | Faible | Acceptable | Sensibilisation des admins clients |
| R4 | Faible — tests de restauration mensuels automatisés | Acceptable | — |
| R5 | **Moyen** — dépend de la configuration que fait chaque client | Conditionnel à l'information CSE/salariés du client | Documentation client à enrichir, modèle de note interne |
| R-mobile | **Faible** — certificate pinning Let's Encrypt CAs + détection émulateur/jailbreak/debug build + télémétrie serveur du trust report | Acceptable | Roadmap V1.2 : ajout `jail-monkey` natif via EAS dev client pour détection root résistante au hooking |
| R6 | Faible | Acceptable | ✅ Pseudonymisation du CIN + téléphone + salaires (Empcin, Emptel, Empsbase, Empsbrut, Empsnet) désormais automatique au niveau EF Core (`EncryptedStringConverter`) — impossibilité technique pour un développeur d'écrire ces champs en clair |
| R7 | Faible — masquage CIN, **Anthropic UE par défaut** depuis v1.0 (`UseOpenRouter=false`) | Acceptable | Renforcer le masquage à d'autres patterns (IBAN, n° SS) |
| R8 | Très faible | Acceptable | Object Lock S3 + rotation `BACKUP_ENC_KEY` annuelle |

---

## 4. Validation

| Validation | Acteur | Date | Signature |
|---|---|---|---|
| Rédaction initiale | [À COMPLÉTER — DPO ou équivalent] | 2026-05-20 | |
| Revue technique | [À COMPLÉTER — CTO Concorde] | | |
| Revue juridique | [À COMPLÉTER — Conseil juridique] | | |
| Information CSE (chez le client) | (Responsabilité du client RT) | | |
| Avis CNIL | Non requis (pas de consultation préalable nécessaire — risques résiduels acceptables après mesures) | | |

---

## 5. Plan d'action et révision

| Action | Échéance | Responsable |
|---|---|---|
| Activation LUKS sur volume Postgres prod | T+4 sem | Ops |
| Pseudonymisation CIN dans tables métier | T+6 sem | Dev |
| Certificate pinning mobile | T+12 sem | Dev mobile |
| Pentest externe annuel | T+12 mois | Direction |
| Révision de la présente AIPD | Tous les 24 mois ou à chaque évolution majeure du module | DPO |

---

**Documents liés :**
- [Registre des traitements](./01-registre-traitements.md)
- [Procédure d'exercice des droits](./03-procedure-droits-personnes.md)
- [Audit des sous-traitants](./06-audit-sous-traitants.md)
- [CGU section II — mesures techniques et organisationnelles](../../) (à insérer dans le contrat client)
- [Checklist sécurité infrastructure](../SECURITY_INFRA_CHECKLIST.md)
