# Setup compte démo Apple App Review

Apple Guideline 2.1 (App Completeness) impose qu'un reviewer puisse **se connecter
et exercer le parcours principal** de l'app. Sans compte de démonstration fonctionnel,
le rejet est automatique avec le motif "Guideline 2.1 - We were unable to sign in
to the app because the credentials were not valid".

Ce document détaille la création d'un compte démo robuste et **conforme aux
attentes des reviewers Apple et Google**.

---

## 1. Création du tenant

### 1.1 Provisionner un vrai tenant dédié

Ne pas hacker un flag "isDemo" sur un tenant existant — créer un vrai tenant via
le flow de signup standard, avec ces caractéristiques :

| Champ | Valeur |
|---|---|
| Nom société (`soccod`) | `apple-reviewer` |
| Raison sociale | `Apple Review Demo Tenant` |
| SIRET | Numéro factice non actif (ex. `00000000000001`) ou réel d'une entité dormante |
| Plan | Standard mensuel (avec trial activé pour ne pas être facturé) |
| Adresse | Adresse du siège de Concorde Tech |
| Email administrateur | `reviewer@concorde-work-force.com` (créer en amont chez OVH) |

L'objectif est qu'à la connexion, le reviewer voie un environnement complet et
réaliste, **pas un tenant vide** qui suggère une app inachevée.

### 1.2 Pourquoi pas un tenant existant ?

- Si reviewer modifie/supprime des données, ça impacterait un vrai client
- Apple peut tester avec des credentials générés (ex. créer un nouveau compte
  depuis le bouton signup) — un tenant dédié permet ce reset
- Les conditions tarifaires / branding peuvent diverger d'un client réel

### 1.3 Renouvellement annuel

Mettre un rappel calendar pour vérifier le tenant tous les **6 mois** :
- Trial réactivé / abonnement payé en interne
- Mot de passe non expiré
- Comptes manager/employé toujours opérationnels
- Dataset non corrompu par tests automatisés intermédiaires

---

## 2. Comptes utilisateurs à provisionner

Le reviewer Apple/Google teste plusieurs personas. Créer **3 comptes** dans le
tenant `apple-reviewer` :

### 2.1 Administrateur (compte principal pour la review)

```
Email:       reviewer@concorde-work-force.com
Password:    [généré, fort, 20+ caractères — coller dans App Store Connect uniquement]
Rôle:        Administrateur tenant (utiadm = 1)
Sites:       Tous
Permissions: Toutes
```

Ce compte permet au reviewer d'accéder à 100 % de l'application — y compris les
écrans admin (gestion utilisateurs, paramètres société, gestion-de-conge admin, etc.).

### 2.2 Manager

```
Email:       manager.reviewer@concorde-work-force.com
Password:    [généré]
Rôle:        Manager (utiadm = 0 + role manager attribué)
Équipe:      3 collaborateurs sous sa responsabilité
```

Permet de tester les flux **manager** (validation congés, validation frais,
dashboard manager). Important parce que c'est une cible business clé pour les
descriptions store.

### 2.3 Employé

```
Email:       employee.reviewer@concorde-work-force.com
Password:    [généré]
Rôle:        Employé standard
Manager:     manager.reviewer@concorde-work-force.com
```

Permet de tester le parcours **collaborateur** (pointage, demande de congé,
demande de frais, signature de documents).

---

## 3. Données de démonstration à pré-remplir

Un compte fonctionnel **avec données réalistes** convertit mieux qu'un compte vide.
Le reviewer teste plus rapidement et les screenshots ultérieurs peuvent être pris
sur ce tenant. Pré-remplir :

### 3.1 Pointage

- **2 derniers mois** de pointages quotidiens pour les 3 comptes (entrée
  ≈ 09:00, sortie ≈ 18:00 avec variations naturelles)
- **5-10 heures supplémentaires** ponctuelles sur le mois courant pour
  visualiser la couleur "overtime" du calendrier mobile

Script SQL ou seeder à créer si pas déjà fait — ne pas faire à la main.

### 3.2 Congés

- **2 congés approuvés** dans le passé (1 semaine en hiver, 1 semaine en été)
- **1 congé en cours** sur le mois courant
- **1 demande en attente** à valider par le manager → permet au reviewer de
  tester le flux validation

### 3.3 Notes de frais

- **5 frais validés** des mois précédents (mix repas, déplacement, hébergement)
- **2 frais en attente** sur le mois courant
- Joindre des justificatifs factices (photo PDF d'un ticket de caisse libre de
  droits — `pexels.com` → recherche "receipt")

### 3.4 Missions

- **1 mission passée** validée
- **1 mission en cours**
- **1 mission proposée** en attente

### 3.5 Documents (Coffre-fort)

- **2 bulletins de paie** factices (PDF générés en interne, contenu réaliste mais
  données fictives)
- **1 contrat de travail** signé électroniquement
- **1 certificat de travail** ou attestation pour l'employé de démo

### 3.6 Notifications

S'assurer que le reviewer reçoit au moins **3 notifications push** au login :
- "N'oubliez pas de pointer ce matin"
- "Votre demande de congé a été approuvée"
- "Nouveau frais à valider" (côté manager)

---

## 4. Notes pour le reviewer (texte à coller dans App Store Connect)

