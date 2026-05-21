# Politique de conservation des données

**Article 5.1.e RGPD** (limitation de la conservation) + Art. 32 (sécurité par
minimisation) — version 1.0 — dernière mise à jour : 2026-05-20

> **Objet** : cette politique liste, pour chaque catégorie de données traitée
> par Concorde, la **durée de conservation**, la **base légale** qui la
> justifie, et le **mécanisme effectif** de purge ou d'anonymisation à
> l'issue de cette durée.
>
> Le périmètre est divisé en deux blocs :
> - **Bloc A** : données dont Concorde est RT (CRM, salariés Concorde, contacts site).
> - **Bloc B** : données des clients RT hébergées en tant que ST.

---

## A. Données Concorde RT

### A1. Données du CRM commercial (prospects, clients, anciens clients)

| Catégorie | Durée active | Durée d'archivage | Base légale | Purge effective |
|---|---|---|---|---|
| Prospect contacté, sans conversion | 3 ans depuis dernier contact | — | Intérêt légitime (art. 6.1.f), CNIL recommandation prospection B2B | Suppression manuelle CRM (process trimestriel) |
| Client actif (en contrat) | Durée du contrat | — | Exécution du contrat (art. 6.1.b) | Pas de purge tant que le contrat est actif |
| Ancien client (contrat résilié) | Durée du contrat + 5 ans | Archive intermédiaire 5 ans suppl. (litige, prescription L110-4 Code de commerce) | Obligation légale (factures, défense de droit) | Suppression au terme |
| Factures émises | 10 ans | — | Obligation légale (art. L123-22 Code de commerce) | Archivage à froid puis suppression |

### A2. Données du formulaire de contact public

| Catégorie | Durée | Base légale | Purge effective |
|---|---|---|---|
| Nom, email, téléphone, message | **12 mois** après réponse | Intérêt légitime (art. 6.1.f) | Procédure interne trimestrielle |

### A3. Données des cookies et traceurs sur le site

| Catégorie | Durée | Base légale | Purge effective |
|---|---|---|---|
| Cookie de consentement (`abrpoint.cookie-consent.v2`) | 13 mois (recommandation CNIL) | Consentement / exemption art. 82 LIL | Expiration côté client (localStorage) |
| Mesure d'audience anonymisée (si configurée) | 13 mois max | Exemption CNIL si stricte ou consentement | Côté outil de mesure |
| Cookies session strictement nécessaires | Durée de la session | Exemption art. 82 LIL | Expiration auto |

### A4. Salariés Concorde (équipe interne)

Suivre le **référentiel CNIL « Gestion du personnel »** (mis à jour 2023).
Exemples de durées :

| Catégorie | Durée |
|---|---|
| Candidature non retenue | 2 ans après dernier contact (consentement implicite) |
| Dossier salarié actif | Durée du contrat |
| Bulletins de paie | 5 ans (art. L3243-4 Code du travail) — pour le RT |
| Documents fiscaux (DSN, déclarations) | 6 ans (LPF art. L102B) |
| Élections professionnelles | 5 ans (art. L2314-29 CT) |
| Données médicales (médecine du travail) | Selon convention médecin du travail |
| Données disciplinaires (Sanction) | 3 ans (art. L1332-4 CT — pas plus) |

---

## B. Données des clients (Concorde ST)

> **Note** : pour les données hébergées dans les tenants des clients, la
> durée de conservation **dépend des obligations légales du client RT**.
> Cette section indique les durées **techniques par défaut** côté Concorde,
> qui doivent être **alignées avec la politique propre de chaque client**
> via une configuration tenant ou via les outils d'effacement à la demande.

### B1. Données métier (responsabilité du client RT — durées à titre indicatif France)

| Catégorie | Durée légale recommandée | Implémentation Concorde |
|---|---|---|
| Identification salarié actif (état civil, contact, photo) | Durée du contrat de travail | Conservé tant que `actif='A'` ; à la fin du contrat, l'admin du client passe à `'I'` ou `'D'` |
| Salaire et bulletins (Empsbase, Empsbrut, Empsnet) | 5 ans après émission (art. L3243-4 CT) | **Chiffrement automatique AES-256-GCM** via EF Core ValueConverter ; durée gérée par le client |
| Contrat (Contrat) | 5 ans après fin du contrat | Conservé jusqu'à action d'effacement du client |
| Données fiscales associées (DSN) | 6 ans | Idem |
| Pointages horodatés (`presence`) | 5 ans (preuve de durée du travail, art. L3171-2 CT) | Tables `presence`, `compense`, `conge` conservées pour la durée du contrat + 5 ans typiquement |
| Géolocalisation au pointage (`presence.sitlat`/`sitlon`) | Recommandation CNIL géolocalisation : **30 jours**, exceptionnellement 1 an | À ce jour **conservée avec le pointage** — décision Concorde + chaque client à prendre, purge dédiée à implémenter si politique 30j |
| Documents du coffre-fort numérique | Selon politique du client (typique 5-10 ans) | Stockés chiffrés ; effacement à la demande du client |
| Signatures électroniques | Durée du document signé (souvent 10 ans pour les contrats) | Stockées chiffrées avec l'horodatage |
| Sanctions disciplinaires | 3 ans (art. L1332-4 CT — **maximum légal**) | À surveiller — purge à la demande du client recommandée |
| Données candidat (recrutement) | 2 ans après dernier contact | Tenant-dépendant |
| Salariés sortants | À l'issue : 5 ans de conservation paie puis suppression | **Pas de purge automatique** côté Concorde — responsabilité du client |

### B2. Données techniques de sécurité (purge automatique côté Concorde)

