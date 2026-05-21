# Procédure d'exercice des droits des personnes concernées

**Articles 12 à 22 RGPD** — version 1.0 — dernière mise à jour : 2026-05-20

> **Périmètre** : cette procédure décrit la manière dont Concorde traite les
> demandes d'exercice des droits prévus par les articles 15 à 22 du RGPD.
> Elle distingue les deux situations :
>
> - **Concorde RT** : demande émanant d'un prospect, d'un client, d'un
>   salarié interne Concorde ou d'un visiteur du site → Concorde répond
>   directement.
> - **Concorde ST** : demande émanant d'un salarié d'une entreprise cliente
>   → Concorde **redirige** la personne vers son employeur (RT) et **assiste**
>   ce dernier dans la réponse, conformément à l'art. 28.3.e RGPD.

---

## 1. Canal de réception des demandes

### 1.1. Adresse de contact dédiée

| Canal | Adresse / URL |
|---|---|
| Email | **dpo@concorde-tech.fr** |
| Formulaire web | https://concorde-tech.fr/contact (case « Droits RGPD » à cocher) |
| Courrier postal | [À COMPLÉTER — adresse postale officielle de l'éditeur] |

Toute demande reçue sur un autre canal (support technique, commercial,
réseaux sociaux) doit être **réorientée vers dpo@concorde-tech.fr** dans les
48 h ouvrées ; le compteur de délai légal court à partir de la réception
initiale.

### 1.2. Vérification de l'identité (art. 12.6 RGPD)

Avant tout traitement de la demande :

| Type de demandeur | Justificatif demandé |
|---|---|
| Client titulaire d'un compte Concorde | Réponse depuis l'email du compte, ou validation via lien magique envoyé sur l'email enregistré |
| Personne externe non connue dans le système | Pièce d'identité (à supprimer dès l'identité confirmée — pas de conservation) |
| Salarié d'un client | **Redirection vers son employeur** (cf. §4). Aucune vérification d'identité côté Concorde n'est pertinente puisque Concorde n'a pas la qualité de RT |
| Tiers (avocat, parent, ascendant) | Mandat écrit + pièce d'identité du mandant et du mandataire |

En cas de doute raisonnable, Concorde demande des informations supplémentaires
proportionnées (art. 12.6) ; le délai de réponse est alors suspendu jusqu'à
réception de ces informations.

---

## 2. Délais de réponse

| Délai | Calcul |
|---|---|
| **1 mois** à compter de la réception de la demande complète | Délai standard (art. 12.3) |
| Prolongation possible de **2 mois supplémentaires** | Si la demande est complexe ou multiple — la personne est informée de la prolongation et de ses motifs dans le délai initial d'1 mois |
| **Sans retard injustifié** | En cas de notification de violation à la personne (art. 34) |

Concorde tient un **registre interne des demandes** (timestamp réception,
nature, identité demandeur, suite donnée, date de réponse) à des fins de
traçabilité de l'accountability.

---

## 3. Réponse aux demandes — Concorde en tant que RESPONSABLE DE TRAITEMENT

### 3.1. Droit d'accès (art. 15)

| Information à fournir | Source |
|---|---|
| Confirmation que des données sont traitées (oui/non) | Recherche dans CRM, Stripe, audit logs, mailing |
| Catégories de données | Cf. registre §II |
| Finalités | Cf. registre §II |
| Destinataires (catégories) | Cf. registre §II |
| Durée de conservation | Cf. registre §II |
| Existence des droits | Inclure le présent document |
| Source des données (si non collectées auprès de la personne) | À tracer cas par cas |
| Logique de toute décision automatisée (le cas échéant) | Aucune décision purement automatisée chez Concorde RT |
| Transferts hors UE | Aucun pour les traitements RT de Concorde |

Format : une **copie des données** est fournie au format PDF (rapport
synthétique) accompagnée d'un export JSON pour les données structurées. Une
copie est gratuite ; toute copie supplémentaire peut être facturée à un coût
raisonnable (art. 15.3).

### 3.2. Droit de rectification (art. 16)

Rectification effectuée dans le système d'origine (CRM commercial, base
clients, base de contacts marketing). Si la donnée a été transmise à un
sous-traitant ultérieur (ex. Stripe pour la facturation), Concorde notifie
la rectification.

### 3.3. Droit à l'effacement (art. 17)

L'effacement est appliqué sauf si une exception s'applique :

| Exception | Exemple Concorde |
|---|---|
| Obligation légale de conservation | Factures (10 ans) |
| Constatation, exercice ou défense d'un droit en justice | Litige en cours |
| Liberté d'expression et d'information | Sans objet ici |

Quand l'effacement n'est pas possible immédiatement, les données sont
**verrouillées** (accès restreint au strict nécessaire) jusqu'à l'expiration
de l'obligation, puis effacées.

### 3.4. Droit à la limitation (art. 18)

Lorsque la personne conteste l'exactitude ou la licéité, les données sont
**marquées comme limitées** (ne sont plus utilisées pour des traitements
actifs) le temps de la vérification.

### 3.5. Droit à la portabilité (art. 20)

S'applique aux traitements fondés sur le consentement ou l'exécution d'un
contrat ET réalisés par voie automatisée. Format restitué : **JSON** ou
**CSV**, structuré, machine-readable.

