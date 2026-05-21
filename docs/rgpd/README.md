# Documentation RGPD — Concorde Workforce

Ce dossier rassemble les documents juridico-organisationnels exigés par le
RGPD et la loi Informatique et Libertés. Ils sont **interdépendants** et se
référencent mutuellement.

## Inventaire

| # | Document | Article RGPD | Audience |
|---|---|---|---|
| C1 | [Registre des traitements](./01-registre-traitements.md) | Art. 30 | Interne — opposable à la CNIL en cas de contrôle |
| C3 | [AIPD — pointage RH](./02-aipd-pointage-rh.md) | Art. 35 | Interne + à disposition des clients RT pour leur propre AIPD |
| C4 | [Procédure d'exercice des droits](./03-procedure-droits-personnes.md) | Art. 12-22 | Interne (registre + modèle d'accusé de réception) |
| C9 | [Politique de confidentialité](./04-politique-confidentialite.md) | Art. 13-14 | **Public** — à publier sur le site et lier depuis chaque écran |
| C10 | [Mentions légales](./05-mentions-legales.md) | LCEN Art. 6.III | **Public** — à publier dans le footer du site |
| C6 | [Audit des sous-traitants ultérieurs](./06-audit-sous-traitants.md) | Art. 28 | Annexe II du DPA — communiquée aux clients |
| C5 | [Procédure de notification de violation 72 h](./07-procedure-violation-72h.md) | Art. 33-34 | Interne (runbook incident) + modèles de notification CNIL / client / personnes |
| C7 | [Politique de conservation des données](./08-politique-conservation.md) | Art. 5.1.e | Interne (cf. registre §III) + opposable CNIL |

## Documents complémentaires

| Document | Emplacement |
|---|---|
| Checklist sécurité infrastructure | [`../SECURITY_INFRA_CHECKLIST.md`](../SECURITY_INFRA_CHECKLIST.md) |
| Section II des CGU (mesures Art. 32) | À intégrer dans le contrat client par l'avocat |
| Bandeau cookies | Composant [`abrpoint.client/src/components/helper/CookieConsent.tsx`](../../abrpoint.client/src/components/helper/CookieConsent.tsx) |

## Champs `[À COMPLÉTER]`

Tous les documents publics contiennent des champs `[À COMPLÉTER]` (raison
sociale, SIRET, capital, adresse, nom du DPO, etc.). Ces champs sont à
renseigner par l'éditeur **avant publication**. Les inventer serait
constitutif d'une fausse déclaration au regard de la LCEN.

Liste centralisée à remplir une fois pour toutes :

- [ ] Raison sociale exacte
- [ ] Forme juridique (SARL, SAS, SASU…)
- [ ] Capital social en euros
- [ ] SIRET (14 chiffres)
- [ ] RCS (ville + numéro)
- [ ] Numéro de TVA intracommunautaire
- [ ] Adresse du siège social
- [ ] Téléphone
- [ ] Nom et fonction du représentant légal (directeur de la publication)
- [ ] Nom du DPO (ou décision documentée de ne pas en désigner)
- [ ] URL publique des CGU
- [ ] État du dépôt INPI des marques « Concorde Workforce » et « Concorde Workly »

## Ordre suggéré de mise en production

1. Compléter les champs ci-dessus (1 à 2 h avec votre comptable / KBIS sous la main).
2. Faire **relire les 6 documents par un avocat** spécialisé RGPD (idéalement
   le même qui a rédigé la section II des CGU). Compter une demi-journée.
3. **Publier** la politique de confidentialité et les mentions légales sur le
   site (deux nouvelles pages `/confidentialite` et `/mentions-legales` +
   liens dans le footer + liens dans le bandeau cookies).
4. **Activer l'adresse `dpo@concorde-tech.fr`** (alias vers le DPO interne ou
   externe) avec un workflow de tracking (label dédié dans la boîte support).
5. **Signer / formaliser tous les DPA** listés dans `06-audit-sous-traitants.md`
   §4 (actions immédiates).
6. **Communiquer aux clients existants** la mise à jour de la politique de
   confidentialité et l'Annexe II du DPA, par email.
7. **Archiver** une copie horodatée de chaque document publié (un PDF signé
   conservé dans un coffre-fort numérique avec horodatage qualifié si
   possible — utile en cas de contrôle CNIL).

## Cycle de revue

| Document | Fréquence |
|---|---|
| Registre des traitements | À chaque nouveau traitement ou évolution majeure |
| AIPD | Tous les 24 mois OU à chaque évolution majeure du module |
| Procédure d'exercice des droits | Annuelle |
| Politique de confidentialité | À chaque évolution réglementaire ou nouveau sous-traitant |
| Mentions légales | À chaque changement d'éditeur, d'hébergeur ou de coordonnées |
| Audit sous-traitants | Annuel + à chaque admission/retrait |
| Procédure de notification de violation | Exercice de simulation annuel (table-top) |
| Politique de conservation | Annuelle (mises à jour réglementaires, loi de finances) |
