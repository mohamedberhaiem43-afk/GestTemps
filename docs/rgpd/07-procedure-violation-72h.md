# Procédure de notification de violation de données

**Articles 33 et 34 RGPD** — version 1.0 — dernière mise à jour : 2026-05-20

> **Périmètre** : cette procédure décrit la conduite à tenir dès qu'une
> **violation de données à caractère personnel** est suspectée ou confirmée
> sur le périmètre Concorde Workforce. Elle distingue les deux rôles :
>
> - **Concorde RT** : violation portant sur des données dont Concorde est
>   responsable de traitement (CRM commercial, salariés Concorde, contacts) →
>   Concorde notifie directement la CNIL et les personnes concernées.
> - **Concorde ST** : violation portant sur des données des clients (données
>   RH de leurs salariés hébergées dans les tenants) → Concorde notifie le
>   **client RT** sans retard injustifié ; c'est le client qui décide ensuite
>   de notifier la CNIL et ses salariés.

---

## 1. Qu'est-ce qu'une violation au sens du RGPD ?

L'article 4.12 RGPD définit une violation comme « une violation de la
sécurité entraînant, de manière accidentelle ou illicite, la **destruction**,
la **perte**, l'**altération**, la **divulgation non autorisée** de données
personnelles, ou l'**accès non autorisé** à de telles données ».

Trois grandes catégories :

| Type | Exemples Concorde |
|---|---|
| **Confidentialité** | Accès illégitime à un tenant, fuite d'un dump de base, vol d'un cookie de session, publication accidentelle d'un export, dump d'une sauvegarde S3 récupéré |
| **Intégrité** | Modification non autorisée de données (pointage trafiqué, salaire modifié par un attaquant), corruption silencieuse d'une base |
| **Disponibilité** | Ransomware sur le VPS, suppression accidentelle d'une base tenant sans sauvegarde restaurable, panne hébergeur > 72 h sans bascule |

---

## 2. Délais réglementaires

| Délai | Action | Article |
|---|---|---|
| **Sans retard injustifié** | Concorde ST notifie le client RT | Art. 33.2 |
| **72 heures** après la connaissance, **sauf si** le risque pour les personnes est faible | Le RT notifie la CNIL (ou autorité compétente) | Art. 33.1 |
| **Sans retard injustifié** | Le RT communique aux personnes concernées **si risque élevé** pour leurs droits et libertés | Art. 34 |

Les 72 h se comptent dès la **connaissance** de la violation (pas dès sa
survenance). « Connaissance » signifie un niveau de certitude raisonnable
qu'un incident s'est produit. Un simple soupçon ne fait pas courir le délai,
mais doit déclencher l'investigation immédiate.

---

## 3. Détection — Sources de signalement

Une violation peut être détectée par :

| Source | Indicateur | Canal interne |
|---|---|---|
| Logs nginx + CrowdSec | Brute-force, exfiltration de volume anormal, scan de vulnérabilités | `cscli alerts list -s ip` |
| Logs applicatifs (Serilog) | Erreurs 5xx massives, deserialization errors, authentification anormale | `docker logs abrpoint.server` |
| Audit log applicatif | Pic d'actions sensibles, modifications inhabituelles | Table `audit_log` |
| Trust report mobile | Pic de devices `low` connectés | Idem, `TableName=device_trust` |
| Alerte hébergeur (OVH) | Notification de scan ou de saisie | Email à `mohamed@concorde-work-force.com` |
| Bug bounty / signalement externe | Email d'un chercheur ou client | `security@concorde-tech.fr` (à activer) |
| Sauvegarde / restauration | `restore-test.sh` mensuel qui échoue | `/var/log/abrpoint-restore-test.log` + email |
| Salarié / interne | Erreur humaine remontée par un employé | Canal `#incidents` Slack interne ou `mohamed@concorde-work-force.com` |

**Toute personne qui détecte un signal sérieux doit immédiatement
escalader à l'astreinte technique** (cf. §5). Le bénéfice du doute joue
en faveur de la notification — il vaut mieux qualifier puis ne pas notifier
que ne rien faire.

---

## 4. Procédure pas-à-pas — Première heure

### T+0 — Constatation

L'astreinte qui reçoit l'alerte ouvre un **ticket incident** dans le
runbook interne avec :

- Date / heure exacte de la détection (UTC)
- Source du signal
- Description initiale (1-2 phrases)
- Identité de l'astreinte qui a pris l'incident
- Statut initial : `Suspect`

### T+15 min — Containment immédiat

Selon la nature de l'incident, exécuter **dans l'ordre** :