### 3.6. Droit d'opposition (art. 21)

S'applique notamment à la prospection commerciale : un simple email à
`dpo@concorde-tech.fr` ou un clic sur le lien `unsubscribe` des emails
marketing suffit. Effet : suppression immédiate des bases de prospection,
conservation 3 ans à des fins de preuve du désabonnement (CNIL).

### 3.7. Décisions automatisées (art. 22)

Concorde n'effectue **aucune décision purement automatisée produisant des
effets juridiques** sur les personnes concernées dans ses traitements RT.
(L'assistance IA `RAG` est un outil d'aide à la décision, pas une décision
automatisée au sens de l'art. 22.)

---

## 4. Réponse aux demandes — Concorde en tant que SOUS-TRAITANT

### 4.1. Principe : redirection vers le responsable de traitement

Lorsqu'un **salarié d'une entreprise cliente** contacte Concorde pour
exercer ses droits sur ses données RH hébergées dans la plateforme :

1. Concorde **accuse réception sous 48 h ouvrées**.
2. Concorde explique à la personne que **son employeur est responsable de
   traitement** de ces données et qu'elle doit adresser sa demande au DPO de
   son employeur (ou, à défaut, à son service RH).
3. Concorde **notifie le client RT** (canal email contractuel) dans un délai
   de 48 h ouvrées qu'une demande lui a été redirigée.
4. Concorde **assiste le client** dans la mise en œuvre matérielle de la
   demande (cf. §4.2).

### 4.2. Assistance technique au RT (art. 28.3.e)

Concorde fournit au client les outils suivants :

| Droit | Outil mis à disposition du RT |
|---|---|
| Accès | Interface admin du client → fiche salarié, export PDF/JSON via `/api/employes/{empcod}/export` (à activer) |
| Rectification | Interface admin standard |
| Effacement | Procédure de suppression d'employé sortant ; les données de paie/contrat sont conservées par le client pour ses propres obligations légales (5 ans) puis purgées |
| Limitation | Désactivation du compte utilisateur ; les données restent visibles en lecture seule |
| Portabilité | Export JSON via interface admin |
| Opposition | Désactivation du compte ; non concerné pour les traitements fondés sur l'exécution du contrat de travail |

### 4.3. Délai

Concorde répond au client sous **5 jours ouvrés** pour toute demande
d'assistance ; le délai légal d'1 mois reste à la charge du client (RT).

---

## 5. Refus de réponse et voies de recours

### 5.1. Refus

Une demande peut être refusée :
- si elle est **manifestement infondée ou excessive** (art. 12.5) — Concorde
  documente la justification ;
- si une **exception légale** s'applique (cf. §3.3).

Dans ce cas, la personne est informée par écrit du refus, de ses motifs et
des voies de recours.

### 5.2. Voies de recours pour la personne

Toute personne dispose du droit d'introduire une réclamation auprès d'une
autorité de contrôle (art. 77 RGPD) :

- **France** : CNIL — 3 place de Fontenoy, 75007 Paris — www.cnil.fr
- **Belgique** : APD/GBA — www.autoriteprotectiondonnees.be
- **Maroc** : CNDP — www.cndp.ma
- **Sénégal** : CDP — www.cdp.sn

ou de saisir le juge compétent.

---

## 6. Registre interne des demandes

Format minimal du registre tenu par le DPO :

| Date réception | Canal | Demandeur (catégorie) | Droit exercé | Délai légal | Date de réponse | Suite donnée | Référence dossier |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

Le registre est conservé **3 ans** après clôture du dossier (preuve de
diligence en cas de contrôle CNIL).

---

## 7. Modèle d'accusé de réception

```
Objet : Votre demande d'exercice de droits RGPD — Accusé de réception

Bonjour [Nom],

Nous accusons réception de votre demande en date du [date], dont l'objet
est : [accès / rectification / effacement / limitation / portabilité /
opposition].

Conformément à l'article 12.3 du RGPD, nous vous apporterons une réponse
sous un délai d'un mois maximum, soit avant le [date + 1 mois]. Ce délai
pourra être prolongé de deux mois si votre demande s'avère complexe ;
nous vous en informerions le cas échéant dans le délai initial.

[Si applicable — vérification d'identité]
Afin de garantir la confidentialité de votre demande, nous vous prions
de bien vouloir nous transmettre [justificatif demandé].

[Si applicable — redirection vers RT]
Les données auxquelles vous souhaitez accéder sont traitées par votre
employeur [Nom du client] dans le cadre du service Concorde Workforce.
Votre employeur étant responsable de traitement au sens du RGPD, nous
vous invitons à adresser votre demande à son délégué à la protection
des données ou, à défaut, à son service des ressources humaines. Nous
avons par ailleurs notifié votre employeur de cette redirection.

Pour toute question complémentaire : dpo@concorde-tech.fr

Bien cordialement,
Le DPO Concorde
```

---

**Documents liés :**
- [Registre des traitements](./01-registre-traitements.md)
- [Politique de confidentialité publique](./04-politique-confidentialite.md)
- [Audit des sous-traitants](./06-audit-sous-traitants.md)