Champ : **App Store Connect → My Apps → [App] → Information de connexion**

```
== Concorde Workly — Sign-in for Apple Review ==

Concorde Workly is a B2B HR SaaS application aimed at French-speaking SMBs
(5-200 employees). Business owners sign up via the web at
https://concorde-work-force.com/signup. The mobile app is used by employees
of existing tenants.

== Demo tenant ==

We have provisioned a dedicated test tenant "apple-reviewer" with realistic
sample data: 60 days of clock-in/out records, leave requests at various
statuses, expense claims, and uploaded documents.

== Test accounts ==

ADMIN ACCOUNT (full access):
  Username: reviewer@concorde-work-force.com
  Password: [coller le mot de passe ici]

MANAGER ACCOUNT (team approval flows):
  Username: manager.reviewer@concorde-work-force.com
  Password: [coller le mot de passe ici]

EMPLOYEE ACCOUNT (self-service flows):
  Username: employee.reviewer@concorde-work-force.com
  Password: [coller le mot de passe ici]

== Suggested flow to test core functionality ==

1. Sign in with the ADMIN account.
2. On the Home screen, tap "Clock in" — the app records your check-in.
3. Open "Mon pointage du mois" — the colored calendar shows holidays (red),
   approved leaves (brown), authorizations (yellow), and overtime (green).
4. Tap "Ajouter une demande" below the calendar — submit a leave request.
5. Switch to the MANAGER account to approve the leave request.
6. Open "Note de frais" — see existing expenses and submit a new one.
7. Try Face ID / Touch ID by enabling biometric lock in Profile settings,
   then locking and re-opening the app.

== Notes ==

- The app is currently in French only (English version planned post-launch).
- An AI assistant feature ("Chat IA") is available on the Home screen — it
  uses Anthropic Claude under standard contractual data protection clauses.
- The app uses certificate pinning for the main domain — please ensure your
  testing device has standard date/time settings, otherwise TLS may fail.

== Contact for review questions ==

Email: support@concorde-work-force.com
We respond within 24 hours, Monday to Friday, CET timezone.
```

Champ Google Play : **Play Console → App content → App access**

Mettre un texte plus court car Google indexe différemment. Coller les 3 paires
identifiant/mot-de-passe et expliquer en 5 lignes max le contexte B2B + comment
naviguer le parcours principal.

---

## 5. Réinitialisation post-review

Après chaque cycle de review (typiquement 1-3 jours par soumission), prévoir :

1. **Régénérer les mots de passe** (le reviewer Apple les voit, ne pas réutiliser
   pour de vraies données)
2. **Vérifier la cohérence des données** (le reviewer a peut-être créé des
   demandes, validé des frais, etc.)
3. **Réinitialiser les notifications push** (ne pas laisser un backlog)

Idéalement, automatiser via un script `scripts/reset-reviewer-tenant.sh` :

```bash
#!/bin/bash
# Réinitialise le tenant apple-reviewer pour la prochaine review.
psql -d abrpoint_master -c "
  -- Reset passwords (suppose argon2 hash function disponible)
  UPDATE utilisateurs SET passwordhash = crypt('$NEW_PASSWORD', gen_salt('argon2'))
    WHERE soccod = 'apple-reviewer' AND email LIKE '%@concorde-work-force.com';

  -- Purger l'historique de pointage > 60 jours pour garder le tenant léger
  DELETE FROM presences WHERE soccod = 'apple-reviewer' AND prdat < NOW() - INTERVAL '60 days';

  -- Réseeder via un job idempotent
"
```

À ne mettre en place que si tu prévois plus de 2-3 soumissions/an.

---

## 6. Pièges à éviter

| Erreur | Conséquence | Solution |
|---|---|---|
| Compte démo qui expire | Rejet automatique au prochain build | Mettre un email contact dans Stripe pour notif expiration trial |
| Mot de passe trop simple | Bloqué par les règles de complexité du backend | Générer 20+ caractères mixtes |
| Tenant vide | Reviewer voit "no data", suggère app inachevée | Pré-remplir données réalistes (§3) |
| Pas de manager | Impossible de tester les flux d'approbation | Toujours 3 personas (admin / manager / employé) |
| Photos de profil manquantes | UI moins polish dans les screenshots | Uploader avatars libre de droits (pexels) |
| 2FA activé sur le compte démo | Reviewer ne peut pas valider sans téléphone | Désactiver 2FA spécifiquement pour les 3 comptes démo |
| Compte démo dans un tenant prod réel | Reviewer pourrait voir/modifier des vraies données | Tenant dédié, jamais partagé |
| Mot de passe expire au 1er login | Reviewer bloqué | Désactiver "must change password on first login" pour ces comptes |

---

## 7. Statut

```
[ ] Tenant `apple-reviewer` créé
[ ] 3 comptes utilisateurs créés (admin, manager, employee)
[ ] Mots de passe forts générés + sauvegardés (1Password / Bitwarden)
[ ] Données de démo pré-remplies (pointage, congés, frais, docs)
[ ] 2FA désactivé pour les 3 comptes
[ ] Notes pour reviewer rédigées (§4 ci-dessus) prêtes à coller
[ ] Test interne : connexion réussie depuis un device neuf en mode avion → reconnexion
[ ] Rappel calendrier pour renouvellement (tous les 6 mois)
```
