# RAPPORT DE FORMATION — Concorde Workforce
## Plateforme web : inventaire fonctionnel complet et guide formateur

> **Destinataire** : Agent de formation client
> **Version** : Mai 2026
> **Périmètre** : Plateforme web (`https://{tenant}.concorde-work-force.com`) — admin, manager, salarié
> **Objectif** : Permettre au formateur de couvrir intégralement les fonctionnalités lors des sessions client, avec compréhension du rôle de chaque champ.

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Rôles et droits d'accès](#2-rôles-et-droits-daccès)
3. [Données de base](#3-données-de-base)
4. [Paramètres](#4-paramètres)
5. [Module Pointage](#5-module-pointage)
6. [Module Gestion des employés](#6-module-gestion-des-employés)
7. [Module Gestion des contrats](#7-module-gestion-des-contrats)
8. [Module Congés et validations](#8-module-congés-et-validations)
9. [Module Absences, autorisations, heures sup](#9-module-absences-autorisations-heures-sup)
10. [Module Notes de frais, Missions, Allaitement, Télétravail](#10-modules-notes-de-frais-missions-allaitement-télétravail)
11. [Module Préparation paie](#11-module-préparation-paie)
12. [Module Rapports et États](#12-module-rapports-et-états)
13. [Module Administration](#13-module-administration)
14. [Module Coffre numérique et Documents](#14-module-coffre-numérique-et-documents)
15. [Module Intelligence Artificielle](#15-module-intelligence-artificielle)
16. [Application mobile (vue salarié)](#16-application-mobile-vue-salarié)
17. [Abonnement et facturation](#17-abonnement-et-facturation)
18. [Scénarios de formation type](#18-scénarios-de-formation-type)
19. [Annexes](#19-annexes)

---

## 1. Vue d'ensemble

### 1.1 Positionnement produit

**Concorde Workforce** est une plateforme SaaS de **gestion du temps de travail et des ressources humaines** pour TPE/PME et grandes entreprises. Elle couvre :

- Pointage (badgeuse, mobile, manuel)
- Gestion des employés (fiches, contrats, qualifications)
- Workflows RH (congés, absences, télétravail, notes de frais, missions)
- Préparation paie (sans calcul de cotisations — interface avec un logiciel paie tiers)
- Reporting (états de présence, retards, absences, cahier de congés)
- Conformité RGPD (notice info, rétention, géolocalisation paramétrable)

### 1.2 Architecture multi-tenant

- Chaque client (= « tenant ») accède via son propre sous-domaine : `acme.concorde-work-force.com`
- Données isolées en base : une base PostgreSQL par tenant
- Inscription en self-service (`/signup`) : essai gratuit 30 jours sans CB
- 3 packs commerciaux : **Starter / Standard / Business** + modules optionnels facturables

### 1.3 Stack utilisateur

- **Web** : React + MUI, responsive
- **Mobile** : application iOS/Android (téléchargement APK direct ou stores)
- **Authentification** : email + mot de passe, OTP de vérification, 2FA optionnel, biométrie sur mobile

### 1.4 Public utilisateur

3 publics principaux :

| Public | Activité quotidienne |
|---|---|
| **Administrateur / DRH** | Paramètre, gère utilisateurs, valide la paie, surveille la conformité |
| **Manager** | Valide congés/absences, consulte pointages de son équipe |
| **Salarié** | Pointe, demande congé/télétravail/autorisation, dépose ses notes de frais et documents |

---

## 2. Rôles et droits d'accès

### 2.1 Les 4 rôles système

#### Administrator (Administrateur)
- **Couleur UI** : rouge
- **Description** : accès total. Configure, paramètre, gère utilisateurs et rôles.
- **Profil type** : DG, responsable IT, super-admin du tenant.

#### ResponsableRH
- **Couleur UI** : violet
- **Description** : gestion complète employés/contrats/congés/préparation paie. Pas d'administration système.
- **Profil type** : DRH, responsable paie, responsable congés.

#### Manager
- **Couleur UI** : bleu
- **Description** : supervision opérationnelle (équipe, pointages, validations). Pas de paie, pas d'admin.
- **Profil type** : chef de service, responsable d'équipe.

#### Employee (Salarié)
- **Couleur UI** : vert
- **Description** : consultation de son dossier, dépôt de demandes (congé, absence, télétravail, autorisation, notes de frais).
- **Profil type** : tout collaborateur sans responsabilité hiérarchique.

### 2.2 Matrice des permissions par module

Actions : **C** = Consulter, **A** = Ajouter, **M** = Modifier, **D** = Supprimer.

| Module | Admin | ResponsableRH | Manager | Salarié |
|---|---|---|---|---|
| Absences & sanctions | CAMD | CAMD | CAMD | C |
| Pointage & temps | CAMD | CAMD | CAMD | C |
| Gestion employés | CAMD | CAMD | CAM | — |
| Contrats & avenants | CAMD | CAMD | CA | C |
| Paie & rémunération | CAMD | CAM | C | — |
| Gestion des congés | CAMD | CAMD | CAMD | CA |
| Données de base | CAMD | C | C | — |
| Paramètres de temps | CAMD | C | CA | — |
| Rapports & stats | CAMD | C | C | — |
| Administration | CAMD | — | — | — |

### 2.3 Restrictions liées au pack commercial (« plan features »)

Certaines fonctionnalités sont **désactivées** dans les packs entrée de gamme — l'entrée n'apparaît même pas dans le menu latéral.

| Fonctionnalité | Starter | Standard | Business |
|---|---|---|---|
| Pointage web + mobile | ✓ | ✓ | ✓ |
| Demandes congé / absence / autorisation | ✓ | ✓ | ✓ |
| Multi-sites (max 5) | — | ✓ | illimité |
| Géolocalisation pointage / missions | — | ✓ | ✓ |
| Coffre numérique + signature électronique | — | ✓ | ✓ |
| Contrats, modèles de contrats | — | ✓ | ✓ |
| Notes de frais, missions, allaitement, télétravail | — | ✓ | ✓ |
| Import Excel en masse | — | ✓ | ✓ |
| Scan OCR de pièces d'identité | — | — | ✓ |
| IA (chat RAG, lettres assistées) | — | — | ✓ |
| Audit logs avancés, branding custom | — | — | ✓ |
| Sécurité renforcée (device trust, anti-screenshot) | — | — | ✓ |

> **Note formateur** : avant chaque démo, vérifier le pack du tenant client pour ne pas montrer des modules qu'il n'aura pas. La page `/dashboard/mon-abonnement` indique le pack en cours.

---

## 3. Données de base

Les « Données de base » sont les **référentiels** que l'admin doit paramétrer **avant** d'utiliser l'application en production. Sans elles, les fiches employés et les pointages ne peuvent pas fonctionner.

### 3.1 Ordre de paramétrage recommandé

À présenter dans cet ordre lors d'un onboarding client :

1. **Société** (informations sur l'entreprise du tenant)
2. **Site / Filiale** (lieux physiques de travail)
3. **Structure organisationnelle** : Direction → Service → Section
4. **Fonctions** et **Qualifications**
5. **Catégorie** d'employé (cadre, maîtrise, exécutant)
6. **Poste de travail** (horaires d'une journée type)
7. **Classe horaire** (cycle d'horaires sur l'année)
8. **Intitulés d'absences** (catalogue des motifs)
9. **Jours fériés** (calendrier annuel)
10. **Rubriques de paie** (éléments rémunération pour export paie)
11. **Pays / Nationalité / Ville** (référentiels géographiques)

### 3.2 SOCIÉTÉ

- **Page** : `/dashboard/gestion-societe` puis `/dashboard/societe` pour les paramètres détaillés
- **Rôle requis** : Administrateur
- **Description** : entité racine du tenant. Affecte les libellés, le SMIG, les heures mensuelles standard, et tout ce qui est exporté en PDF (logo, en-têtes).

| Champ technique | Libellé UI | Type | Obligatoire | Rôle métier |
|---|---|---|---|---|
| Soccod | Code société | 2 car. | Oui | Identifiant court (« 01 », « FR »). Apparaît dans les exports CNSS/paie. |
| Soclib | Libellé société | 30 car. | Oui | Raison sociale ou nom commercial (« ACME Maroc »). Affiché en haut du dashboard. |
| Socmere | Société mère | 6 car. | Non | Pour modéliser un groupe (filiales). Laisser vide si société autonome. |
| Socresp | Responsable | 30 car. | Non | Nom du DG ou responsable RH — informationnel. |
| Socadr | Adresse | 40 car. | Non | Adresse du siège social. |
| Socville | Ville | 60 car. | Non | Ville du siège. |
| Soctel | Téléphone | 20 car. | Non | Numéro principal. |
| Socfax | Fax | 20 car. | Non | Hérité — rarement utilisé. |
| Socemail | E-mail | 30 car. | Non | Email de contact RH/paie. |
| Socccb | N° CCB | 1 car. | Non | Compte courant postal/bancaire (export CNSS). |
| Soctva | Code TVA | 10 car. | Non | N° identifiant TVA (« MA12345678 »). |
| Soctva1/2/3/000 | Codes TVA secondaires | 1–3 car. | Non | Régimes spéciaux, exonérations. |
| Socreg | Régime | Entier | Non | Régime fiscal/social (1 = normal, 2 = simplifié). |
| Socmois | Heures par mois | Entier | Non | Heures standard mensuelles (ex. 173 en FR, 191 au Maroc). Base de calcul des HS. |
| Soctype | Type | 1 car. | Non | Classement interne (« S » = siège, « F » = filiale, « G » = groupe). |
| Socpresence | Présence obligatoire | O/N | Non | « O » : pointage obligatoire pour tous les employés. |
| Sochsup | Gérer heures sup | O/N | Non | « O » : active les calculs de majoration HS. |
| Socsmig | SMIG | Décimal | Non | Salaire minimum interprofessionnel (3 500,50 DH par exemple). Sert au contrôle des salaires de base. |
| Soclibar | Libellé barre | 100 car. | Non | Bandeau personnalisé affiché en haut (mentions légales, droits d'auteur). |
| Socadrar | Adresse complémentaire | 100 car. | Non | Adresse de correspondance différente du siège. |
| Socrespar | Responsable paie | 30 car. | Non | Nom du cabinet ou responsable paie interne. |
| Socimg | Logo société | Fichier | Non | Logo PNG/JPG affiché sur PDF (bulletins, contrats, courriers). |

### 3.3 SITE / FILIALE

- **Page** : `/dashboard/filiale`
- **Rôle requis** : Administrateur
- **Description** : lieu physique de travail. Plusieurs sites par société = multi-sites (pack Standard+). Chaque site peut avoir sa géofence GPS et ses propres droits à congé.

| Champ | Libellé UI | Type | Obligatoire | Rôle métier |
|---|---|---|---|---|
| Sitcod | Code site | 2 car. | Oui | Identifiant court (« 01 » = siège). |
| Soccod | Code société | 4 car. | Oui | Référence à la société parent. |
| Sitlib | Nom du site | 30 car. | Non | Libellé affiché (« Casablanca Centre », « Agence Lyon »). |
| Sitadr | Adresse | 30 car. | Non | Adresse physique. |
| Sittel / Sitfax / Sitemail | Coordonnées | — | Non | Contacts du site. |
| Sitmois | Mois de référence | Entier (0–11) | Non | Mois d'ouverture/exercice du site. |
| Sitconge | Droits congés / an | Décimal | Non | Nombre de jours de congé annuel (18, 20, 26…). Spécifique au site (utile multi-pays). |
| Sitcongem | Droits / mois | Décimal | Non | Génération mensuelle (= Sitconge / 12, ~1,5 j/mois). |
| Sitsoc | Rattaché paie | O/N | Non | « O » : site rattaché à un cycle paie commun. |
| Sitpaie | Code paie | 6 car. | Non | ID dans le logiciel paie externe. |
| Sitsanch / Sitsancm | Sanction matin / après-midi | O/N | Non | Activer les retenues pour absences matin/après-midi. |
| Sitlat | Latitude GPS | Décimal | Non | Coordonnée du centre du site (géofence). |
| Sitlon | Longitude GPS | Décimal | Non | Coordonnée du centre du site. |
| Sitrad | Rayon (m) | Entier | Non | Rayon autorisé pour pointage mobile (ex. 200 m). Au-delà → pointage refusé ou marqué « hors zone ». |

### 3.4 STRUCTURE ORGANISATIONNELLE

#### 3.4.1 Direction

- **Page** : `/dashboard/structure-organisationnelle`
- **Rôle requis** : Administrateur
- **Description** : niveau 1 de l'organigramme (Direction Générale, Direction Opérations…).

| Champ | Libellé UI | Type | Rôle métier |
|---|---|---|---|
| Dircod | Code direction | 4 car. | ID court (« DG », « OPS »). |
| Dirlib | Libellé | 30 car. | Nom complet (« Direction Générale »). |
| Dirloc | Localisation | 100 car. | Site / bureau de rattachement. |
| Dirtitre | Titre du responsable | 50 car. | « Directeur Général », « Directeur RH ». |
| Dirresp | Responsable | 100 car. | Nom du dirigeant. |
| Dirrespar | Responsable hiérarchique | 100 car. | Le N+1 (CEO si Direction = Ops, etc.). |
| Diremail | Email | 30 car. | Adresse contact direction. |

#### 3.4.2 Service

- **Page** : `/dashboard/structure-organisationnelle`
- **Rôle requis** : Administrateur
- **Description** : niveau 2, département opérationnel (Service IT, Service Comptabilité, Service Production). Utilisé pour filtrer rapports et restreindre la portée des managers.

| Champ | Libellé UI | Type | Rôle métier |
|---|---|---|---|
| Sercod | Code service | 4 car. | « IT », « COMPTA », « PROD ». |
| Serlib | Libellé | 30 car. | Nom complet du service. |
| Serloc | Localisation | 1 car. | Code interne ou flag. |
| Effectif | Effectif | Entier | Cible théorique d'employés (indicatif). |

#### 3.4.3 Section

- **Page** : `/dashboard/structure-organisationnelle`
- **Rôle requis** : Administrateur
- **Description** : niveau 3, sous-département (équipe Maintenance Électrique au sein du Service Maintenance par ex.).

| Champ | Libellé UI | Type | Rôle métier |
|---|---|---|---|
| Seccod | Code section | 10 car. | « ELEC », « LOG ». |
| Seclib | Libellé | 30 car. | Nom complet. |
| Sectype | Type | 10 car. | « PROD » (production), « SUPPORT ». |
| Effectif | Effectif | Entier | Indicatif. |

### 3.5 CATÉGORIE

- **Page** : intégrée dans Classe horaire
- **Rôle requis** : Administrateur
- **Description** : profil de travailleur (Cadre / Maîtrise / Exécutant). Détermine les règles horaires applicables et certaines majorations spécifiques.

| Champ | Libellé UI | Type | Rôle métier |
|---|---|---|---|
| Catcod | Code catégorie | 2 car. | « 01 » = cadre, « 02 » = maîtrise, « 03 » = exécutant. |
| Catlib | Libellé | 30 car. | Nom affiché (« Cadre », « Maîtrise »). |
| Cathsup | H. Sup applicables | O/N | « O » : la catégorie peut générer des heures sup majorées. Souvent « N » pour cadres au forfait. |
| Catperiode | Périodique | O/N | « O » : la catégorie a un cycle de plusieurs postes sur 52 semaines (rotatif 2×8, 3×8). |
| Catsem2…Catsem12 | Codes postes par semaine | 2 car. ×11 | Codes des postes appliqués pour les semaines paires du cycle (si périodique). |

### 3.6 FONCTION

- **Page** : `/dashboard/fonction`
- **Rôle requis** : Administrateur
- **Description** : intitulé de poste/métier (Développeur, Comptable, Magasinier). Apparaît sur la fiche employé et le contrat.

| Champ | Libellé UI | Type | Rôle métier |
|---|---|---|---|
| Foncod | Code fonction | 6 car. | « DEV », « COMPT ». |
| Fonlib | Libellé | 100 car. | « Développeur Senior », « Comptable Fournisseurs ». |
| Fontype | Type | 1 car. | « A » administratif, « T » technique, « O » opérationnel. |
| Fonpqual | Requiert qualification | O/N | « O » : nécessite une qualification spécifique (CACES, permis…). |
| Fonpchoix | Libre choix | O/N | « O » : le salarié peut sélectionner cette fonction lui-même. |

### 3.7 QUALIFICATION

- **Page** : `/dashboard/qualification`
- **Rôle requis** : Administrateur
- **Description** : diplôme, certificat ou habilitation (BTS, CACES 3, Permis C). Traçabilité des habilitations obligatoires.

| Champ | Libellé UI | Type | Rôle métier |
|---|---|---|---|
| Quacod | Code qualification | 4 car. | « BTS », « CACES3 ». |
| Qualib | Libellé | 100 car. | « BTS Maintenance », « CACES Catégorie 3 ». |
| Catcod | Catégorie | 10 car. | « DIPLOME », « PERMIS », « HABILITATION ». |

### 3.8 POSTE DE TRAVAIL

- **Page** : `/dashboard/saisie-poste-de-travail`
- **Rôle requis** : Administrateur
- **Description** : définit les **horaires d'une journée type** pour chaque jour de la semaine. Heure d'embauche, débauche, pause repas, tolérances de retard, sanctions, majorations, douches. C'est la **brique de base** de tout le calcul d'heures.

#### Identification du poste

| Champ | Libellé UI | Rôle métier |
|---|---|---|
| Codposte | Code poste | ID court (« 8H_BUREAU », « 3x8_MATIN », « NUIT »). |
| Libposte | Libellé | Nom descriptif (« Horaire bureau 8h-16h30 », « Poste 3×8 — Matin »). |

#### Tolérances avant / après embauche & débauche

| Champ | Libellé UI | Type | Rôle métier |
|---|---|---|---|
| Avantent | Avant embauche (min) | Entier | Tolérance d'arrivée en avance (5 min comptés comme à l'heure). |
| Apresent | Après embauche (min) | Entier | Tolérance d'arrivée en retard (5 min comptés comme à l'heure). |
| Avantsort | Avant débauche (min) | Entier | Tolérance de sortie en avance. |
| Apressort | Après débauche (min) | Entier | Tolérance de sortie en retard. |

#### Retenues / sanctions

| Champ | Libellé UI | Type | Rôle métier |
|---|---|---|---|
| Retsanc | Retenue absence (min) | Entier | Minutes retenues pour un jour d'absence non justifié. |
| Retmin | Retenue minimum (min) | Entier | Plancher de retenue par retard (ex. tout retard = au moins 15 min). |
| Retsancam | Retenue après-midi | Entier | Spécifique au demi-jour après-midi. |
| Retminam | Retenue min après-midi | Entier | Plancher AM. |

#### Bonus / avances

| Champ | Libellé UI | Rôle métier |
|---|---|---|
| Avabon / Avamn | Bonus matin / Avance matin | Minutes ajoutées si présence anticipée le matin. |
| Avabonam / Avamnam | Bonus / Avance après-midi | Idem pour l'après-midi. |

#### Horaires par jour de la semaine (lundi → dimanche)

Pour **chaque jour** (Lun, Mar, Mer, Jeu, Ven, Sam, Dim), les champs suivants sont déclinés avec préfixe `Lun…`, `Mar…`, etc. :

| Suffixe | Libellé UI | Rôle métier |
|---|---|---|
| `…hdmat` | Heure début matin | Ex. 08:00. |
| `…hfmat` | Heure fin matin | Ex. 12:00. |
| `…hdam` | Heure début après-midi | Ex. 14:00. |
| `…hfam` | Heure fin après-midi | Ex. 17:30. |
| `…repos` | Jour de repos | « O » = jour férié hebdomadaire, « N » = jour travaillé. |
| `…repas` | Durée panier repas (min) | Durée pause repas non comptée comme travail. |
| `…hdrep / …hfrep` | Plage de repos | Horaire d'ouverture des locaux si jour de repos. |
| `…douche` | Temps douche (h) | Allocation vestiaire/douche comptée comme travail (ex. 0,25 h). |
| `Maxhre…` | Max heures repos | Plafond d'heures de repos comptabilisables. |
| `Minhjour…` | Min heures jour | Minimum pour qu'une journée soit reconnue comme travaillée (ex. 360 min = 6h). |
| `Minhdemijour…` | Min heures demi-jour | Idem pour le demi-jour. |

#### Arrondi

| Champ | Libellé UI | Rôle métier |
|---|---|---|
| Arrondi | Arrondi pointage (min) | Tous les pointages arrondis à la N min (5, 10, 15). |
| Arrhsup | Arrondi heures sup (min) | Arrondi spécifique aux HS. |

> **Cas d'usage formateur** : un poste « 8H_BUREAU » suffit pour 80 % des cols blancs. Pour les usines, créer un poste par équipe de quart.

### 3.9 CLASSE HORAIRE

- **Page** : `/dashboard/saisie-classe-horaire`
- **Rôle requis** : Administrateur
- **Description** : **cycle d'horaires sur l'année** (52 semaines). Associe un ou plusieurs postes de travail à une période, et lie cette planification à une catégorie d'employés. C'est la classe horaire qui est **affectée à chaque employé** sur sa fiche.

| Champ | Libellé UI | Rôle métier |
|---|---|---|
| Code | Code classe | ID court (« CH_STD », « CH_3x8 »). |
| Libellé | Libellé | Nom descriptif (« 35h bureau », « Rotation 3×8 »). |
| Fréquence | Fréquence | **Périodique** : un seul poste appliqué toute la période. **Selon pointage** : rotation auto entre plusieurs postes basée sur l'heure de pointage réelle. |
| DateDébut / DateFin | Période de validité | Du 01/01 au 31/12 par défaut. |
| PosteAssocié | Poste de travail | Poste appliqué (mode périodique). |
| Catégories | Catégories cibles | Liste des catégories d'employés concernés. |
| Périodes saisonnières | Saisonnalités | Liste de plages (semaines X→Y) chacune avec son propre poste — pour les cycles rotatifs. |

### 3.10 INTITULÉ D'ABSENCES

- **Page** : `/dashboard/intitule-des-absences`
- **Rôle requis** : Administrateur
- **Description** : **catalogue des motifs d'absence** (Congé Payé, Maladie, Autorisation, Mission, Allaitement, AT…). Chaque absence pointée ou demandée est rattachée à un code de cette table.

| Champ | Libellé UI | Type | Rôle métier |
|---|---|---|---|
| Abscod | Code absence | 4 car. | « CP » congé payé, « MAL » maladie, « MIS » mission, « ALLAIT » allaitement. |
| Abslib | Libellé | 60 car. | « Congé Payé Annuel », « Maladie justifiée », « Absence injustifiée ». |
| Abscng | Décompte congé | O/N | « O » = décompte le solde de congés payés. |
| Abssanc | Sanction | O/N | « O » = déclenche une retenue (paie). |
| Abspayer | Rémunérée | O/N | « O » = jour payé à 100 %. |
| Abspar | Saisissable par employé | O/N | « O » = le salarié peut la demander lui-même. |
| Absrepos | Compte comme repos | O/N | « O » = comptée comme repos hebdomadaire. |
| Absunite | Unité | « J » / « H » / « 0.5 » | Jour entier, heure, ou demi-journée. |
| Absferier | Sur jour férié | O/N | « O » = s'applique aussi aux jours fériés. |
| Rubcod | Rubrique paie associée | 12 car. | Code de la rubrique paie (« CP_PAYEE »). |

### 3.11 JOURS FÉRIÉS / REPOS

- **Page** : `/dashboard/Repos`
- **Rôle requis** : Administrateur
- **Description** : **calendrier des jours fériés** nationaux/locaux et fermetures collectives. Chaque jour férié génère une absence pour tous les employés concernés.

| Champ | Libellé UI | Type | Rôle métier |
|---|---|---|---|
| Annee | Année | 4 car. | « 2026 ». |
| Ferdate | Date | Date | Date du jour férié (01/01/2026). |
| Fermotif | Motif | 20 car. | « Nouvel An », « Eid Al-Fitr », « 1er Mai ». |
| Ferfixe | Date fixe | O/N | « O » = même date chaque année (1er janv.). « N » = date variable (Eid, Pâques). |
| Fertype | Type | 1 car. | « F » férié, « C » fermeture usine, « R » repos collectif, « E » exceptionnel. |
| Ferheure | Nombre d'heures | Décimal | Heures travaillées ce jour-là (0 = jour entier off, 4 = demi-journée). |
| Fernpaye | Payé | O/N | « O » = jour payé à 100 % + majoration éventuelle. |

### 3.12 RUBRIQUE DE PAIE

- **Page** : `/dashboard/rubrique`
- **Rôle requis** : Administrateur
- **Description** : **éléments de paie** exploitables par le logiciel paie tiers (Sage, Navision, Cegid…). Concorde ne calcule pas la paie elle-même : il prépare et exporte ces rubriques.

| Champ | Libellé UI | Type | Rôle métier |
|---|---|---|---|
| Rubcod | Code rubrique | 10 car. | « R01 » salaire base, « R02 » HS 25 %, « R03 » indemnité transport. |
| Rublib | Libellé | 30 car. | Libellé court affiché. |
| Rubtype | Type | 5 car. | « GAIN » revenu, « RETENUE » déduction, « COTISATION » charge sociale. |
| Rubregime | Régime | 1 car. | « N » normal, « S » simplifié. |
| Vartype | Type variation | 5 car. | FIXE / PROPORTIONNEL (% du salaire) / HORAIRE / FORFAIT. |
| Rubunite | Unité | 1 car. | J (jour), H (heure), M (mois), F (forfait). |
| Rubtaux | Taux | Décimal | Valeur ou % (1.0 = 100 %, 0.25 = 25 %). |

### 3.13 PAYS

- **Page** : `/dashboard/pays`
- **Rôle requis** : Administrateur
- **Description** : référentiel ISO 3166. Lié aux nationalités, adresses, sites.

| Champ | Libellé UI | Rôle métier |
|---|---|---|
| Pycod | Code pays | « FR », « MA », « TN ». |
| Pylib | Libellé | « France », « Maroc », « Tunisie ». |

### 3.14 NATIONALITÉ

- **Page** : intégrée dans Pays
- **Rôle requis** : Administrateur
- **Description** : adjectif de nationalité (« Française », « Marocaine »).

| Champ | Libellé UI | Rôle métier |
|---|---|---|
| Natcod | Code nationalité | « FR », « MA ». |
| Natlib | Libellé | « Française », « Marocaine ». |

### 3.15 VILLE

- **Page** : `/dashboard/ville`
- **Rôle requis** : Administrateur
- **Description** : référentiel de villes (pour adresses employés, sites). Peut être importé en masse (35 000 communes françaises disponibles).

| Champ | Libellé UI | Rôle métier |
|---|---|---|
| Vilcod | Code ville | Code postal ou code INSEE (« 75001 », « 20000 »). |
| Villib | Libellé | Nom (« Paris », « Casablanca »). |

---

## 4. Paramètres

La table `parametre` (page `/dashboard/parametres` ou `/dashboard/societe`) contient l'essentiel de la configuration métier. **Tout y est lié à une société** : pour multi-sociétés, paramétrer chacune indépendamment.

### 4.1 Onglet GÉNÉRAL

| Champ | Libellé UI | Type | Rôle métier |
|---|---|---|---|
| affech | Afficher échéances contrat à l'accueil | O/N | Affiche un rappel sur le dashboard des contrats expirant prochainement. |
| parsem | Calcul heures semaine (ignore calendrier) | O/N | « O » : ignore le calendrier société, calcule lundi→dimanche fixe. |
| planhoraire | Utiliser plan calendrier | O/N | « O » : les calendriers de production définissent les jours ouvrés. « N » : tous les jours sont égaux sauf fériés. |
| longbdg | Longueur matricule | Entier | Nombre de chiffres du matricule auto (6 = « 000001 »). |
| parallaite | Code absence allaitement | 12 car. | Code de l'absence « allaitement » pour retenues paie spéciales. |
| parabsconge | Même numérotation absence + congé | O/N | « O » : numérotation commune absences et congés. |
| paie | Intégration paie | 1 = Sage, 2 = Navision | Format d'export paie. |
| paiearrondi | Arrondir cumul mensuel | 0 / 0,5 / 1 (h) | Arrondit le total mensuel des heures à la valeur choisie. |
| parhnuitspec | Intitulé nuit spéciale | 20 car. | Libellé personnalisé (défaut « Nuit »). |
| parjhnlibre | Diviseur heures nuit | Décimal | Divise chaque heure nuit (utile équipes rotatives). |

### 4.2 Onglet ARRONDI DE POINTAGE

| Champ | Libellé UI | Type | Rôle métier |
|---|---|---|---|
| arrondi | Arrondi pointage | Entier (min) | Arrondit chaque pointage à la min N (5, 10, 15). Ex. 8:37 → 8:35. |
| arrhentree | Seuil majoration entrée | Entier (min) | Au-dessus de N min de reste, arrondir vers le haut. |
| arrhsortie | Seuil majoration sortie | Entier (min) | Idem pour sorties (règles asymétriques possibles). |
| arrhemajore | Bonus entrée | Entier (min) | +N min après arrondi entrée. |
| arrhsmajore | Bonus sortie | Entier (min) | +N min après arrondi sortie. |
| arrhsup | Arrondi heures sup | Entier (min) | Arrondi spécifique au cumul HS. |

### 4.3 Onglet DATES & PÉRIODES (mois de paie)

| Champ | Libellé UI | Format | Rôle métier |
|---|---|---|---|
| joudeb / moisdeb | Premier jour de la période | JJ-MM | « 01-01 » = 1ᵉʳ janvier, « 26-C » = 26 du mois courant. |
| joufin / moisfin | Dernier jour | JJ-MM | « 31-M » = dernier jour du mois (28/29/30/31). |

**Codes spéciaux** : « C » = mois courant, « M » = dernier jour du mois.

### 4.4 Onglet CONGÉS & REPOS

| Champ | Libellé UI | Type | Rôle métier |
|---|---|---|---|
| nbhconge | Heures congé annuel | Décimal | Plafond annuel des congés (ex. 20 j × 7,5 h = 150 h). |
| nbhrepos | Heures demi-journée repos | Entier | Durée d'une demi-journée repos (4 h typique). |
| nbhferier | Heures jour férié | Entier | Durée d'un jour férié payé (8 h). |
| fertrv | Règle travail jour férié | 0/1/2 | 0 = compté normal, 1 = majoré simple, 2 = majoré double. |
| jourrepos | Jours repos fixes | « 1234567 » | ISO : 1 = lundi … 7 = dimanche. « 67 » = week-end. |
| repasnuit | Pas de repos nuit si sortie jour | O/N | Empêche le double comptage. |
| moinsrepas | Diminuer panier nuit (min) | Entier | Réduit l'indemnité repas nocturne de N min. |
| parcetdatelim | Limite CET (JJ-MM) | 5 car. | Date limite de basculement des congés non pris vers le compte épargne temps. Défaut « 31-05 ». |
| parcetmaxjours | Plafond CET annuel | Décimal | Nombre max de jours pouvant passer en CET (défaut 10 j). |

### 4.5 Onglet HEURES SUPPLÉMENTAIRES (tranches)

4 tranches **hebdomadaires** (H) + 4 tranches **mensuelles** (M), chacune avec **seuil** (h) et **taux** (%) :

| Champ | Libellé UI | Rôle métier |
|---|---|---|
| nbhtr1…4 / tauxtr1…4 | Tranches hebdo | Ex. nbhtr1 = 35, tauxtr1 = 25 → +25 % au-delà de 35 h/sem. |
| nbhtr1M…4M / tauxtr1M…4M | Tranches mensuelles | Cumul mensuel. |
| nbhmax1/2 / tauxmax1/2 | Plafonds HS mensuels | Au-delà : pas de paie supplémentaire. |
| nbhmax1m/2m / tauxmax1m/2m | Plafonds HS journaliers | Limite quotidienne (ex. 4 h HS/j max). |

### 4.6 Onglet HEURES DE NUIT

| Champ | Libellé UI | Format | Rôle métier |
|---|---|---|---|
| parnuit | Gérer heures de nuit | O/N | Active le module nuit. |
| nuitdeb / nuitfin | Plage nuit standard | HH:MM | Fenêtre « nuit » (ex. 22:00 → 06:00). |
| nuitsdeb / nuitsfin | Plage nuit spéciale | HH:MM | 2ᵉ fenêtre optionnelle (équipes 2×8). |
| parhnuitspec | Intitulé nuit spéciale | 20 car. | Nom métier de cette 2ᵉ fenêtre. |

### 4.7 Onglet MAJORATIONS PAR CATÉGORIE

| Champ | Libellé UI | Type | Rôle métier |
|---|---|---|---|
| parcadre / parmaitrise / parexec | Activer pour Cadre / Maîtrise / Exécutant | O/N | Active les règles spécifiques de majoration. |
| parjhnlibre | Heures nuit libres (cadre) | Décimal | Heures nuit non rémunérées (forfait cadre). |
| parjhslibre | Heures nuit fixes (cadre) | Décimal | Heures nuit incluses au forfait. |
| parjhnfixe / parjhsfixe | Heures jour / sup fixes (cadre) | Décimal | Heures intégrées au forfait cadre, non rémunérées en plus. |

### 4.8 Onglet ABSENCES & SAISIES

| Champ | Libellé UI | Type | Rôle métier |
|---|---|---|---|
| parreptrv | Gérer repos travaillés | O/N | « O » : absence le jour de repos → droit à un jour compensateur. |
| parmanuel | Saisie manuelle d'absence | O/N | Permet ajout a posteriori (hors pointage). |
| parpaquet | Paquet min absence | Décimal (j) | Durée min déclenchant un droit (ex. 0,5 j). |
| parreperiod | Blackout congés | O/N | Restreint les congés à certaines périodes. |
| parscomplet | Semaine complète obligatoire | O/N | Un congé doit couvrir lun→ven complet. |
| dtepres | Date présence obligatoire | O/N | Chaque jour travaillé exige au moins un pointage. |

### 4.9 Onglet POINTEUSE (matériel)

| Champ | Libellé UI | Rôle métier |
|---|---|---|
| vitesse / parite / xonoff / ncom | Communication série | Hérité — bauds, parité, port COM. |
| nbdigit | Chiffres matricule pointeuse | Longueur du matricule lu par la badgeuse. |
| separe | Séparation par site | « O » : numérotation pointeuse différente par site. |
| billet | Imprimer billet | « O » : la pointeuse imprime un justificatif à chaque badge. |
| point | Mode pointage | « O » : badgeuse, « N » : mobile. |

### 4.10 Onglet GÉNÉRATION DES MATRICULES

| Champ | Libellé UI | Valeurs | Rôle métier |
|---|---|---|---|
| parmodemp | Mode génération matricule | S / N / X / vide | **S** : préfixe 2 lettres de la société + n° séquentiel (« AB000001 »). **N** : préfixe nom employé. **X / vide** : 100 % séquentiel (« 000001 »). |

### 4.11 Onglet AFFICHAGE & PRÉSENTATION

| Champ | Libellé UI | Rôle métier |
|---|---|---|
| pardecimal | Séparateur décimal | O = virgule (français), N = point (anglais). |
| parpresence | Modèle état présence | Choix du format de rapport périodique. |
| parsaisconge | % saisie congé par salarié | Pourcentage min des congés saisissables en self-service. |
| parnrepas | Gestion indemnités repas | Active calcul paniers. |
| parancemmp | Ancienneté → majoration | Majorations en fonction de l'ancienneté. |
| paraelimftrv | Éliminer fériés du calcul HS | « O » : un férié travaillé n'est pas compté HS. |
| parmaxfer | Max jours fériés payés | Plafond mensuel/annuel. |
| parminhjour / parmaxhjour | Min / Max heures par jour | Validation des journées. |

### 4.12 Paramètres RGPD — Rétention des données

- **Page** : `/dashboard/retention-rgpd`
- **Rôle requis** : Administrateur

| Paramètre | Défaut | Plage | Rôle métier |
|---|---|---|---|
| audit_log_days | 180 j | 30–730 | Durée de conservation des journaux d'audit. |
| presence_anonymize_days | 365 j | 90–3650 | Anonymisation des notes libres sur pointages. |
| presence_delete_days | 1825 j (5 ans) | 365–3650 | Suppression physique des pointages (limite légale FR : 5 ans). |
| refresh_token_days_after_expiry | 30 j | 7–90 | Rétention des tokens de session expirés (forensique). |
| known_device_inactive_days | 365 j | 90–730 | Oubli des appareils inactifs. |
| push_token_inactive_days | 90 j | 30–180 | Purge des tokens push mobile inactifs. |
| rag_chat_log_days | 90 j | 30–365 | Conservation des chats IA. |

### 4.13 Paramètres RGPD — Géolocalisation

- **Page** : `/dashboard/geolocation-rgpd`
- **Rôle requis** : Administrateur

| Paramètre | Défaut | Rôle métier |
|---|---|---|
| enabled_for_clock_in | true | Capture GPS lors des pointages standards. |
| enabled_for_missions | true | Capture GPS lors des missions terrain. |
| window_start_time | 06:00 | Début de la plage horaire où le GPS est actif. |
| window_end_time | 22:00 | Fin de la plage. |
| allowed_days | « 1234567 » | Jours autorisés (ISO : 1 = lundi). |

> **Note RGPD** : hors plage/jour, le pointage est accepté **sans** coordonnées. Cela évite de tracker le trajet domicile → travail.

### 4.14 Paramètres RGPD — Notice d'information

- **Page** : `/dashboard/notice-rgpd`
- **Rôle requis** : Administrateur

| Champ | Rôle métier |
|---|---|
| title | Titre de la bannière (« Avis traitement de vos données »). |
| body | Corps de la notice Article 13 RGPD (Markdown léger). |
| version | Auto-incrémenté à chaque modification. |
| user_consent (table) | Horodatage + IP de chaque salarié ayant validé la version N. |

À chaque nouvelle version, **tous les salariés doivent re-valider** au prochain login.

### 4.15 Paramètres NOTIFICATIONS

Configurables **par utilisateur** dans `/dashboard/profile`. 2 canaux par catégorie :
- **push_enabled** : notification système (toast mobile/web)
- **inapp_enabled** : centre de notifications dans l'app

| Catégorie | Description |
|---|---|
| reminder_in / reminder_out | Rappel 15 min avant heure théo d'arrivée / départ. |
| leave_request_accepted / refused / pending | Cycle de validation des congés. |
| absence_request_* | Cycle des demandes d'absence. |
| mission_assigned / completed | Affectation et validation des missions. |

**Créneau silencieux** (`quiet_*`) : désactive les pushs en dehors des heures de travail (droit à la déconnexion).

---

## 5. Module Pointage

### 5.1 Cible
Admin et Manager principalement ; salarié en consultation.

### 5.2 Fonctionnalités

#### Lecture des pointeuses (`/dashboard/liste-pointeuse`)
- **Qui** : Admin, Manager (consultation + correction)
- **Quoi** : liste des badges collectés par les terminaux. Vue chronologique des entrées/sorties. Possibilité de saisir manuellement un pointage manqué (panne badgeuse, mobile non connecté).

#### État périodique (`/dashboard/etat-periodique`)
- **Qui** : Admin, Manager
- **Quoi** : synthèse hebdomadaire/mensuelle des présences par employé. Affiche heures théoriques, heures réelles, écart, HS, absences. Base de la validation paie.

#### Suivi des positions GPS (`/dashboard/suivi-positions`)
- **Qui** : Admin (pack Standard+)
- **Quoi** : carte Leaflet affichant les coordonnées des pointages mobiles. Markers rouges si hors géofence du site, verts sinon. Sert à l'audit anti-fraude.

### 5.3 Parcours type

> Salarié pointe à 8h via badgeuse → enregistré en base → Manager vérifie l'état périodique le 28 du mois et constate qu'il manque 4h le lundi (panne) → ouvre la liste pointeuse, saisit manuellement 08:00→12:00 et 13:00→17:00 → l'état périodique se met à jour.

---

## 6. Module Gestion des employés

### 6.1 Cible
Admin et Manager (CRUD selon droits). Salarié en consultation de sa propre fiche.

### 6.2 Fonctionnalités

#### Liste des employés (`/dashboard/gestion-employe`)
Annuaire avec filtres (service, site, statut actif/inactif, manager), recherche full-text, pagination.

#### Création / modification d'une fiche
**Onglets de la fiche** :
- **Identité** : matricule, nom, prénom, sexe, date/lieu de naissance, CIN/CNI/passeport (champs chiffrés en base)
- **Coordonnées** : email pro, téléphone, adresse, ville, code postal
- **Affectation** : société, site, direction, service, section, fonction, qualification, classe horaire, manager
- **Contrat** : type, date d'embauche, date de sortie éventuelle
- **Soldes** : congé annuel, RTT, CET
- **Documents** : pièces jointes (CIN, diplômes, contrat signé)

#### Import Excel en masse
- **Pack Standard+** uniquement
- Bouton « Importer depuis Excel » → fichier `.xlsx` (10–500 lignes) → mapping colonnes → rapport (insérés / erreurs)
- Rate limit : 10 imports/h

#### Scan OCR de pièces d'identité (pack Premium)
- Modal « Scanner un document » dans la fiche employé
- Upload image/PDF → IA Vision (Gemini) → extraction nom/prénom/CIN/date naissance
- Pré-remplissage automatique de la fiche

#### Profil salarié (`/dashboard/profile`)
- Self-service : modification de ses propres coordonnées (téléphone, photo), changement de mot de passe
- Consultation : fiche, contrat, soldes, documents personnels

### 6.3 Parcours type
> RH reçoit 10 nouveaux salariés. Il prépare un Excel avec colonnes Nom, Prénom, Fonction, Service, Salaire → « Importer Excel » → matricules auto-générés EMP001 à EMP010, services créés automatiquement → rapport « 10 insérés, 0 erreur ».

---

## 7. Module Gestion des contrats

### 7.1 Cible
Admin et Manager (pack Standard+).

### 7.2 Fonctionnalités

#### Liste des contrats (`/dashboard/contrat`)
- CRUD complet : type (CDI / CDD / Stage / Alternance), dates d'effet, période d'essai, salaire brut, taux horaire, conventions collectives
- Statut : actif, en attente de signature, archivé, expiré

#### Échéances (`/dashboard/echeance-contrat`)
- Vue synthétique des CDD/stages/périodes d'essai expirant dans les 60 prochains jours
- Export PDF

#### Modèles de contrats (`/dashboard/template-builder`) — Admin uniquement
- Éditeur WYSIWYG (TinyMCE)
- Placeholders : `{{empcod}}`, `{{emplib}}`, `{{salaire}}`, `{{datedebut}}`, `{{Signature_Employe}}`, `{{Signature_Employeur}}`…
- Génération produit un PDF ou DOCX rempli, téléchargeable et archivable au coffre

### 7.3 Parcours type
> Un CDD expire le 15 juillet → Admin voit l'alerte sur `/dashboard/echeance-contrat` → bouton « Renouveler » → extension 12 mois → génère DOCX via template « CDD Opérateur » → signature → archivage coffre.

---

## 8. Module Congés et validations

### 8.1 Cible
Salarié (demande), Manager (validation), Admin (configuration + override).

### 8.2 Fonctionnalités

#### Demande de congé (`/dashboard/gestion-de-conge`)
- **Salarié** : sélectionne type (Congé Payé, Sans Solde, Exceptionnel…), dates début/fin, motif. Le système calcule automatiquement le nombre de jours en excluant week-ends et fériés.
- **État** : Pending → Approved / Rejected

#### Solde de congé (`/dashboard/gestion-de-solde`)
- Consultation : solde initial, jours pris (year-to-date), jours restants
- Décliné par type de congé (CP, RTT, exceptionnel)

#### Affectation de solde (`/dashboard/affectation-solde`) — Admin uniquement
- Ajustements manuels : régularisation, correction d'erreur, octroi exceptionnel

#### Titres de congé (`/dashboard/titre-de-conge`) — Admin
- Configuration de la nomenclature : libellé, décompte du solde oui/non, rémunéré oui/non, code CNAMTS

#### Congés généraux (`/dashboard/titre-de-conge-general`) — Admin (pack Premium)
- Périodes de fermeture collective (ex. 15–31 août usine fermée) → génère absence pour tous les salariés concernés

#### Compte Épargne Temps — CET (`/dashboard/cet`) — Admin
- Gestion des reports de congés non pris en compte d'épargne
- Conversion en salaire sur demande
- Plafonds annuels paramétrables

### 8.3 Parcours type — cycle complet

1. **Salarié** Paul ouvre `/dashboard/gestion-de-conge`, saisit « Congé Payé du 15 au 20 juillet » (5 jours). Soumet.
2. **Manager** Sophie reçoit notification → ouvre `/dashboard/gestion-de-conge` → consulte le solde de Paul (15 j restants) → **Approuver**.
3. Paul reçoit confirmation. Son solde passe à 10 j.
4. À la fin du mois, le **Cahier de congés** (PDF) intègre la consommation pour audit légal.

---

## 9. Module Absences, autorisations, heures sup

### 9.1 Cible
Salarié (demande), Manager (validation), Admin (configuration + override).

### 9.2 Demandes d'absence avec justificatif (`/dashboard/demande-absence`)
- **Salarié** : saisit motif (Maladie, Convocation, Urgence familiale…), dates, upload justificatif (PDF/image)
- **Manager** valide via `/dashboard/validation-absence`
- Sur approbation : absence créée automatiquement en pointage

### 9.3 Demandes de télétravail (`/dashboard/demande-teletravail`)
- Salarié saisit plage et motif
- Manager valide via `/dashboard/validation-teletravail`

### 9.4 Demandes d'autorisation (sortie anticipée)
- `/dashboard/demande-autorisation` — salarié saisit créneau (ex. quitter à 15h au lieu de 17h)
- Manager valide

### 9.5 Validation heures supplémentaires (`/dashboard/validation-heures-sup`)
- Liste des HS détectées automatiquement (au-delà des seuils paramétrés)
- Manager qualifie : à compenser (récup) ou à payer

### 9.6 Autorisations générales (`/dashboard/autorisation-de-sortie-generale`) — pack Premium
- Sortie collective hebdo (ex. vendredi 16h)
- Affecte tous les salariés / services sélectionnés

### 9.7 Jour de compensation (`/dashboard/jour-de-compensation`)
- Récupération d'un jour pour HS effectuées
- Génère absence « Récupération » payée

### 9.8 Absence et sanction (`/dashboard/absence-et-sanction`) — Admin
- Absence non justifiée avec retenue paie
- Sanction disciplinaire avec motif

---

## 10. Modules Notes de frais, Missions, Allaitement, Télétravail

### 10.1 Notes de frais (`/dashboard/remboursement`) — pack Standard+
- **Salarié** : saisit dépense (hôtel, transport, repas), montant + devise + justificatif
- **Manager** valide → intégration en paie (rubrique « Remboursement »)

### 10.2 Missions (`/dashboard/missions`) — pack Standard+
- **Admin** : enregistre mission (chantier, formation, RDV client) — site, dates, description
- Auto-création d'une absence « Mission » sur la période
- Salarié voit ses missions dans `/dashboard/missions`

### 10.3 Allaitement (`/dashboard/allaitement`) — pack Standard+
- **Admin** : configure aménagement (1 h/jour pendant 12 mois post-naissance)
- Données médicales sensibles → chiffrées
- Heure aménagée comptée comme travail, non décomptée du solde

### 10.4 Télétravail (déjà couvert §9.3)

---

## 11. Module Préparation paie

### 11.1 Cible
Admin et Manager (pack Standard+).

> **Important** : Concorde Workforce **ne calcule pas** la paie (pas de cotisations, pas d'IRPP). Il **prépare** les éléments pour les exporter vers le logiciel paie (Sage, Navision, Cegid).

### 11.2 Pointage du mois (`/dashboard/pointage-du-mois`)
- Vue mensuelle complète : tableau hebdomadaire jour par jour
- Heures théoriques vs réelles, absences détaillées, HS, compensations
- Export Excel / PDF pour transmission au prestataire paie

### 11.3 Droit de congé (`/dashboard/droit-de-conge`)
- Synthèse mensuelle des soldes : début, pris, généré, fin
- Validation avant clôture paie

### 11.4 Cas d'usage : clôture mensuelle
1. Le 25 du mois, Admin RH ouvre `/dashboard/pointage-du-mois`, sélectionne septembre
2. Vérifie chaque employé : heures théo vs réelles
3. Détecte les anomalies (absences non saisies, HS non validées)
4. Force la saisie ou l'approbation manquante
5. Une fois propre, exporte Excel
6. Transmet au prestataire paie

---

## 12. Module Rapports et États

### 12.1 Cible
Admin et Manager (pack Standard+).

### 12.2 Rapports disponibles

| Rapport | Route | Description |
|---|---|---|
| Calendrier équipe | `/dashboard/calendrier-equipe` | Vue mensuelle des congés / missions / TT / absences avec codes couleur. |
| État de présence | `/dashboard/etat-de-presence` | Synthèse mensuelle : présences, absences, HS, taux assiduité. PDF. |
| État de retard | `/dashboard/etat-de-retard` | Cumul retards par salarié, détection problèmes chroniques. |
| État des absences | `/dashboard/etat-des-absences` | Détail toutes absences (type, motif, justificatif) sur période. |
| Cahier de congé | `/dashboard/cahier-conge` | Vue légale annuelle, exportable PDF pour inspection travail. |
| Échéance contrat | `/dashboard/echeance-contrat` | Contrats expirants <60j. |

### 12.3 Dashboard d'accueil (`/dashboard`)
- KPI principaux : effectifs, taux assiduité, congés en attente, HS, remboursements à valider, échéances contrats
- Widgets cliquables → accès rapide aux listes

---

## 13. Module Administration

### 13.1 Cible
Admin uniquement.

### 13.2 Gestion des utilisateurs (`/dashboard/gestion-utilisateur`)
- CRUD : email, nom, rôle (Admin / Manager / RH / Salarié), statut actif/inactif
- Invitation par email avec OTP de première connexion
- Suspension temporaire ou définitive

### 13.3 Droits d'accès (`/dashboard/droit-accees`)
- Matrice **rôle × module × action** (CAMD)
- Création de rôles personnalisés (au-delà des 4 rôles système)

### 13.4 Droits d'accès par site (`/dashboard/droit-acces-site`)
- Affectation **utilisateur → site(s)** : un manager peut être limité à 1 ou plusieurs sites
- Isolation des données intra-tenant

### 13.5 Modèles de contrats / courriers
- `/dashboard/template-builder` — modèles de contrats avec placeholders
- `/dashboard/courriers` (pack Premium) — modèles de lettres assistées IA (certificat, attestation, convocation disciplinaire…)

### 13.6 Historique IA (`/dashboard/rag-audit`) — pack Premium
- Log des appels au chat IA : question, réponse, utilisateur, feedback
- Audit qualité + conformité

### 13.7 Journaux d'audit (`/dashboard/audit-logs`) — pack Business
- Trace exhaustive : création employé, modification salaire, suppression document, accès données sensibles
- Champs : utilisateur, action, table, ancienne/nouvelle valeur, IP, timestamp
- Recherche paginée, filtres, export CSV

### 13.8 RGPD
- **Rétention** (`/dashboard/retention-rgpd`) — durées de conservation
- **Notice d'information** (`/dashboard/notice-rgpd`) — texte Article 13
- **Géolocalisation** (`/dashboard/geolocation-rgpd`) — plages + jours autorisés
- **Droit à l'oubli** : suppression complète des données personnelles d'un salarié sorti

### 13.9 Paramètres société
- **Paramètres généraux** (`/dashboard/societe`) — voir §4
- **Calendrier société** (`/dashboard/calendrier-societe`) — jours fériés + fermetures

---

## 14. Module Coffre numérique et Documents

### 14.1 Cible
Salarié (ses documents), Admin (vue globale).

### 14.2 Fonctionnalités

#### Coffre individuel (`/dashboard/coffre-fort`) — pack Standard+
- Salarié uploade et consulte SES documents (CIN, diplômes, attestations, bulletins paie)
- Chiffrement au repos (AES-256)
- Quota par pack : ~5 GB Standard, 50 GB Premium

#### Vue admin (`/dashboard/admin-vault`) — Admin
- Supervision de tous les coffres employés
- Recherche, filtres par catégorie/employé
- Partage de documents par lien temporaire (48 h, 7 j…)

#### Signature électronique (`/dashboard/sign-document`) — pack Standard+
- Workflow : Admin envoie document → salarié reçoit lien → signature pad → archivage signé
- Valeur légale eIDAS

### 14.3 Documents juridiques (`/dashboard/documents`)
- Dépôt centralisé : CGV, notices RGPD, règlement intérieur, conventions collectives

---

## 15. Module Intelligence Artificielle

### 15.1 Cible
Tous (chat) et Admin/Manager (templates) — pack Premium / Business.

### 15.2 Chat RAG (bouton flottant 💬)
- Assistant conversationnel entraîné sur les documents internes (manuel, politiques RH, FAQ)
- Question en langage naturel → réponse contextualisée + sources
- Rate limit : 10 questions/h/user
- Feedback 👍 / 👎 sur chaque réponse
- Audit complet dans `/dashboard/rag-audit`

### 15.3 Courriers assistés (`/dashboard/courriers`)
- Bibliothèque de modèles avec génération IA
- Exemples : certificat de travail, attestation salaire, convocation disciplinaire
- Génération DOCX pré-rempli, optionnellement poli par LLM

### 15.4 Scan OCR
- Modal dans la fiche employé
- CIN / passeport / contrat → extraction structurée → pré-remplissage

---

## 16. Application mobile (vue salarié)

### 16.1 Téléchargement
- Page publique `/download` → liens App Store / Play Store / APK direct
- QR code

### 16.2 Fonctionnalités principales

| Fonctionnalité | Description |
|---|---|
| Pointage rapide | Bouton unique vert/rouge sur écran d'accueil. Heure + GPS capturés. |
| Soldes & demandes | Cards solde congé, demandes en cours, historique |
| Dépôt demandes | Formulaires allégés : congé, absence, télétravail, autorisation, notes de frais |
| Profil & documents | Lecture fiche, téléchargement contrat / bulletins paie |
| Notifications push | Validation/refus demandes, rappels (solde faible, pointage oublié) |
| Authentification biométrique | Empreinte / Face ID après login initial |

### 16.3 Sécurité mobile (pack Premium)
- Device trust : token lié à l'appareil enregistré
- Anti-screenshot
- Certificate pinning
- Logout auto après 15 min d'inactivité

---

## 17. Abonnement et facturation

### 17.1 Page `/dashboard/mon-abonnement`
- Admin/Manager
- Consultation du pack actuel + cycle (mensuel/annuel)
- Bandeau d'essai gratuit avec compte à rebours (30 j)
- Changement de pack : preview prorata-temporis Stripe → confirmation
- Résiliation : immédiate ou en fin de période (rétention 90 j pour réactivation)
- Réactivation après résiliation
- Carte de paiement (gestion via Stripe Billing Portal)

### 17.2 Factures (`/dashboard/factures-concorde`)
- Historique : factures émises (téléchargement PDF) + facture à venir
- Détail HT / TVA / TTC

### 17.3 Quota stockage
- Jauge visible sur la page d'abonnement
- Limite atteinte → upload bloqué, propose upgrade

---

## 18. Scénarios de formation type

### 18.1 Scénario 1 : Onboarding d'un nouveau client (1ʳᵉ session, 2h)

1. **Création du tenant** : démontrer `/signup` → choix pack → vérification email OTP
2. **Paramétrage initial** (ordre §3.1) :
   - Compléter Société (logo, SMIG, adresse)
   - Créer Sites (Siège + filiales)
   - Construire la structure (Direction → Service → Section)
   - Créer Fonctions et Qualifications
   - Définir Catégories
   - **Démontrer la création d'1 Poste de travail** (8h-16h30 standard)
   - **Démontrer la création d'1 Classe horaire** liée à ce poste
   - Importer ou créer Intitulés d'absences
   - Saisir le calendrier des jours fériés de l'année
3. **Présenter le guide d'onboarding** (le widget « Bienvenue, configurez votre espace en 5 étapes » qui apparaît au premier login)

### 18.2 Scénario 2 : Créer un employé et son premier pointage (30 min)

1. Ouvrir `/dashboard/gestion-employe` → bouton « Ajouter »
2. Remplir identité (matricule auto-généré), affectation (site, service, fonction, classe horaire)
3. Créer son contrat dans `/dashboard/contrat`
4. Démonstration mobile : télécharger l'app, se connecter, pointer
5. Vérifier dans `/dashboard/etat-periodique` que le pointage remonte

### 18.3 Scénario 3 : Cycle de congé complet (45 min)

1. **Salarié** (faire incarner par le formateur) : ouvrir `/dashboard/gestion-de-conge`, saisir demande
2. **Manager** (autre compte) : reçoit notif, valide
3. **Salarié** : voit son solde diminué
4. **Admin** : consulte le cahier de congés (PDF) pour audit

### 18.4 Scénario 4 : Préparation paie mensuelle (45 min)

1. Le 25 du mois : ouvrir `/dashboard/pointage-du-mois`
2. Parcourir les employés, détecter les anomalies (absences non saisies)
3. Vérifier `/dashboard/validation-heures-sup` et `/dashboard/validation-absence` pour vider les files
4. Vérifier les soldes dans `/dashboard/droit-de-conge`
5. Exporter Excel du pointage du mois
6. Transmettre au cabinet paie

### 18.5 Scénario 5 : Conformité RGPD (30 min)

1. Présenter la **notice RGPD** (`/dashboard/notice-rgpd`)
2. Démontrer la configuration de la **rétention** (`/dashboard/retention-rgpd`)
3. Démontrer la configuration de la **géolocalisation** (`/dashboard/geolocation-rgpd`) — restreindre aux jours ouvrés 6h-22h
4. Présenter les **journaux d'audit** (`/dashboard/audit-logs`) — recherche d'une action utilisateur
5. Expliquer le **droit à l'oubli**

### 18.6 Scénario 6 : Démo IA (15 min — pack Business)

1. Ouvrir le **chat RAG** (bouton flottant) — poser une question RH
2. Démontrer un **modèle de courrier** (`/dashboard/courriers`) — générer un certificat de travail
3. Démontrer le **scan OCR** d'une CIN dans la création d'employé

---

## 19. Annexes

### 19.1 Glossaire

| Terme | Définition |
|---|---|
| Tenant | Un client = une entreprise utilisant Concorde. Données isolées en base. |
| Slug | Sous-domaine du tenant (« acme » → acme.concorde-work-force.com). |
| Matricule | Identifiant interne de l'employé (auto-généré ou saisi). |
| Classe horaire | Cycle annuel d'horaires affecté à un employé. |
| Poste | Modèle d'horaires d'une journée type. |
| Soccod / Sitcod / Sercod | Codes courts (société / site / service). |
| Rubrique | Élément de paie (gain, retenue, cotisation). |
| HS | Heure supplémentaire. |
| CET | Compte Épargne Temps. |
| OTP | One-Time Password (code 6 chiffres envoyé par email). |
| 2FA | Authentification à deux facteurs. |
| RAG | Retrieval Augmented Generation — IA contextualisée. |
| Géofence | Zone GPS autorisée autour d'un site. |
| CAMD | Consulter, Ajouter, Modifier, Supprimer. |

### 19.2 Matrice plan / features (référence rapide)

| Fonctionnalité | Starter | Standard | Business |
|---|---|---|---|
| Effectif inclus | 10 | 25 | 50 |
| Stockage | 10 GB | 50 GB | 200 GB |
| Multi-sites | — | 5 max | illimité |
| Multi-sociétés | — | — | ✓ |
| Géolocalisation | — | ✓ | ✓ |
| Coffre + signature électronique | — | ✓ | ✓ |
| Contrats + modèles | — | ✓ | ✓ |
| Notes de frais | — | ✓ | ✓ |
| Missions | — | ✓ | ✓ |
| Allaitement | — | ✓ | ✓ |
| Télétravail | — | ✓ | ✓ |
| Import Excel | — | ✓ | ✓ |
| Préparation paie + rapports avancés | — | ✓ | ✓ |
| Scan OCR | — | — | ✓ |
| IA (chat RAG, courriers) | — | — | ✓ |
| Audit logs avancés | — | — | ✓ |
| Branding custom | — | — | ✓ |
| Sécurité renforcée (device trust, anti-screenshot) | — | — | ✓ |

### 19.3 Modules optionnels (cumulables avec n'importe quel pack)

| Module | Tarif | Description |
|---|---|---|
| Assistant RH IA | 49 €/mois | Aide rédaction, recherche multi-sources |
| IA documentaire avancée | 149 €/mois | RAG sur archives RH, embeddings vectoriels |
| Signature électronique avancée | 19 €/mois | Signature qualifiée eIDAS, parapheur |
| API avancée | 79 €/mois | Intégration SIRH / paie / ERP |
| Support prioritaire étendu | 49 €/mois | Réponse sous 2h, hotline dédiée |
| Stockage +100 Go | 29 €/100 Go/mois | Tranches additionnelles |
| Accompagnement onboarding | 89 €/h HT | Sessions expert, paramétrage |
| Formation RH & équipes | Sur devis | Sur mesure |

### 19.4 Pays et identifiants entreprise supportés (au signup)

| Pays | Identifiant | Format | Validation |
|---|---|---|---|
| 🇫🇷 France | SIRET | 14 chiffres | API Sirene + Luhn |
| 🇧🇪 Belgique | BCE | 10 chiffres | API cbeapi.be + checksum mod 97 |
| 🇲🇦 Maroc | ICE | 15 chiffres | Format uniquement |
| 🇸🇳 Sénégal | NINEA | 9 chiffres | Format uniquement |
| 🇹🇳 Tunisie | Matricule Fiscal | 7 chiffres + 1 lettre clé (+ 1-3 lettres + 0-3 chiffres optionnels) | Format uniquement |

### 19.5 Codes des actions (raccourcis matrice permissions)

| Code | Action |
|---|---|
| C | Consulter (lecture) |
| A | Ajouter (création) |
| M | Modifier (édition) |
| D | Supprimer (suppression) |

### 19.6 Routes publiques (avant authentification)

| Route | Description |
|---|---|
| `/` | Landing marketing |
| `/about` | Présentation |
| `/login` | Connexion |
| `/signup` | Inscription |
| `/verify-email` | Vérification OTP |
| `/plan-configuration` | Configurateur tarifaire |
| `/contact-sales` | Contact commercial |
| `/download` | Page de téléchargement mobile |
| `/confidentialite` | Politique de confidentialité |
| `/cgu` | Conditions générales |

### 19.7 Endpoints critiques (utilité formateur)

- `/dashboard` — page d'accueil avec onboarding 5 étapes pour nouveaux tenants
- `/dashboard/mon-abonnement` — état du pack, jours d'essai restants
- `/dashboard/profile` — pour démontrer le compte courant
- `/dashboard/support` — FAQ, formations, coaching, contact support

### 19.8 Points de vigilance pour le formateur

1. **Toujours montrer le menu adapté au rôle démontré.** Se connecter avec un compte salarié pour la partie self-service, pas seulement avec l'admin.
2. **Le pack du tenant détermine ce qui est visible.** Vérifier avant la démo.
3. **Les pointages historiques ne se modifient pas à la légère.** Toute modification est tracée dans les audit logs.
4. **L'OTP de vérification email est obligatoire** au premier login. Prévoir l'accès à la boîte mail.
5. **RGPD = obligation contractuelle.** Insister sur la responsabilité du client (responsable de traitement) dans le choix des durées de rétention.
6. **La géolocalisation par défaut est active 6h-22h, lun-dim.** À adapter selon les usages du client (BTP, gardien d'immeuble, télétravail…).
7. **Concorde n'est PAS un logiciel de paie.** Il prépare et exporte ; le calcul (cotisations, IRPP, bulletins) reste chez le prestataire externe.

---

## Fin du rapport

> **Document généré pour formation client Concorde Workforce — Mai 2026.**
> Pour toute mise à jour : contacter l'équipe produit.
