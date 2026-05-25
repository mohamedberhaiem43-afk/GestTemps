# GUIDE UTILISATEUR — Concorde Workforce
## Comprendre et utiliser les modules clés de la plateforme

> **Destinataire** : utilisateur final (administrateur, responsable RH, manager).
> **Objectif** : présenter l'intérêt de chaque module et le rôle des champs, sans jargon technique.
> **Version** : Mai 2026

---

## Table des matières

1. [Comment lire ce guide](#1-comment-lire-ce-guide)
2. [Rubriques de paie](#2-rubriques-de-paie)
3. [Natures d'absences](#3-natures-dabsences)
4. [Jours fériés](#4-jours-fériés)
5. [Poste de travail](#5-poste-de-travail)
6. [Classe horaire](#6-classe-horaire)
7. [Liste pointeuses](#7-liste-pointeuses)
8. [État périodique](#8-état-périodique)
9. [Pointage du mois](#9-pointage-du-mois)
10. [**Comment sont calculés les heures sup, retards et absences**](#10-comment-sont-calculés-les-heures-sup-retards-et-absences)
11. [Gestion des employés — fiche, missions, allaitement, coffre](#11-gestion-des-employés)
12. [Notes de frais](#12-notes-de-frais)
13. [Affectation des soldes](#13-affectation-des-soldes)
14. [Compte Épargne Temps (CET)](#14-compte-épargne-temps-cet)
15. [Paramètres société et calendrier](#15-paramètres-société-et-calendrier)

---

## 1. Comment lire ce guide

Chaque module est présenté avec :
- **À quoi ça sert** : l'intérêt métier
- **Qui utilise** : le ou les profils concernés (administrateur, manager, salarié)
- **Champs principaux** : ce que chaque champ représente, dans un langage simple
- **Bonnes pratiques** : les pièges à éviter

Les calculs (heures sup, retards, absences) font l'objet d'une **section dédiée** (§10) pour bien comprendre comment l'application transforme un pointage brut en heures payables.

---

## 2. Rubriques de paie

### À quoi ça sert

Une **rubrique** est un poste de paie : salaire de base, heures sup à 25 %, indemnité transport, retenue d'absence, panier repas, etc.

Concorde Workforce **ne calcule pas** les bulletins de paie (cotisations, IRPP). Il **prépare les éléments** en les classant par rubrique, puis exporte un fichier vers votre logiciel de paie (Sage, Cegid, Navision…). Sans rubrique paramétrée, aucun élément ne peut être exporté.

### Qui utilise

- **Administrateur** ou **responsable paie** uniquement.

### Champs principaux

| Champ | Rôle |
|---|---|
| **Code rubrique** | Identifiant court repris tel quel dans votre logiciel paie (ex. « R01 », « PRIME01 »). Doit correspondre au code attendu par votre prestataire paie. |
| **Libellé** | Nom affiché sur le bulletin (« Salaire de base », « Heures sup 25 % », « Retenue absence »). |
| **Type** | Distingue les rubriques de **gain** (s'ajoutent au salaire), de **retenue** (se déduisent) et de **cotisation** (charges sociales). |
| **Type de variation** | Précise comment la rubrique est calculée : montant **fixe** (forfait mensuel), **proportionnel** au salaire (en pourcentage), **horaire** (×nombre d'heures), ou **forfait**. |
| **Unité** | Unité de référence : jour, heure, mois, forfait. Détermine ce que représente la « quantité » saisie. |
| **Taux** | Valeur ou pourcentage appliqué (1,00 = 100 % ; 0,25 = +25 % de majoration). |
| **Régime** | Distingue les régimes fiscaux particuliers (normal, simplifié, exonéré). |

### Bonnes pratiques

- **Aligner les codes** sur ceux de votre prestataire paie avant de paramétrer. Toute incohérence bloque l'import.
- Créer une rubrique par tranche d'heure sup (25 %, 50 %, 100 %) plutôt qu'une rubrique unique multi-taux.
- Lier chaque **nature d'absence** à une rubrique paie (voir §3) pour que l'absence remonte automatiquement sur le bulletin.

---

## 3. Natures d'absences

### À quoi ça sert

Le **catalogue des motifs d'absence** : congé payé, maladie, mission, allaitement, formation, autorisation non payée, accident du travail, etc. Chaque absence enregistrée dans le système (par pointage manquant, par demande validée, par missions) est rattachée à une nature de cette liste.

C'est ce catalogue qui dit à l'application :
- l'absence est-elle **payée** ou non,
- doit-elle **décompter le solde de congés**,
- doit-elle **déclencher une retenue** (sanction),
- est-elle exprimée en **heures** ou en **jours**,
- à quelle **rubrique paie** envoyer le résultat.

### Qui utilise

- **Administrateur** pour le paramétrage initial.
- **Manager / responsable RH** quand ils valident des demandes : le choix du motif détermine le traitement automatique.

### Champs principaux

| Champ | Rôle |
|---|---|
| **Code** | Identifiant court (« CP », « MAL », « MIS »). Apparaît dans les écrans de validation. |
| **Libellé** | Nom complet affiché (« Congé payé annuel », « Maladie justifiée », « Mission externe »). |
| **Décompte du solde** | Si activé, l'absence retire des jours au compteur de congés du salarié. Typique pour le congé payé, jamais pour la maladie. |
| **Rémunérée** | Détermine si l'absence est **payée à 100 %** ou non. Une absence non payée n'apparaît sur aucun gain de salaire. |
| **Sanction** | Si activé, déclenche automatiquement une retenue sur paie en plus de la non-rémunération (cas « absence injustifiée »). |
| **Saisissable par le salarié** | Si activé, le motif apparaît dans la liste déroulante quand un salarié dépose une demande. Sinon réservé à l'administration. |
| **Compte comme repos** | À activer pour les motifs assimilés à un repos hebdomadaire (jour férié de récupération, jour donné). |
| **S'applique sur jour férié** | À activer pour des motifs particuliers (allaitement, congé exceptionnel) si vous voulez qu'ils restent valables même un jour férié. |
| **Unité** | « Jour » pour un congé classique, « Heure » pour une autorisation de sortie ponctuelle, « ½ journée » pour les demi-journées. |
| **Rubrique paie associée** | Le code de la rubrique vers laquelle envoyer cette absence (cf. §2). Indispensable si l'absence est rémunérée. |

### Bonnes pratiques

- Créer un catalogue **complet dès le départ** : ajouter un motif après plusieurs mois oblige à reclasser manuellement les absences existantes.
- Distinguer **congé payé** (décompte du solde) et **congé exceptionnel** (ne décompte pas, ex. naissance, mariage, décès).
- Pour les **missions**, créer un motif « Mission externe » non sanctionné, rémunéré, sans décompte de solde — c'est ce que le module Missions utilisera.

---

## 4. Jours fériés

### À quoi ça sert

Le **calendrier annuel des jours non travaillés** : jours fériés légaux (1ᵉʳ janvier, fête du travail, fête nationale…), fermetures collectives d'usine, ponts attribués par l'employeur.

Sans ce calendrier, l'application considère tous les jours du calendrier comme ouvrés et compterait les jours fériés comme des absences non justifiées.

### Qui utilise

- **Administrateur** pour la saisie annuelle (typiquement en début d'année).

### Champs principaux

| Champ | Rôle |
|---|---|
| **Année** | Année concernée. Permet d'archiver l'historique. |
| **Date** | Date exacte du jour férié. |
| **Motif** | Libellé affiché dans les rapports (« Nouvel An », « Eid Al-Fitr », « Fermeture annuelle »). |
| **Date fixe** | À activer si le jour tombe à la même date chaque année (Nouvel An, fête nationale). À désactiver pour les fêtes mobiles (Pâques, Eid). |
| **Type** | Distingue : férié légal, fermeture collective, repos compensateur exceptionnel. Influe sur la majoration appliquée. |
| **Nombre d'heures** | Durée à compter pour le salarié non travaillant ce jour. Pour une journée complète, mettre la durée standard (ex. 8 h) ; pour un demi-jour, mettre 4 h. |
| **Payé** | Si activé, le jour est rémunéré à 100 %. À désactiver uniquement pour les fermetures non rémunérées (très rare). |

### Bonnes pratiques

- Saisir tous les jours fériés en **janvier de chaque année**, avant le premier pointage.
- Si vous avez plusieurs sociétés/pays, le calendrier est défini **par société** : penser à le saisir pour chacune (les jours fériés français ≠ marocains).
- Les **ponts** attribués (vendredi du 14 juillet par exemple) doivent être saisis explicitement, ils ne sont pas déduits automatiquement.

---

## 5. Poste de travail

### À quoi ça sert

Le poste de travail définit **les horaires d'une journée type** : à quelle heure on est censé arriver, partir, pauser pour le repas, et quelles tolérances sont admises.

C'est la **brique élémentaire** de tout le calcul du temps de travail. Sans poste, l'application ne sait pas si quelqu'un est en retard, en avance, en absence ou à l'heure.

Exemples typiques :
- « Horaire bureau 8h-16h30 »
- « Poste 3×8 — équipe matin »
- « Poste 3×8 — équipe après-midi »
- « Poste 3×8 — équipe nuit »
- « Travail samedi seul »

### Qui utilise

- **Administrateur** uniquement.

### Champs principaux

#### Identification du poste

| Champ | Rôle |
|---|---|
| **Code** | Identifiant court (« 8H_BUREAU », « 3x8_MATIN »). Apparaîtra dans les rapports. |
| **Libellé** | Nom complet et descriptif (« Horaire bureau lundi-vendredi 8h-16h30 »). |

#### Horaires par jour de la semaine

Pour **chaque jour** (lundi à dimanche), on précise :

| Élément | Rôle |
|---|---|
| **Jour de repos** | À cocher pour les jours non travaillés (typiquement samedi/dimanche). Si coché, les autres horaires de la ligne sont ignorés. |
| **Heure de début matin** | Heure d'embauche théorique (ex. 08:00). |
| **Heure de fin matin** | Début de la pause repas (ex. 12:00). |
| **Heure de début après-midi** | Reprise après pause (ex. 14:00). |
| **Heure de fin après-midi** | Heure de débauche théorique (ex. 17:30). |
| **Durée du panier repas** | Temps de pause non compté comme travail (exprimé en minutes). |
| **Minimum d'heures journée** | Plancher pour qu'une journée soit reconnue comme travaillée (ex. 6 h). En dessous, journée comptée comme demi-journée ou absence. |
| **Minimum d'heures demi-journée** | Plancher pour qu'un matin ou un après-midi soit reconnu (ex. 2 h). |
| **Temps de douche / vestiaire** | Allocation supplémentaire comptée comme travail (typique industries — ex. 15 min). |

#### Tolérances de pointage

Ces tolérances absorbent les petits décalages (5 min en retard, 3 min en avance) sans déclencher de sanction. Elles s'appliquent **à chaque session** (entrée/sortie matin et après-midi).

| Champ | Rôle |
|---|---|
| **Tolérance avant embauche** | Combien de minutes on peut arriver en avance sans que cela compte en heure sup (ex. 5 min). |
| **Tolérance après embauche** | Combien de minutes on peut arriver en retard sans pénalité (ex. 5 min). |
| **Tolérance avant sortie** | Combien de minutes on peut partir en avance sans pénalité (ex. 5 min). |
| **Tolérance après sortie** | Combien de minutes on peut partir en retard sans que cela compte en heure sup (ex. 5 min). |

#### Règles de sanction

| Champ | Rôle |
|---|---|
| **Seuil de déclenchement** | À partir de combien de minutes de retard la sanction s'applique (ex. 30 min). En dessous, simple retard non sanctionné. |
| **Pénalité minimum** | Plancher de retenue : tout retard sanctionnable est comptabilisé pour au moins ce nombre de minutes (ex. 30 min même si le retard réel est de 32 min). |
| **Retenue pour absence** | Nombre de minutes retenues pour un demi-jour ou un jour entier d'absence non justifiée. |

#### Arrondi

| Champ | Rôle |
|---|---|
| **Arrondi pointage** | Le système arrondit chaque pointage à la N minute (5, 10, 15). Évite les « 08:37 » illisibles. |
| **Arrondi heures sup** | Arrondi spécifique appliqué au cumul d'heures sup quotidien. |

### Bonnes pratiques

- Créer **un poste générique** (8h-12h / 14h-17h30) couvre la majorité des cas tertiaires.
- Pour l'industrie : créer **un poste par équipe de quart** (matin, après-midi, nuit) et les regrouper dans une classe horaire (§6).
- Définir des tolérances **réalistes** : trop laxistes, les retards passent inaperçus ; trop strictes, vos salariés sont pénalisés pour quelques secondes.

---

## 6. Classe horaire

### À quoi ça sert

La classe horaire est le **planning annuel** d'un employé : elle relie un employé à un (ou plusieurs) poste(s) de travail sur une période donnée.

Deux cas typiques :
- **Périodique** : un seul poste appliqué toute l'année (« 8h-16h30 » pour un cadre administratif).
- **Rotation** : plusieurs postes qui se succèdent (équipes 2×8, 3×8 où le salarié alterne matin/après-midi/nuit chaque semaine).

C'est la classe horaire qui est **affectée à chaque employé** sur sa fiche. Sans classe horaire, le système ne sait pas quel poste appliquer à ce salarié.

### Qui utilise

- **Administrateur** uniquement.

### Champs principaux

| Champ | Rôle |
|---|---|
| **Code** | Identifiant court (« CH_STD », « CH_3x8 »). |
| **Libellé** | Nom descriptif (« 35h bureau », « Rotation 3×8 production »). |
| **Période de validité** | Dates de début et de fin (typiquement du 1ᵉʳ janvier au 31 décembre). Permet d'historiser : si vos horaires changent en cours d'année, créer une nouvelle classe. |
| **Mode** | **Périodique** : un poste appliqué tout le temps. **Selon pointage** : le système identifie automatiquement le poste utilisé d'après l'heure réelle du pointage (utile pour rotations souples). |
| **Poste associé** | Le poste appliqué (mode périodique). |
| **Catégories cibles** | Les profils d'employés concernés (cadres, maîtrise, exécutants). Permet de réutiliser une même classe pour plusieurs catégories. |
| **Périodes saisonnières** | Pour les rotations : suite de plages (semaines X → Y, semaines Y → Z…) chacune avec son propre poste. |

### Bonnes pratiques

- Commencer simple : **une classe horaire « standard »** suffit dans 80 % des cas (tertiaire, bureau).
- Pour les **rotations 3×8**, créer 3 postes (matin, après-midi, nuit) puis une seule classe horaire avec les périodes saisonnières qui alternent les 3 postes.
- Toujours fixer une **date de fin** : facilite les changements ultérieurs (création d'une nouvelle classe à partir du 1ᵉʳ janvier suivant).

---

## 7. Liste pointeuses

### À quoi ça sert

C'est la **vue brute des pointages** collectés : chaque badge sur une badgeuse, chaque clic « pointer » sur l'application mobile, chaque saisie manuelle apparaît ici.

Sert à :
- vérifier qu'un pointage a bien été enregistré,
- détecter un pointage manquant (panne badgeuse, oubli, perte de connexion mobile),
- corriger manuellement un pointage erroné.

### Qui utilise

- **Manager** : consultation et corrections de son équipe.
- **Administrateur** : vue globale et corrections.

### Ce qu'on voit

Pour chaque ligne :

| Information | Rôle |
|---|---|
| **Date et heure** | Moment exact du pointage. |
| **Salarié** | Matricule + nom. |
| **Type** | Entrée matin / sortie matin / entrée après-midi / sortie après-midi. Déduit automatiquement à partir de l'heure et du poste. |
| **Source** | Badgeuse physique, application mobile, ou saisie manuelle (avec nom de l'admin qui a saisi). |
| **Coordonnées GPS** | Si capture activée (cf. paramètres RGPD §15) — utile pour vérifier que le salarié pointait bien depuis son site et pas depuis chez lui. |

### Actions disponibles

- **Saisie manuelle** d'un pointage manquant (panne badgeuse, mobile sans réseau). Le système trace que c'est un ajout manuel et l'identité de l'admin auteur.
- **Modification** d'un pointage erroné (heure mal lue par la badgeuse).
- **Suppression** d'un pointage en double (badgeage accidentel).

### Bonnes pratiques

- Vérifier la liste pointeuses **chaque matin** pour rattraper les oublis de la veille (l'employé qui n'a pas badgé en partant la veille).
- Toute correction est **tracée dans l'audit log** : aucun risque d'altération clandestine.

---

## 8. État périodique

### À quoi ça sert

L'état périodique est le **tableau de bord hebdomadaire et mensuel** du temps de travail : combien d'heures ont été réellement travaillées, combien d'heures théoriques étaient prévues, combien d'heures supplémentaires ont été générées, combien d'absences ont été constatées.

C'est l'outil quotidien du manager pour suivre son équipe.

### Qui utilise

- **Manager** : son équipe.
- **Responsable RH / Administrateur** : tous les salariés.

### Ce qu'on voit

Tableau par salarié avec colonnes :

| Colonne | Rôle |
|---|---|
| **Salarié** | Matricule + nom + service. |
| **Heures théoriques** | Ce que le contrat prévoit pour la période (ex. 35 h × 4 semaines = 140 h). |
| **Heures réelles** | Ce qui a été pointé. |
| **Écart** | Différence. Positif = heures sup à valider ; négatif = absences à investiguer. |
| **Heures sup** | Détaillées par tranche (25 %, 50 %, 100 %). |
| **Retards** | Cumul en minutes. |
| **Absences** | Cumul en jours/heures. |

### Filtres disponibles

- Période (semaine, mois, plage personnalisée)
- Site / service
- Catégorie (cadres, maîtrise, exécutants)
- Salarié individuel

### Bonnes pratiques

- Consulter l'état **chaque vendredi** pour la semaine écoulée : permet de discuter avec le salarié si quelque chose cloche pendant que la semaine est encore fraîche.
- Repérer les **écarts récurrents** (toujours +5 h chez le même salarié) → soit revoir son poste, soit reconnaître ces heures comme des HS structurelles.

---

## 9. Pointage du mois

### À quoi ça sert

Le pointage du mois est la **vue exhaustive d'un salarié sur un mois civil** : pour chaque jour, on voit l'heure d'arrivée, l'heure de départ, le total d'heures, les absences éventuelles, les heures sup détaillées.

C'est la vue utilisée pour :
- **valider la paie** avant transmission au prestataire,
- **justifier** un calcul à un salarié qui conteste,
- **archiver** une preuve mensuelle pour audit ou contrôle (inspection du travail).

### Qui utilise

- **Responsable RH / Administrateur** : préparation paie mensuelle.
- **Manager** : son équipe en consultation.

### Ce qu'on voit

Tableau salarié × jour avec, pour chaque jour :

| Colonne | Rôle |
|---|---|
| **Date** | Jour du mois. |
| **Jour de semaine** | Lundi, mardi… ainsi que les jours fériés marqués distinctement. |
| **Poste appliqué** | Le poste utilisé ce jour (issu de la classe horaire). |
| **Heure d'arrivée** | Premier pointage du jour. |
| **Heure de départ** | Dernier pointage du jour. |
| **Heures travaillées** | Total net après déduction de la pause repas. |
| **Heures sup** | Détaillées par tranche. |
| **Heures de nuit** | Si applicable. |
| **Retard** | En minutes. |
| **Absence** | Type et durée. |
| **Note / motif** | Saisi par le manager pour expliquer un cas particulier. |

### Actions disponibles

- **Édition manuelle** d'un cumul (cas exceptionnel — accord manager/salarié sur des HS forfaitaires).
- **Saisie d'une note** sur un jour (« congé exceptionnel pour décès », « formation externe »).
- **Export Excel** pour transmission au prestataire paie.
- **Export PDF** pour signature manager + salarié.

### Bonnes pratiques

- Clôturer le pointage du mois **le 25 du mois** au plus tard : laisse du temps pour les corrections avant la paie.
- **Verrouiller** le mois une fois validé : empêche toute modification a posteriori (audit).

---

## 10. Comment sont calculés les heures sup, retards et absences

Cette section explique en détail la **logique de calcul** appliquée par l'application. Elle permet à un manager ou à un salarié de **comprendre** un chiffre affiché et de **prévenir** les surprises.

### 10.1 Les heures supplémentaires

L'application reconnaît **deux types** d'heures sup :

#### Heures sup quotidiennes

Calculées **chaque jour** en comparant les heures réellement pointées aux heures planifiées sur le poste.

**Cas générateurs :**
1. **Arrivée anticipée** : pointage d'entrée plus tôt que l'heure d'embauche, déduction faite de la tolérance d'arrivée.
2. **Travail pendant la pause repas** : sortie matin tardive + entrée après-midi anticipée → l'intervalle compte en HS.
3. **Départ tardif** : pointage de sortie plus tard que l'heure de débauche, déduction faite de la tolérance de sortie.

**Paramètres qui interviennent :**
- Tolérances avant/après embauche et débauche (sur le poste)
- Plages horaires du poste (matin, après-midi)
- Durée du panier repas (toujours déduite des HS)

**Garde-fous :**
- Les HS ne peuvent jamais dépasser le temps réellement travaillé ce jour-là.
- La pause repas est **toujours déduite**, même si le salarié a pointé pendant.
- Un jour de repos travaillé : toute heure pointée devient HS (puisqu'il n'y avait pas d'heure planifiée).

#### Heures sup hebdomadaires

Calculées **chaque semaine** en comparant le total des heures travaillées au seuil hebdomadaire contractuel (35 h en France par défaut, 40 h ou 44 h ailleurs).

**Formule :**
> HS hebdo = (heures travaillées + heures de jours fériés + heures de congés payés) − seuil hebdomadaire

**Tranches et taux :**
Les HS hebdomadaires sont réparties en **tranches** avec des taux de majoration croissants. La grille typique en France :

| Tranche | Plage | Taux |
|---|---|---|
| 1 | les 5 premières HS de la semaine (36ᵉ → 40ᵉ h) | +25 % |
| 2 | de la 6ᵉ à la 8ᵉ HS (41ᵉ → 43ᵉ h) | +50 % |
| 3 | au-delà | +100 % |

**Exemple chiffré :**
- Contrat 35 h/semaine, tranche 1 = 5 h à +25 %, tranche 2 = au-delà à +50 %.
- Semaine réelle : 42 h travaillées.
- HS hebdo = 42 − 35 = **7 h**.
- Répartition : 5 h en tranche 1 (+25 %), 2 h en tranche 2 (+50 %).

**Paramètres qui interviennent :**
- Seuil hebdomadaire (paramètres société)
- Plafonds par tranche (paramètres société)
- Taux par tranche (paramètres société)
- Plafond journalier (ex. 4 h HS/jour max)
- Plafond mensuel (ex. 50 h HS/mois max — au-delà, l'application ne paye plus mais comptabilise pour récupération)

**Cas particuliers :**
- **Cadres au forfait** : pas d'HS calculées, les heures excédentaires sont ignorées (option à activer sur la catégorie).
- **Jours fériés travaillés** : peuvent être inclus ou exclus du calcul HS (option « éliminer fériés du calcul HS » dans les paramètres).

### 10.2 Les retards

**Principe** : un retard est une **arrivée tardive sur une plage horaire prévue**, mesurée en minutes.

**Mesure :**
> Retard brut = heure d'embauche prévue − heure d'arrivée réelle

**Tolérance :**
Si le retard brut est **inférieur à la tolérance d'arrivée** (ex. 5 min), il est **annulé** : pas de retard comptabilisé.

> Exemple : embauche 08:00, tolérance 5 min, arrivée 08:04 → retard brut 4 min → annulé → retard = 0.

**Sanction :**
Si le retard dépasse un **seuil de déclenchement** (ex. 30 min), un coefficient multiplicateur s'applique :

> Total décompté = retard brut × coefficient

**Exemple chiffré :**
- Tolérance arrivée : 5 min
- Seuil de déclenchement : 30 min
- Coefficient : 2
- Arrivée 08:40 (retard brut 40 min)
- Le seuil de 30 min est dépassé → **80 min sont décomptées** (40 × 2)
- Effet : le salarié perd 1h20 de salaire pour 40 min de retard réel.

**Cas spéciaux :**
- **Retard > 3 heures** : l'application considère que c'est une absence demi-journée, pas un retard.
- **Autorisation active** : si le salarié a une autorisation de sortie validée chevauchant la plage, le retard est neutralisé.
- **Sortie anticipée** : règle symétrique (départ avant l'heure prévue déduction faite de la tolérance).

**Paramètres qui interviennent :**
- Tolérance avant/après embauche (sur le poste)
- Tolérance avant/après débauche (sur le poste)
- Seuil de déclenchement sanction (sur le poste)
- Coefficient multiplicateur (sur le poste)
- Pénalité minimum (plancher de retenue)

### 10.3 Les absences

**Principe** : une absence est **un temps de travail prévu mais non effectué**.

**Détection :**
- **Aucun pointage du jour** → absence complète (= heures théoriques du poste pour ce jour).
- **Pointage partiel** (seulement le matin, pas l'après-midi) → absence sur la demi-journée manquante.

**Exclusions automatiques :**
L'application ne compte **pas** comme absence :
- Un jour férié payé,
- Un congé payé approuvé (matin, après-midi, jour entier),
- Une autorisation d'absence approuvée et rémunérée,
- Une mission en cours.

**Cas autorisation non rémunérée :**
Si une autorisation non payée est active, l'absence reste comptabilisée mais le motif est rattaché à l'autorisation (pas à une absence injustifiée).

**Calcul horaire :**

> Absence = heures théoriques du jour − (heures travaillées + heures autorisées non rémunérées)

**Exemple :**
- Poste prévu : 8 h (matin 09:00-12:00 = 3 h, après-midi 13:00-18:00 = 5 h)
- Pointage : 09:00 entrée, 12:00 sortie matin, **rien l'après-midi**
- Absence = **5 h** (toute la plage après-midi manquée)

**Demi-journée vs jour entier :**
Le système reconnaît les demi-journées (paramétrées sur le poste : minimum d'heures demi-journée) et arrondit l'absence en conséquence : un absence de 6 h sur une journée de 8 h est traitée comme un jour entier d'absence, pas comme un demi-jour.

**Garde-fou tolérance :**
Une différence < 15 min entre prévu et pointé n'est pas comptée en absence : c'est traité comme un retard mineur (cf. §10.2).

**Paramètres qui interviennent :**
- Heures théoriques par jour (sur le poste)
- Minimum demi-journée (sur le poste)
- Retenue absence (sur le poste)
- Nature des absences (catalogue §3) — détermine si payée ou pas
- Catalogue des jours fériés (§4)

### 10.4 Les heures de nuit

**Principe** : travail dans la **plage nocturne** (ex. 22:00 → 06:00 le lendemain) bénéficie souvent d'une majoration légale.

**Calcul :**
L'application calcule l'intersection entre la plage du salarié pointée et la plage nuit configurée dans les paramètres société.

**Exemple :**
- Plage nuit configurée : 22:00 → 06:00
- Pointage : entrée 21:00, sortie 05:00
- Heures de nuit = intervalle [22:00 → 05:00] = **7 h**.

**Paramètres qui interviennent :**
- Plage horaire nuit (paramètres société — heure début, heure fin)
- Plage horaire nuit spéciale (2ᵉ fenêtre optionnelle)
- Option « pas de repos nuit si sortie en journée » (évite le double comptage)
- Minutes à déduire du panier nuit

**Cas spéciaux :**
- Passage de minuit : le système gère correctement le changement de date.
- Si la sortie est avant minuit, les heures de nuit ne sont pas comptées même si le salarié a touché la plage théorique.

### 10.5 Jour férié travaillé

**Principe** : si un salarié travaille un jour férié, ses heures sont valorisées **selon une règle paramétrable**.

**Règles possibles** (paramètre société) :
- **Compté comme jour normal** : pas de majoration.
- **Majoré simple** (+50 %, +100 %) : tarif d'heure férié.
- **Récupération** : génère un jour de repos compensateur supplémentaire.

**Exemple :**
- 14 juillet, salarié pointe 09:00–17:00 = 8 h
- Règle paramétrée : majoration +100 %
- Effet en paie : 8 h **doublées** (16 h au tarif standard).

**Paramètres qui interviennent :**
- Calendrier des jours fériés (§4)
- Règle de majoration férié travaillé (paramètres société)
- Plafond mensuel de jours fériés rémunérés (paramètres société)
- Option « éliminer fériés du calcul HS » (paramètres société)

### 10.6 Synthèse : les paramètres qui pilotent les calculs

| Calcul | Paramètres principaux | Localisation |
|---|---|---|
| **HS quotidiennes** | Tolérances embauche/débauche, plages horaires, durée panier | Poste de travail |
| **HS hebdomadaires** | Seuil hebdo, plafonds par tranche, taux par tranche, plafonds journalier/mensuel | Paramètres société (onglet HS) |
| **Retards** | Tolérance arrivée, seuil sanction, coefficient | Poste de travail |
| **Absences** | Heures théoriques du jour, minimum demi-journée, nature des absences | Poste + catalogue absences |
| **Heures de nuit** | Plage nuit, minutes panier nuit | Paramètres société (onglet nuit) |
| **Férié travaillé** | Règle majoration, plafond mensuel | Paramètres société + calendrier |

---

## 11. Gestion des employés

### 11.1 Fiche employé

#### À quoi ça sert

La fiche est le **dossier RH complet** d'un salarié : identité, coordonnées, affectation, contrat, historique des absences, documents personnels.

C'est le point central de toute l'application : sans fiche employé, aucun pointage, aucune absence, aucun contrat ne peut être lié.

#### Qui utilise

- **Administrateur / RH** : création, modification complète.
- **Manager** : consultation et modification partielle pour son équipe.
- **Salarié** : consultation et modification de ses propres coordonnées (téléphone, adresse, photo).

#### Champs principaux (regroupés par onglet)

**Onglet identité**
- **Matricule** : identifiant interne, généré automatiquement ou saisi (selon paramètre société). Apparaît sur les bulletins et badges.
- **Nom et prénom** : tels qu'ils apparaîtront sur le contrat et le bulletin.
- **Sexe** : utilisé pour les rapports d'effectifs et les calculs spécifiques (allaitement).
- **Date et lieu de naissance** : informations légales obligatoires.
- **Pièce d'identité** : numéro CIN / passeport / titre de séjour. Donnée sensible — **chiffrée** automatiquement.
- **Nationalité** : pour rapports d'effectifs et déclarations CNSS.
- **Photo de profil** : affichée dans les listes, sur les badges, dans la mobile.

**Onglet coordonnées**
- **Email professionnel** : sert au login, aux notifications, à la réinitialisation de mot de passe.
- **Téléphone mobile** : pour SMS éventuels et contact urgent.
- **Adresse complète** : pour bulletin, contrat, documents légaux.

**Onglet affectation**
- **Société** : pour multi-sociétés.
- **Site** : lieu physique de travail (impacte géofence et droits à congé locaux).
- **Direction / Service / Section** : place dans l'organigramme. Détermine qui est le manager validateur.
- **Fonction** : intitulé du poste.
- **Qualification** : diplôme ou habilitation.
- **Catégorie** : cadre, maîtrise, exécutant — pilote les règles HS.
- **Classe horaire** : planning annuel à appliquer (cf. §6).
- **Manager direct** : qui valide les demandes du salarié.

**Onglet contrat**
- **Type de contrat** : CDI, CDD, stage, alternance, intérim.
- **Date d'embauche** : début légal du contrat.
- **Date de sortie** : laissée vide tant que le salarié est en poste.
- **Salaire brut** : pour préparation paie.

**Onglet soldes**
- **Solde congés payés** : nombre de jours disponibles.
- **Solde RTT** : si applicable.
- **Solde CET** : épargne temps cumulée (§14).

**Onglet documents**
- **Pièces jointes** : CIN scannée, diplômes, contrat signé. Stockées dans le coffre numérique personnel.

#### Bonnes pratiques

- Saisir **toutes les données d'affectation** dès la création : sans elles, le salarié ne peut pas pointer correctement.
- Utiliser l'**import Excel** pour saisir plusieurs salariés d'un coup (à partir du pack Standard).
- Activer le **scan OCR** (pack Premium) pour pré-remplir la fiche depuis une photo de CIN/passeport.

### 11.2 Missions

#### À quoi ça sert

Une mission désigne un **déplacement temporaire** d'un salarié hors de son site habituel : formation, intervention client, chantier, salon professionnel.

L'intérêt : tracer la présence du salarié pendant la mission **sans qu'il pointe** sur sa badgeuse habituelle, et générer automatiquement une absence rémunérée « Mission ».

#### Qui utilise

- **Administrateur / RH / Manager** : création.
- **Salarié** : consultation de ses missions affectées.

#### Champs principaux

| Champ | Rôle |
|---|---|
| **Salarié affecté** | Qui part en mission. |
| **Date début / date fin** | Période couverte. |
| **Site / localisation** | Adresse du déplacement (utile pour notes de frais). |
| **Nature** | Type de mission (formation, chantier, RDV client). Liée à une nature d'absence (cf. §3). |
| **Description** | Détail de l'objet de la mission. |
| **Devise** | Si frais en devise étrangère, pour les notes de frais associées. |

#### Bonnes pratiques

- Créer la mission **avant le déplacement** : évite que le système comptabilise une absence injustifiée.
- Le salarié voit sa mission depuis son espace personnel et peut y rattacher ses **notes de frais** (§12).

### 11.3 Allaitement

#### À quoi ça sert

Aménagement légal pour les jeunes mamans : **temps de pause aménagé** chaque jour pour l'allaitement (typiquement 1 h/jour pendant 12 mois après la naissance).

L'application déduit automatiquement ce temps de la journée de travail sans pénaliser le salaire.

#### Qui utilise

- **Administrateur / RH** : création de l'aménagement à la demande de la salariée.
- **Salariée concernée** : consultation.

#### Champs principaux

| Champ | Rôle |
|---|---|
| **Salariée** | La mère bénéficiaire. |
| **Date début** | Reprise du travail post-congé maternité. |
| **Date fin estimée** | Typiquement 12 mois après naissance. Modifiable si l'allaitement se prolonge. |
| **Nombre d'heures/jour** | Aménagement (1 h typique). |

#### Bonnes pratiques

- Données médicales sensibles : accès **strictement limité** au RH et au manager direct.
- Génère automatiquement une absence « Allaitement » rémunérée chaque jour ouvré sur la période.

### 11.4 Coffre numérique

#### À quoi ça sert

Le coffre est un **stockage sécurisé de documents** lié à un salarié : CIN, diplômes, contrat signé, attestations, fiches de paie, courriers RH.

Les documents sont **chiffrés** au repos et accessibles uniquement au salarié concerné, à son manager et à l'administrateur. Idéal pour respecter le RGPD tout en gardant les pièces accessibles.

#### Qui utilise

- **Salarié** : dépôt et consultation de ses documents.
- **Administrateur / RH** : dépôt de documents officiels (contrat signé, attestation employeur), consultation globale.

#### Fonctionnalités

| Fonction | Rôle |
|---|---|
| **Upload** | Dépôt d'un fichier (PDF, image, Word). Limite typique : 50 Mo par fichier. |
| **Catégories** | Classement (Identité, Contrats, Bulletins, Attestations…). |
| **Métadonnées** | Titre, date, niveau de confidentialité. |
| **Versioning** | Garde l'historique des versions (un contrat puis son avenant). |
| **Partage temporaire** | Génération d'un lien public avec expiration (48 h, 7 j, 30 j) pour transmettre un document à un tiers (banque, administration). |
| **Signature électronique** | Workflow d'envoi pour signature à valeur légale. |

### 11.5 Vue Vault (administrateur)

#### À quoi ça sert

Vue globale **supervisable par l'administrateur** sur tous les coffres employés : permet de retrouver rapidement un document, de vérifier la complétude des dossiers RH (qui n'a pas déposé sa CIN ?), d'auditer les accès.

#### Qui utilise

- **Administrateur** uniquement.

#### Fonctionnalités

- **Recherche transversale** : par nom de salarié, type de document, date de dépôt.
- **Filtre** : par site, service, catégorie de document.
- **Détection des manquants** : rapport « dossiers incomplets » (CIN absente, contrat non signé…).
- **Audit** : journal des consultations (qui a téléchargé quoi, quand).

#### Bonnes pratiques

- Définir une **checklist obligatoire** par type de salarié (CIN + contrat signé + RIB minimum).
- Faire une **revue trimestrielle** des dossiers incomplets et relancer les salariés concernés.

---

## 12. Notes de frais

### À quoi ça sert

Permet au salarié de **déclarer ses dépenses professionnelles** (hôtel, transport, repas, fournitures) avec pièces justificatives, et au manager de les valider pour remboursement.

Évite les fichiers Excel transitant par email et les pertes de justificatifs papier.

### Qui utilise

- **Salarié** : saisie de ses propres frais.
- **Manager** : validation des frais de son équipe.
- **Administrateur** : vue globale et intégration en paie.

### Champs principaux

| Champ | Rôle |
|---|---|
| **Date de la dépense** | Date à laquelle la facture/ticket a été émise. |
| **Type de dépense** | Catégorie (hôtel, transport, repas, fournitures, péage, parking…). |
| **Montant** | Valeur HT ou TTC selon convention de l'entreprise. |
| **Devise** | EUR par défaut, autre si déplacement à l'étranger. Conversion automatique au taux du jour. |
| **Justificatif** | Photo ou PDF de la facture/ticket. Obligatoire au-delà d'un seuil (ex. 25 €). |
| **Mission rattachée** | Si la dépense est liée à une mission (§11.2), la sélectionner pour le rattachement comptable. |
| **Commentaire** | Justification pour les frais inhabituels. |

### Workflow

1. **Salarié** saisit la note depuis le web ou la mobile, joint la photo du ticket.
2. **Manager** reçoit la notification et valide via la fiche détaillée (consultation du justificatif).
3. Si refusé, le manager doit donner un motif obligatoire.
4. **Administrateur** voit toutes les notes approuvées en fin de mois → export Excel pour intégration paie (rubrique « Remboursement »).

### Bonnes pratiques

- Définir des **plafonds par type** dans le règlement interne (max 100 € hôtel/nuit, max 25 € repas).
- Demander **systématiquement le justificatif** : sans pièce, refus automatique.
- Clôturer les notes du mois **avant le 25** pour intégration paie.

---

## 13. Affectation des soldes

### À quoi ça sert

Permet à l'administrateur d'**ajuster manuellement** les soldes de congés d'un salarié : régulariser une erreur, attribuer un congé exceptionnel, créditer un avoir.

Sans ce module, les soldes ne sont modifiables que par les workflows automatiques (demande approuvée, génération mensuelle, jour férié).

### Qui utilise

- **Administrateur** uniquement.

### Champs principaux

| Champ | Rôle |
|---|---|
| **Salarié** | Bénéficiaire de l'ajustement. |
| **Type de solde** | Congé payé annuel, RTT, congé exceptionnel, CET… |
| **Sens** | Crédit (ajout de jours) ou débit (retrait). |
| **Quantité** | Nombre de jours ou d'heures. |
| **Motif** | Justification obligatoire (régularisation suite à erreur, anniversaire entreprise, naissance enfant…). |
| **Date d'effet** | Quand l'ajustement entre en vigueur. |
| **Date d'expiration** | Optionnelle — pour un crédit limité dans le temps. |

### Bonnes pratiques

- Saisir un **motif détaillé** : sera consulté lors d'audits ou de contestations.
- Toute affectation est **tracée dans l'audit log** avec identité de l'admin.
- Privilégier les **workflows automatiques** quand c'est possible (ne pas créditer manuellement les RTT mensuels, paramétrer plutôt la génération).

---

## 14. Compte Épargne Temps (CET)

### À quoi ça sert

Le CET permet à un salarié de **mettre de côté des jours de congé non pris** pour les utiliser ultérieurement ou les convertir en salaire.

Dispositif légal courant (France, certains pays maghrébins), utile pour fidéliser les salariés et lisser leur temps de repos sur plusieurs années.

### Qui utilise

- **Administrateur / RH** : gestion des reports et conversions.
- **Salarié** : consultation de son solde CET.

### Champs principaux

| Champ | Rôle |
|---|---|
| **Salarié** | Titulaire du CET. |
| **Solde CET actuel** | Nombre de jours actuellement épargnés. |
| **Historique des reports** | Liste des opérations : date, quantité, motif (congé non pris transféré, RTT non pris…). |
| **Historique des conversions** | Conversions en salaire ou en repos pris. |
| **Plafond annuel** | Nombre max de jours pouvant entrer en CET chaque année (paramètres société). |
| **Date limite de transfert** | Au-delà de cette date (typiquement 31 mai), les congés non pris basculent automatiquement en CET (paramètres société). |

### Workflow type

1. Le salarié n'a pas pris tous ses congés au 31 mai.
2. Le système **bascule automatiquement** le reliquat dans le CET (jusqu'au plafond annuel).
3. Le salarié peut, plus tard, demander à **convertir le CET en repos** (poser des jours sur le CET) ou en **paiement** (versement avec le salaire).

### Bonnes pratiques

- Communiquer aux salariés sur leur **solde CET** : ils l'oublient souvent.
- Définir une **politique claire** : conversion paie autorisée à partir de combien de jours ? Délai de prévenance ?

---

## 15. Paramètres société et calendrier

### 15.1 Paramètres société

#### À quoi ça sert

C'est le **panneau de contrôle central** qui définit les règles de calcul appliquées par toute l'application : tolérances, arrondis, seuils d'heures sup, plages nuit, mois de paie, droits à congé.

Un changement ici **impacte tous les pointages et toutes les paies futures**. À manipuler avec précaution.

#### Qui utilise

- **Administrateur** uniquement.

#### Sections paramétrables

**Section générale**
- **Affichage de l'échéance des contrats** sur la page d'accueil.
- **Mode de calcul des semaines** (calendrier société ou lundi-dimanche fixe).
- **Longueur du matricule auto-généré** (6 chiffres → « 000001 »).
- **Format d'export paie** (compatible Sage, Navision, autre).

**Section arrondis de pointage**
- **Arrondi global** des pointages (à la 5, 10 ou 15 min).
- **Seuil de bascule arrondi entrée/sortie** : à partir de combien de minutes restantes on arrondit vers le haut.
- **Arrondi spécifique des HS**.

**Section mois de paie**
- **Premier jour du mois de paie** (1ᵉʳ janvier, 26 du mois courant, etc.).
- **Dernier jour** (dernier jour du mois, 25 du mois suivant…).

**Section congés et repos**
- **Heures de congé annuel** (plafond).
- **Durée d'un jour férié payé** (typiquement 8 h).
- **Règle pour jour férié travaillé** (compté normal, majoré, doublé).
- **Jours de repos hebdomadaires fixes** (samedi-dimanche par défaut).

**Section heures supplémentaires**
- **Tranches hebdomadaires** : jusqu'à 5 h à +25 %, ensuite +50 %, etc.
- **Tranches mensuelles** : limite cumulée sur le mois.
- **Plafonds journaliers et mensuels**.

**Section heures de nuit**
- **Activation du calcul nuit**.
- **Plage horaire nuit** (22:00 → 06:00 par défaut).
- **2ᵉ fenêtre nuit spéciale** optionnelle.

**Section catégories**
- **Activation des règles spécifiques** par catégorie (cadres, maîtrise, exécutants).
- **Heures incluses au forfait cadre** (heures nuit, HS non payées).

**Section absences**
- **Permettre la saisie manuelle** d'absence (sinon réservée aux pointages effectifs).
- **Limiter les congés à certaines périodes** (blackout dates).
- **Imposer la semaine complète** pour un congé.

**Section CET**
- **Date limite de transfert** (cf. §14).
- **Plafond annuel de jours CET**.

**Section affichage**
- **Séparateur décimal** (virgule française ou point anglais).
- **Pourcentage de saisie congé par salarié** (le reste reste à la main de l'admin).

#### Bonnes pratiques

- Lire chaque paramètre **avant de modifier** : un mauvais réglage peut générer des erreurs sur des centaines de bulletins de paie.
- Faire une **sauvegarde** ou prendre une capture d'écran de l'état actuel avant tout changement majeur.
- Tester sur **un mois** avant de généraliser : créer un salarié de test, simuler un mois complet, vérifier la paie obtenue.

### 15.2 Calendrier société

#### À quoi ça sert

Le **calendrier annuel** des jours non travaillés : jours fériés (§4), fermetures collectives (15-31 août pour beaucoup d'entreprises), ponts attribués.

Sans ce calendrier, l'application considère tous les jours comme ouvrés et compte les jours non travaillés comme absences.

#### Qui utilise

- **Administrateur** uniquement.

#### Fonctionnalités

- **Saisie manuelle** d'un jour férié ou d'une fermeture.
- **Import automatique** des jours fériés du pays pour l'année.
- **Vue calendrier** mensuelle/annuelle pour vérification visuelle.
- **Différenciation** : férié payé / fermeture non payée / pont / journée exceptionnelle.

#### Bonnes pratiques

- Saisir le calendrier **chaque début d'année** (idéalement décembre/janvier).
- Si vous avez plusieurs sociétés/pays, **calendrier distinct par société** : les fériés diffèrent.
- Re-saisir les **fermetures collectives** spécifiques à l'entreprise (semaine entre Noël et Nouvel An, par exemple).

---

## Conclusion

Ce guide couvre les principaux modules métier de Concorde Workforce et la mécanique de calcul des heures.

**Trois principes à retenir :**

1. **Le poste de travail est la brique de base** : sans poste bien paramétré, aucun calcul ne peut être correct.
2. **Le pointage du mois est la source de vérité** pour la paie : tous les autres écrans sont des vues filtrées de ces mêmes données.
3. **Les paramètres société pilotent l'ensemble** : un changement de paramètre rétroagit sur tout le système, donc à manipuler avec précaution et toujours après simulation.

Pour toute question complémentaire, consultez le module Support (`/dashboard/support`) ou contactez votre formateur Concorde Workforce.

---

> **Document généré pour utilisateur final — Mai 2026.**
