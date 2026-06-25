# Tests E2E Cypress — abrpoint.client

Suite de tests end-to-end **avec API mockée** : tout le backend (.NET / PostgreSQL)
est stubbé via `cy.intercept`. Les tests tournent uniquement contre le serveur de
dev Vite → déterministes, rapides, sans dépendance d'infra, exécutables en CI.

## Lancer les tests

Depuis `abrpoint.client/` :

```bash
# Headless (démarre le dev server HTTP puis joue toutes les specs)
npm run e2e

# Mode interactif (ouvre l'UI Cypress ; pratique pour écrire/déboguer)
npm run e2e:open
```

Ces scripts utilisent `start-server-and-test` pour :
1. démarrer Vite en **HTTP** sur `http://localhost:5173` (`npm run dev:http`,
   c.-à-d. `cross-env DOCKER_BUILD=true vite` — le flag désactive le HTTPS auto-signé
   du dev pour éviter tout souci de certificat dans Cypress) ;
2. attendre que le serveur réponde ;
3. lancer Cypress, puis arrêter Vite à la fin.

> Si le dev server tourne déjà sur `:5173` en HTTP, on peut lancer directement
> `npm run cypress:run` (headless) ou `npm run cypress:open` (UI).

## Structure

```
cypress/
├── e2e/
│   ├── home.cy.ts        # Landing publique : hero, nav → /login, bannière cookies
│   ├── login.cy.ts       # Auth : validation, no-account, creds invalides, succès → /dashboard
│   ├── dashboard.cy.ts   # Garde RequireAuth : redirection /login, shell admin, email non vérifié
│   └── signup.cy.ts      # Inscription : rendu du formulaire, auto-slug, saisie
├── fixtures/
│   ├── lookup-tenant.json # Réponse /auth/lookup-tenant ({ slug })
│   ├── connect-success.json # Réponse POST /Utilisateurs/connect
│   └── me-admin.json     # Réponse GET /Utilisateurs/me (admin, toutes features activées)
├── support/
│   ├── e2e.ts            # Bootstrap + filtre des exceptions réseau attendues (401 mockés)
│   └── commands.ts       # Commandes custom (voir ci-dessous)
└── tsconfig.json         # Types Cypress (isolé du build app)
```

## Commandes custom (`support/commands.ts`)

| Commande | Rôle |
|---|---|
| `cy.visitPublic(path)` | Visite une page publique en neutralisant la modale de consentement cookies (préposée en `localStorage` avant boot). |
| `cy.visitAuthed(path)` | Idem + amorce le `sessionStorage` d'auth (`uticod`, `soccod`, `tenantSlug`…) comme après une vraie connexion. |
| `cy.mockLoggedOut()` | Stubbe `/Utilisateurs/me` et `/refresh` en 401 (+ catch-all `/api` → `[]`). |
| `cy.mockLoggedIn(overrides?)` | Stubbe `/me` avec `me-admin.json` (surchargeable) + catch-all `/api` → `[]`. |
| `cy.loginViaUi(email?, pwd?)` | Connexion complète via le formulaire, avec `lookup-tenant` → `connect` → `me` mockés. |

### Points d'architecture importants (rappels)

- **Auth = cookies httpOnly** (invisibles côté JS). On simule l'état connecté en
  amorçant `sessionStorage('uticod')` **et** en stubbant `/me` — `AuthProvider`
  hydrate depuis le storage puis confirme via `/me`.
- **Router custom** par `switch(pathname)` ; `RequireAuth`/`RequireAdmin`
  (`components/helper/RouteGuards.tsx`) redirigent en dur (`window.location.replace`)
  vers `/login` (non authentifié) ou `/verify-email` (email non vérifié).
- **i18n FR par défaut** (fallback `fr`, détection `localStorage` uniquement) → les
  assertions de texte sont en français.
- **Stub catch-all = `[]`** : tableau vide = stub le plus sûr (lire une propriété
  dessus → `undefined` sans exception, `.map()` → rendu vide).

## Étendre la suite

- **Nouveau parcours protégé** : `cy.mockLoggedIn()` puis `cy.visitAuthed('/dashboard/...')`.
  Pour un rôle/état différent, surcharger `/me` : `cy.mockLoggedIn({ isAdmin: false })`.
- **Stub d'un endpoint précis** : poser un `cy.intercept` *après* `mockLoggedIn`
  (Cypress applique la route la plus récente en premier) :
  `cy.intercept('GET', '**/Employes/**', { fixture: 'employes.json' }).as('emps')`.
- **Nouvelle fixture** : ajouter le `.json` dans `cypress/fixtures/` et le référencer
  via `{ fixture: 'mon-fichier.json' }`.

## CI

Headless via Electron embarqué (aucun navigateur à installer) :

```yaml
- run: npm ci
  working-directory: abrpoint.client
- run: npm run e2e
  working-directory: abrpoint.client
```