| Type | Action immédiate |
|---|---|
| Suspicion de compromission de compte | Révoquer tous les refresh tokens du compte concerné (`UPDATE refresh_tokens SET revoked = TRUE WHERE uticod = ...`), forcer changement MDP, désactiver le compte si menace persistante |
| Suspicion de compromission tenant | Mettre le tenant en mode lecture seule via `tenants.status = 'Suspended'` ; bloquer ses IP côté nginx |
| Suspicion de fuite de DB | Couper l'accès au container Postgres depuis l'extérieur (vérifier que les ports 5432 restent bound à 127.0.0.1, jamais publics) |
| Suspicion de prise de contrôle du VPS | Bloquer SSH en dehors des IP d'astreinte, regénérer les clés SSH, mais **ne pas arrêter les conteneurs** sans avoir collecté les logs |
| Compromission des sauvegardes S3 | Rotation immédiate de `BACKUP_ENC_KEY` + de l'IAM role AWS ; restaurer depuis une sauvegarde antérieure validée |

**Ne pas effacer les traces** : préserver tous les logs (nginx, Serilog,
auth, audit_log, CrowdSec) pour l'investigation forensique. Si une remédiation
demande d'arrêter un service, faire d'abord `docker logs <container> > /tmp/incident-<id>.log`.

### T+1 h — Qualification

L'équipe technique + DPO réunissent les informations :

| Question | Source |
|---|---|
| Quelles **données** ont été affectées ? (catégories, volumes, sensibilité) | Audit log + logs applicatifs |
| Combien de **personnes concernées** ? | Requêtes ciblées dans les tenants impactés |
| Quelle est la **nature** ? (confidentialité / intégrité / disponibilité) | Cf. §1 |
| L'**accès** est-il toujours en cours ? | Logs temps réel |
| Quelles **mesures de mitigation** sont déjà en place ? | Cf. T+15 min ci-dessus |
| Le **chiffrement** offre-t-il une protection résiduelle ? | Données en clair vs chiffrées (CIN, salaires, refresh tokens hashés → moindre risque) |

Le statut passe à `Confirmed`, `Unfounded` (faux positif), ou reste
`Investigating` si la qualification prend plus de temps.

### T+4 h — Évaluation du risque

Grille d'évaluation utilisée pour décider de la notification :

