/// <reference types="cypress" />

/**
 * Commandes custom partagées par toutes les specs.
 *
 * Toute la stratégie de test repose sur le mock réseau (`cy.intercept`) : on ne
 * démarre JAMAIS le backend .NET. Ces helpers posent les stubs d'authentification
 * récurrents et préchargent le `localStorage`/`sessionStorage` AVANT le boot de l'app.
 *
 * Rappels d'archi (cf. AuthProvider.tsx / RouteGuards.tsx) :
 *   - L'auth réelle passe par des cookies httpOnly → invisibles côté JS. On simule
 *     l'état connecté en amorçant `uticod` en sessionStorage ET en stubbant /me.
 *   - RequireAuth lit `uticod` + `emailVerified` (issus de /me) ; sinon redirige /login.
 *   - i18n est en FRANÇAIS par défaut (fallback 'fr', détection localStorage uniquement).
 *   - La bannière cookies est un <Dialog> MUI (backdrop bloquant) : on prépose un
 *     consentement pour qu'elle ne s'ouvre pas et n'intercepte pas les clics.
 */

const COOKIE_CONSENT_KEY = 'abrpoint.cookie-consent.v2';
// Forme attendue par getCookieConsent() (version === 2) → la modale ne s'ouvre pas.
const PRESET_CONSENT = JSON.stringify({
  categories: { necessary: true, audience: false, marketing: false },
  date: '2026-01-01T00:00:00.000Z',
  version: 2,
});

/** Amorce le storage du tenant comme le ferait Login.tsx après une connexion OK. */
function seedAuthStorage(win: Window): void {
  win.sessionStorage.setItem('uticod', 'U001');
  win.sessionStorage.setItem('soccod', 'S001');
  win.sessionStorage.setItem('sitcod', 'SITE01');
  win.sessionStorage.setItem('userName', 'Admin Démo');
  // Lu par apiInstance pour injecter le header X-Tenant-Slug.
  win.localStorage.setItem('tenantSlug', 'demo');
}

/** Visite une page publique en neutralisant la modale de consentement cookies. */
function visitPublic(path: string): void {
  cy.visit(path, {
    onBeforeLoad: (win) => {
      win.localStorage.setItem(COOKIE_CONSENT_KEY, PRESET_CONSENT);
    },
  });
}

/** Visite une page protégée : storage d'auth amorcé + consentement cookies préposé. */
function visitAuthed(path: string): void {
  cy.visit(path, {
    onBeforeLoad: (win) => {
      win.localStorage.setItem(COOKIE_CONSENT_KEY, PRESET_CONSENT);
      seedAuthStorage(win);
    },
  });
}

/** Stubbe l'état « déconnecté » : /me et /refresh renvoient 401, le reste []. */
function mockLoggedOut(): void {
  // Catch-all d'abord ; Cypress applique les routes du PLUS RÉCENT au plus ancien,
  // donc /me et /refresh ci-dessous prennent le dessus.
  cy.intercept('GET', '**/api/**', { statusCode: 200, body: [] });
  cy.intercept('POST', '**/api/**', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/Utilisateurs/me', { statusCode: 401, body: {} }).as('me');
  cy.intercept('POST', '**/Utilisateurs/refresh', { statusCode: 401, body: {} }).as('refresh');
}

/**
 * Stubbe l'état « connecté » : /me renvoie un admin (fixture me-admin, surchargeable),
 * et toutes les autres requêtes /api/** renvoient un tableau vide pour que les pages
 * (dashboard, listes…) se chargent sans backend ni spinners infinis.
 *
 * Un tableau vide est le stub le plus sûr : lire une propriété dessus renvoie
 * `undefined` (pas d'exception) ET `.map()` fonctionne (rendu vide).
 */
function mockLoggedIn(overrides: Record<string, unknown> = {}): void {
  cy.intercept('GET', '**/api/**', { statusCode: 200, body: [] });
  cy.intercept('POST', '**/api/**', { statusCode: 200, body: [] });
  cy.fixture('me-admin.json').then((me) => {
    cy.intercept('GET', '**/Utilisateurs/me', {
      statusCode: 200,
      body: { ...me, ...overrides },
    }).as('me');
  });
}

/**
 * Connexion complète VIA L'INTERFACE (saisie + clic), avec tous les appels du flux
 * login mockés : lookup-tenant → connect → me. Laisse l'app sur /dashboard.
 */
function loginViaUi(email = 'admin@demo.test', password = 'Demo!Passw0rd2026'): void {
  cy.intercept('POST', '**/auth/lookup-tenant', { fixture: 'lookup-tenant.json' }).as('lookup');
  cy.intercept('POST', '**/Utilisateurs/connect', { fixture: 'connect-success.json' }).as('connect');
  cy.intercept('GET', '**/api/**', { statusCode: 200, body: [] });
  cy.fixture('me-admin.json').then((me) => {
    cy.intercept('GET', '**/Utilisateurs/me', { statusCode: 200, body: me }).as('me');
  });

  visitPublic('/login');
  cy.get('input[type="email"]').clear().type(email);
  cy.get('input[type="password"]').clear().type(password, { log: false });
  cy.contains('button', /connecter/i).click();
}

Cypress.Commands.add('visitPublic', visitPublic);
Cypress.Commands.add('visitAuthed', visitAuthed);
Cypress.Commands.add('mockLoggedOut', mockLoggedOut);
Cypress.Commands.add('mockLoggedIn', mockLoggedIn);
Cypress.Commands.add('loginViaUi', loginViaUi);

// ─── Types des commandes custom ────────────────────────────────────────────
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /** Visite une page publique sans la modale de consentement cookies. */
      visitPublic(path: string): Chainable<void>;
      /** Visite une page protégée (sessionStorage d'auth amorcé). */
      visitAuthed(path: string): Chainable<void>;
      /** Stubbe /me + /refresh en 401 (état déconnecté). */
      mockLoggedOut(): Chainable<void>;
      /** Stubbe /me (admin) + catch-all /api → []. */
      mockLoggedIn(overrides?: Record<string, unknown>): Chainable<void>;
      /** Connexion réelle via le formulaire, avec lookup/connect/me mockés. */
      loginViaUi(email?: string, password?: string): Chainable<void>;
    }
  }
}

export {};
