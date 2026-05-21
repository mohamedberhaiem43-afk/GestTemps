# Registre des activités de traitement

**Article 30 RGPD** — version 1.0 — dernière mise à jour : 2026-05-20

> **À compléter par l'éditeur** avant publication :
> - Raison sociale, SIRET, adresse, capital social, RCS, n° TVA intracommunautaire
> - Nom et coordonnées du représentant légal
> - Nom et coordonnées du DPO (interne ou externe mutualisé)
> - Rôle joué : ce document distingue clairement les traitements pour lesquels
>   Concorde est **responsable de traitement** (RT) — ses propres données
>   internes, prospection, facturation — et ceux pour lesquels Concorde est
>   **sous-traitant** (ST) au sens de l'article 28 RGPD — les données RH des
>   employés des clients hébergées dans les tenants applicatifs.

---

## I. Identification du responsable de traitement et du DPO

| Champ | Valeur |
|---|---|
| Raison sociale | [À COMPLÉTER] |
| Forme juridique | [À COMPLÉTER — SARL / SAS / SASU…] |
| SIRET | [À COMPLÉTER — 14 chiffres] |
| Adresse postale | [À COMPLÉTER] |
| Représentant légal | [À COMPLÉTER — Nom, fonction] |
| Site web | https://concorde-tech.fr |
| DPO — nom | [À COMPLÉTER ou « DPO non désigné — justification : entreprise < seuil Art. 37, traitement non systématique au sens de l'Art. 37.1.b »] |
| DPO — contact | dpo@concorde-tech.fr |
| Délégué à la protection adjoint | Le cas échéant |

---

## II. Traitements dont Concorde est RESPONSABLE DE TRAITEMENT (RT)

Données collectées et traitées par Concorde **pour son propre compte** :
prospects, clients (au sens contractuel), candidats à l'embauche, salariés
internes Concorde, abonnés newsletter.

### T-RT-01 — Gestion des prospects et clients (CRM commercial)

| Rubrique | Contenu |
|---|---|
| Finalité | Démarchage commercial B2B, suivi des opportunités, facturation, support |
| Base légale | Intérêt légitime (prospection B2B) ; exécution du contrat (clients) ; art. 6.1.b et 6.1.f RGPD |
| Catégories de personnes | Prospects, clients (personnes physiques représentant une personne morale) |
| Catégories de données | Nom, prénom, fonction, email professionnel, téléphone, raison sociale employeur, échanges commerciaux, contrats signés, factures |
| Destinataires internes | Équipe commerciale, équipe support, comptabilité |
| Destinataires externes | Stripe (paiement) ; comptable externe ; expert-comptable |
| Transferts hors UE | Aucun |
| Durée de conservation | Prospects : 3 ans depuis le dernier contact ; clients : durée de la relation + 5 ans (prescription commerciale, art. L110-4 du Code de commerce) ; factures : 10 ans (art. L123-22 Code de commerce) |
| Mesures de sécurité | Cf. doc `SECURITY_INFRA_CHECKLIST.md` et CGU Section II |

### T-RT-02 — Gestion du formulaire de contact public

| Rubrique | Contenu |
|---|---|
| Finalité | Répondre aux demandes entrantes via le formulaire de contact du site |
| Base légale | Intérêt légitime (art. 6.1.f) |
| Catégories de personnes | Visiteurs du site soumettant le formulaire |
| Catégories de données | Nom, email, message libre |
| Destinataires | Équipe support Concorde |
| Transferts hors UE | Aucun |
| Durée de conservation | 12 mois après réponse |
| Mesures | TLS 1.2+, rate-limiting, journalisation |

### T-RT-03 — Gestion des cookies et traceurs sur le site

| Rubrique | Contenu |
|---|---|
| Finalité | Fonctionnement du site, mesure d'audience anonymisée, le cas échéant personnalisation |
| Base légale | Exemption art. 82 Loi Informatique et Libertés (strictement nécessaires) ; consentement (autres) |
| Catégories de personnes | Visiteurs du site |
| Catégories de données | Cookies de session, préférences de langue, traceurs de mesure d'audience (si configurés CNIL-exempts) ou consentis |
| Destinataires | Concorde ; le cas échéant outil de mesure d'audience |
| Durée de conservation | 13 mois maximum (cookies non strictement nécessaires) ; durée de la session (strictement nécessaires) |
| Référence implémentation | `abrpoint.client/src/components/helper/CookieConsent.tsx` |

### T-RT-04 — Gestion des salariés et candidats Concorde

| Rubrique | Contenu |
|---|---|
| Finalité | Gestion administrative du personnel interne, paie, formation, recrutement |
| Base légale | Exécution du contrat de travail (art. 6.1.b) ; obligations légales (art. 6.1.c) |
| Catégories de personnes | Salariés Concorde, candidats, alternants, stagiaires |
| Catégories de données | État civil, contrat, paie, formation, évaluations |
| Destinataires | RH interne, comptable, organismes sociaux (URSSAF, mutuelle, prévoyance) |
| Durée de conservation | Selon référentiel CNIL « Gestion du personnel » (variable par catégorie : paie 5 ans, dossier salarié 5 ans après départ, candidatures non retenues 2 ans) |

---

## III. Traitements dont Concorde est SOUS-TRAITANT (ST) au sens de l'art. 28

Concorde héberge et traite **pour le compte de chacun de ses clients** les
données des employés et utilisateurs internes du client. Le **responsable de
traitement reste le client** ; Concorde agit sur instruction documentée
via les CGU + DPA.

### T-ST-01 — Hébergement et traitement des données RH des clients

| Rubrique | Contenu |
|---|---|
| Finalité (instruction RT) | Pointage horaire, gestion des congés/absences, préparation de la paie, signature électronique, coffre-fort numérique, gestion contractuelle, notifications, assistance IA |
| Base légale (au niveau du client RT) | Exécution du contrat de travail ; obligations légales (paie, droit du travail) ; intérêt légitime de l'employeur |
| Catégories de personnes | Salariés, ex-salariés, managers, administrateurs des clients |
| Catégories de données | Identification (nom, prénom, photo, n° matricule, CIN/SIRET équivalent, date de naissance, sexe, situation familiale) ; coordonnées (email, téléphone, mobile, adresse) ; vie professionnelle (poste, fonction, service, direction, horaires) ; rémunération (salaire de base, brut, net, primes, rubriques de paie) ; pointage (entrées/sorties horodatées, géolocalisation GPS au moment du pointage, type de pointage) ; congés et absences (dates, motifs, soldes) ; documents (contrats, bulletins, justificatifs déposés au coffre-fort) ; authentification (hash BCrypt du mot de passe, secret TOTP, jetons de session, empreinte d'appareil) ; logs d'accès |
| Catégories particulières | Aucune donnée sensible au sens de l'art. 9 RGPD n'est requise par défaut. Si un client choisit d'uploader dans le coffre-fort des arrêts maladie ou des justificatifs comportant des données de santé, ces données restent sous sa responsabilité et son contrôle (chiffrement au repos applicable). Aucun traitement automatisé n'est effectué sur ces fichiers. |
| Destinataires (au niveau ST) | Le client et ses utilisateurs habilités selon le RBAC configuré par le client ; Concorde — équipe d'exploitation strictement habilitée pour le support et la maintenance |
| Sous-traitants ultérieurs | Cf. doc `06-audit-sous-traitants.md` (Annexe II du DPA) |
| Transferts hors UE | Hébergement OVH France (eu-west-3 équivalent) ; sauvegardes S3 région UE. Sous-traitants ultérieurs susceptibles d'impliquer un transfert : OpenRouter (US, sous CCT) — option Anthropic région UE disponible. Le client est informé en Annexe II. |
| Durée de conservation | Pendant la durée du contrat client ; à l'issue, 90 jours de rétention pour réversibilité (réactivation possible) puis suppression effective des bases tenants (cf. `DOSSIER_TECHNIQUE.md`). Audit logs : 6 mois (180 j) configurable, plancher 30 j. **Purges automatiques** des données techniques (cf. `Services/DataRetentionHostedService.cs`) : refresh tokens expirés > 30 j ; known devices inactifs > 365 j ; push tokens désactivés > 90 j ; historique IA (rag_chat_log) > 90 j. |
| Mesures de sécurité | Cf. CGU Section II + `SECURITY_INFRA_CHECKLIST.md` |

### T-ST-02 — Notifications push mobiles

| Rubrique | Contenu |
|---|---|
| Finalité | Envoi de rappels de pointage, validation de congés, alertes de sécurité |
| Catégories de données | Identifiant push Expo / FCM, identifiant interne utilisateur, plateforme |
| Destinataires | Expo (Apple Push, Google FCM en bout de chaîne) |
| Transferts hors UE | Apple / Google : US — couvert par CCT |
| Durée de conservation | Jusqu'à désinstallation de l'application ou désactivation des notifications |

### T-ST-03 — Assistant IA contextualisé (RAG)

| Rubrique | Contenu |
|---|---|
| Finalité | Recherche sémantique dans les documents du client, génération de réponses contextualisées par un LLM |
| Catégories de données | Question de l'utilisateur, extraits récupérés du tenant, identifiant utilisateur |
| Destinataires | **Anthropic en région UE par défaut** (compte Enterprise avec résidence UE activée). OpenRouter conservé uniquement comme option de développement (`UseOpenRouter=true`), désactivé en production. |
| Transferts hors UE | **Aucun en configuration par défaut**. Le CIN est en outre pseudonymisé en base (chiffrement AES-256-GCM automatique via EF Core value converter) et masqué automatiquement avant toute transmission au LLM. |
| Durée de conservation | Historique des questions/réponses : 90 jours (`rag_chat_log`) |

---

## IV. Mise à jour du registre

| Évolution | Quand mettre à jour |
|---|---|
| Nouveau traitement (nouvelle feature collectant des PII) | Avant mise en production |
| Nouveau sous-traitant ultérieur | Préavis 30 j aux clients (DPA), entrée ajoutée |
| Changement de durée de conservation | À chaque modification de configuration `Security:*` ou de politique métier |
| Changement de DPO | Immédiat |

### Périmètre des purges automatiques

Les purges automatiques implémentées par Concorde (cf. service
`DataRetentionHostedService` et `AuditLogRetentionHostedService`) couvrent
**uniquement** les données **techniques** de sécurité et de minimisation :
journaux d'accès, jetons d'authentification, empreintes d'appareils,
historique IA, tokens push inactifs.

Les **données métier** des salariés (état civil, contrats, paie, historique
de pointage, congés, documents) restent sous la **responsabilité du client
RT** quant à leur durée de conservation, puisque celles-ci dépendent
d'obligations légales propres à chaque pays et secteur (en France : paie
et bulletins 5 ans, contrats 5 ans après fin de contrat, etc.). Concorde
met à disposition les outils d'effacement et d'export pour permettre au
client de mettre en œuvre sa propre politique de conservation.

Le registre est tenu à disposition de la CNIL en cas de contrôle (art. 30.4 RGPD).

---

**Documents liés :**
- [Politique de confidentialité publique](./04-politique-confidentialite.md)
- [Procédure d'exercice des droits](./03-procedure-droits-personnes.md)
- [Audit des sous-traitants — Annexe II du DPA](./06-audit-sous-traitants.md)
- [AIPD — Module pointage RH](./02-aipd-pointage-rh.md)
- [Checklist sécurité infrastructure](../SECURITY_INFRA_CHECKLIST.md)