| Critère | Score 1 | Score 2 | Score 3 |
|---|---|---|---|
| Nature des données | Identification non sensible | Coordonnées + vie pro | Données financières / santé / CIN |
| Volume | 1-10 personnes | 11-100 personnes | > 100 personnes |
| Identification possible | Anonymisé/pseudonymisé | Difficile mais possible | Direct |
| Conséquences pour les personnes | Mineures (gêne) | Modérées (réputation, harcèlement) | Élevées (fraude, usurpation d'identité) |
| Durée d'exposition | < 1 h | < 24 h | > 24 h |

- **Score total ≤ 6** → faible risque → notification CNIL non obligatoire
  (mais documentée en interne au registre des violations).
- **Score 7-10** → risque modéré → **notification CNIL obligatoire** (72 h).
- **Score ≥ 11** → risque élevé → **notification CNIL + communication aux
  personnes concernées** (Art. 34).

---

## 5. Acteurs et escalade

| Rôle | Qui | Quand |
|---|---|---|
| Astreinte technique de niveau 1 | [À COMPLÉTER — Mohamed + 1 backup] | 24/7 |
| Référent sécurité (DSI / CTO) | [À COMPLÉTER] | < 1 h après détection |
| DPO | [À COMPLÉTER] | < 4 h après confirmation |
| Direction (CEO / dirigeant) | [À COMPLÉTER] | Avant notification CNIL |
| Conseil juridique externe | [À COMPLÉTER] | Avant notification CNIL si litige potentiel |
| Hébergeur (OVH) | Support OVH | Si la violation provient du datacenter |

**Canal d'escalade** : Slack `#incidents` interne + appel téléphonique
si l'incident est qualifié `Confirmed`.

---

## 6. Notification à la CNIL — Quand Concorde est RT

Téléservice CNIL : https://notifications.cnil.fr

Pré-remplir le formulaire avec les éléments du ticket incident :

```
Identité du RT
  - Raison sociale : [À COMPLÉTER]
  - SIRET : [À COMPLÉTER]
  - Coordonnées DPO : dpo@concorde-tech.fr

Description de la violation
  - Date de connaissance : <DateTime UTC>
  - Date de survenance estimée : <DateTime UTC ou "Inconnue">
  - Nature : confidentialité / intégrité / disponibilité
  - Catégories de données : <Liste>
  - Catégories de personnes : <Liste>
  - Volume estimé : <Nombre>

Conséquences probables
  - Risque évalué : faible / modéré / élevé
  - Justification de l'évaluation : <Texte court basé sur §4>

Mesures prises
  - Containment : <Liste actions §4 T+15 min>
  - Mesures préventives ajoutées : <Patches, rotations clés, etc.>

Communication aux personnes
  - Décision : oui (joindre le projet de communication) / non (justifier)
```

Si la notification dépasse 72 h, joindre l'explication du retard (Art. 33.1).

---

## 7. Notification client — Quand Concorde est ST

Modèle d'email à envoyer au DPO (ou à défaut au contact admin) du client RT :

```
Objet : Notification d'incident de sécurité — Concorde Workforce

[Nom DPO / Admin],

Conformément à l'article 33.2 du RGPD et à l'article 8 du DPA signé
avec votre organisation, nous vous informons sans retard injustifié
de l'incident suivant survenu sur le périmètre des données que nous
hébergeons pour votre compte.

INCIDENT
  Référence interne : INC-<id>
  Date de connaissance : <DateTime UTC>
  Nature : <confidentialité / intégrité / disponibilité>
  Catégories de données impactées : <Liste>
  Volume estimé pour votre tenant : <Nombre de salariés>
  Mesures déjà prises : <Liste>

RECOMMANDATIONS
  - Vérifier l'opportunité de notifier la CNIL dans les 72 h en tant
    que responsable de traitement.
  - Vérifier l'opportunité de communiquer aux personnes concernées
    (vos salariés) si le risque est élevé.
  - Forcer la rotation des mots de passe pour les comptes impactés.

Nous restons à votre disposition pour :
  - Fournir tout détail forensique nécessaire à votre propre analyse.
  - Vous communiquer la liste détaillée des comptes concernés.
  - Vous accompagner dans la communication aux personnes (modèles fournis).

Une lettre de notification formelle suivra par courrier recommandé.

Cordialement,
Le DPO Concorde — dpo@concorde-tech.fr
```

---

## 8. Communication aux personnes concernées (risque élevé)

Quand Concorde RT : Concorde communique directement. Quand Concorde ST :
le client RT communique, Concorde fournit le modèle ci-dessous.

Modèle d'email aux personnes :

```
Objet : Information importante concernant vos données personnelles

[Nom / Prénom],

Conformément à l'article 34 du Règlement Général sur la Protection
des Données (RGPD), nous vous informons d'un incident de sécurité
qui a affecté vos données personnelles.

NATURE DE LA VIOLATION
  <Description en termes simples — éviter le jargon technique>

DONNÉES CONCERNÉES
  <Liste précise>

CONSÉQUENCES PROBABLES POUR VOUS
  <Évaluation honnête : risques de fraude, usurpation, etc.>

MESURES QUE NOUS AVONS PRISES
  <Liste : rotation des mots de passe, alertes, etc.>

RECOMMANDATIONS POUR VOUS
  - Changer votre mot de passe immédiatement
  - Activer l'authentification à deux facteurs si ce n'est pas fait
  - Surveiller votre compte bancaire si applicable
  - Méfiance accrue face aux emails / SMS suspects (phishing)

CONTACT
  Pour toute question : dpo@concorde-tech.fr ou par courrier
  à [Adresse postale].

Nous vous prions de nous excuser pour la gêne occasionnée et vous
remercions de votre confiance.

[Signature]
```

---

## 9. Registre interne des violations

Concorde tient un registre des violations (art. 33.5 RGPD), même celles
non notifiées à la CNIL. Format minimal :

| Date détection | Référence interne | Nature | Personnes concernées | Risque évalué | CNIL notifiée ? | Personnes notifiées ? | Mesures correctives | Clôturé le |
|---|---|---|---|---|---|---|---|---|

Conservé **5 ans minimum**. Tenu par le DPO, accessible à la CNIL en cas
de contrôle.

---

## 10. Post-mortem

Après clôture de chaque incident `Confirmed` (qu'il ait été notifié ou non),
le DPO + l'équipe technique rédigent un **post-mortem blameless** dans les
2 semaines :

- Timeline factuelle
- Cause racine (5 pourquoi)
- Pourquoi nos mesures préventives n'ont pas suffi
- Action items concrets pour éviter la récurrence (avec owners + échéances)
- Revue des mesures de l'Article 32 — mettre à jour le registre / AIPD si pertinent

Les post-mortems sont archivés et **partagés avec l'équipe**. Aucun blame
individuel ; focus sur les défaillances de processus et de défense en
profondeur.

---

## 11. Tests

- [ ] **Exercice de simulation** annuel : un incident fictif est joué
  par l'équipe (table-top exercise) pour valider que la procédure
  fonctionne en pratique. Premier exercice prévu : [À COMPLÉTER — 6 mois
  après go-live].
- [ ] **Test du téléservice CNIL** : créer un compte sur
  `notifications.cnil.fr` avant tout incident, vérifier que l'éditeur
  peut soumettre.
- [ ] **Test du mailer** : envoyer un email à `mohamed@concorde-work-force.com`
  depuis le VPS via le script `setup-unattended-upgrades.sh` puis lire
  la réception.

---

**Documents liés :**
- [Registre des traitements](./01-registre-traitements.md)
- [AIPD pointage RH](./02-aipd-pointage-rh.md)
- [Audit des sous-traitants](./06-audit-sous-traitants.md)
- [Checklist sécurité infrastructure](../SECURITY_INFRA_CHECKLIST.md)