| Table | Durée | Plancher | Implémentation |
|---|---|---|---|
| `audit_log` | 180 jours (6 mois) | 30 jours | `Services/AuditLogRetentionHostedService.cs` (quotidien) |
| `refresh_tokens` | 30 jours après expiration | 7 jours | `Services/DataRetentionHostedService.cs` (quotidien) |
| `known_devices` | 365 jours d'inactivité | 7 jours | Idem |
| `push_tokens` (inactifs) | 90 jours après désactivation | 7 jours | Idem |
| `rag_chat_log` | 90 jours | 7 jours | Idem |
| Sauvegardes S3 EU | Rotation 7 j daily / 4 sem weekly / 6 mois monthly | — | `scripts/backup.sh` |

Toutes les durées sont configurables via `appsettings.json:Security:*` et
`Security:Retention:*` ; un plancher applicatif les empêche d'être abaissées
en dessous d'un minimum forensique.

### B3. Tenants résiliés

| Étape | Durée | Mécanisme |
|---|---|---|
| Préavis post-résiliation (réversibilité possible) | **90 jours** | `tenants.status = 'Cancelled'` ; les données restent en l'état, accessibles uniquement à l'admin tenant pour export |
| Export final | Le client doit faire son export complet pendant ces 90 jours | API d'export (JSON / CSV par tenant) |
| Suppression effective | À J+90, suppression de la base PostgreSQL tenant + révocation des accès | `ProvisioningService.DropTenantAsync` (à activer en script ops automatisé) |
| Sauvegardes S3 du tenant | Rotation normale (max 6 mois) | Aucune intervention manuelle nécessaire |

---

## C. Anonymisation versus suppression

| Cas | Choix |
|---|---|
| Donnée plus utilisée mais conserve une valeur statistique (taux d'absentéisme par mois, sans rattachement à une personne) | **Anonymisation** — agrégation, retrait du Uticod, suppression des champs d'identification directe |
| Donnée plus utile (logs anciens, RT expirés) | **Suppression** pure (DELETE physique) |
| Donnée encore utile mais soumise à minimisation (audit log au-delà de 6 mois) | **Suppression** (la rétention est définie par la finalité, art. 5.1.e) |

L'anonymisation doit être **irréversible** au sens du RGPD : il ne doit
plus être possible, par croisement avec d'autres données disponibles
raisonnablement, de réidentifier la personne. La pseudonymisation
(chiffrement réversible) **ne suffit pas** comme alternative à la
suppression à l'expiration de la durée légale.

---

## D. Procédures d'effacement à la demande

Pour les demandes d'effacement (art. 17 RGPD) reçues hors purge automatique :

| Demande | Procédure |
|---|---|
| Salarié actif demandant l'effacement de ses données pointage | Redirection vers l'employeur (RT). La demande peut être refusée si le contrat est en cours. |
| Ancien salarié demandant l'effacement | Redirection vers l'employeur. Effacement possible après les 5 ans légaux. |
| Client RT demandant l'effacement complet de son tenant | Procédure de résiliation accélérée — suppression à J+30 au lieu de J+90, sauvegardes purgées (option « burn it »). |
| Prospect / contact demandant l'effacement | Concorde RT : effacement immédiat dans le CRM. |

Cf. la [procédure complète](./03-procedure-droits-personnes.md).

---

## E. Synthèse — Tableau de bord des purges en place

| # | Catégorie | Durée | État |
|---|---|---|---|
| 1 | Audit logs (sécurité) | 180 j | ✅ Automatique |
| 2 | Refresh tokens expirés | 30 j post-expiration | ✅ Automatique |
| 3 | Known devices inactifs | 365 j | ✅ Automatique |
| 4 | Push tokens désactivés | 90 j | ✅ Automatique |
| 5 | RAG chat logs (IA) | 90 j | ✅ Automatique |
| 6 | Sauvegardes locales | 7/28/180 j (3 tiers) | ✅ Automatique |
| 7 | Sauvegardes S3 EU | Lifecycle AWS à configurer | ⚠️ Infra (cf. checklist §2) |
| 8 | Tenants résiliés | 90 j puis DROP DATABASE | ⚠️ Procédure ops semi-manuelle |
| 9 | Géolocalisation pointage | À définir (recommandé 30 j CNIL) | ❌ À implémenter si décision client |
| 10 | Données métier salariés | 5+ ans selon obligations RT | ❌ Responsabilité du client RT |
| 11 | Formulaire de contact | 12 mois | ❌ À automatiser (process trimestriel actuel) |
| 12 | Sanctions disciplinaires | 3 ans (max légal) | ❌ À surveiller / alerter |

Items `❌` à traiter en V1.1 — voir roadmap dans
[`SECURITY_INFRA_CHECKLIST.md`](../SECURITY_INFRA_CHECKLIST.md).

---

## F. Revue annuelle

Cette politique doit être **revue annuellement** par le DPO + l'équipe
juridique, et **systématiquement** lors :

- d'une évolution réglementaire (mise à jour CNIL d'un référentiel),
- de l'ajout d'une nouvelle finalité de traitement,
- d'un changement de durée légale (loi de finances annuelle modifie souvent
  les durées fiscales).

Date de la prochaine revue : **2027-05-20**.

---

**Documents liés :**
- [Registre des traitements](./01-registre-traitements.md)
- [Procédure d'exercice des droits](./03-procedure-droits-personnes.md)
- [Politique de confidentialité](./04-politique-confidentialite.md)
- [Procédure de notification de violation](./07-procedure-violation-72h.md)
- [Checklist sécurité infrastructure](../SECURITY_INFRA_CHECKLIST.md)
