# Captures d'écran — Rapport d'architecture et tests

Ce dossier regroupe les captures référencées dans `RAPPORT_ARCHITECTURE_INFRA.md` §12 (Tests de validation et anomalies détectées).

## Convention de nommage

`<catégorie>-<symptôme>.png` — format PNG ou JPG, largeur recommandée ≥ 1200 px (sera réduite à la largeur de la cellule du tableau en PDF, mais conserve la lisibilité au zoom).

## Liste attendue par anomalie

### Sécurité (§12.1)

| Fichier | Anomalie |
|---|---|
| `security-audit-controllers.png` | S1 — Contrôleurs sans `[Authorize]` au niveau classe (audit reflectif). |
| `postman-autorisers-myauth-400.png` | S2 — `POST /api/Autorisers/my-auth` renvoie 400 (capture Postman ou DevTools). |
| `absence-report-500.png` | S3 — 500 sur `GET /api/Absences/get-absence-report/...`. |
| `mobile-starter-features-unfiltered.png` | S4 — App mobile Starter affichant Coffre/Missions/Frais/Assistant juridique. |

### Calcul (§12.2)

| Fichier | Anomalie |
|---|---|
| `etat-presence-hnuit-zero.png` | C1 — KPI H.nuit total à 0 en État de Présence. |
| `etat-periodique-hs-divide-par-2.png` | C2 — H.Supp divisées par 2 quand `Parelimftrv == "1"`. |
| `etat-droit-conge-matricule-vide.png` | C4 — Colonne Matricule vide en État Droit de Congé. |
| `etat-periodique-hftrv-zero.png` | C5 — H.Fér.Trv à 0 quand `MaxFerier` est NULL. |

### Interface (§12.3)

| Fichier | Anomalie |
|---|---|
| `employee-date-input-styling.png` | I1 — Champs date Fiche collaborateur stylés différemment. |
| `contrat-action-menu-overlap.png` | I2 — Menu d'action 3 points avec items inaccessibles. |
| `contrat-sites-empty.png` | I3 — Dropdown Sites vide en Gestion des contrats. |
| `etats-employes-empty.png` | I4 — Dropdown employés vide par défaut sur les États. |
| `etat-retard-double-column.png` | I5 — Colonnes Horaire/Pointage redondantes en État de Retard. |
| `etat-retard-misalign.png` | I6 — Décalage header Durée de Retard vs valeurs. |
| `i18n-en-gaps.png` | I7 — Chaînes manquantes en EN (Login, contrat). |
| `etat-droit-conge-statut.png` | I8 — Colonne Statut sans signification métier. |

### Performance (§12.4)

| Fichier | Anomalie / Métrique |
|---|---|
| `benchmark-plancatalog.png` | P1 — Sortie BenchmarkDotNet `PlanCatalog.All`. |
| `benchmark-refresh-hasher.png` | P2 — Sortie BenchmarkDotNet `RefreshTokenHasher.Hash`. |
| `benchmark-suspicious-login.png` | P3 — Sortie BenchmarkDotNet `SuspiciousLoginTokenService`. |
| `benchmark-monthly-total.png` | P4 — Sortie Stopwatch `ComputeMonthlyTotal`. |
| `benchmark-supplementary-count.png` | P5 — Sortie Stopwatch `ComputeSupplementaryCount`. |
| `pointagemois-slow.png` | P6 — DevTools Network montrant ~6 s de réponse Pointage du Mois. |
| `etat-periodique-laggy.png` | P8 — DevTools Performance révélant le lag scroll sur EtatPeriodique. |

## Après dépôt des fichiers

1. Vérifier que tous les fichiers ci-dessus sont présents dans `docs/screenshots/`.
2. Lancer la régénération du PDF :

```bash
cd docs && node _build_pdf.mjs RAPPORT_ARCHITECTURE_INFRA
```

3. Les images apparaîtront automatiquement dans les tableaux du §12 du PDF.

Si un fichier manque, l'image apparaîtra cassée dans le PDF (carré vide avec alt-text) — c'est l'indicateur visuel qu'une capture reste à fournir.
