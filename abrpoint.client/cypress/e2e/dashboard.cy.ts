/// <reference types="cypress" />

/**
 * Espace connecté (route `/dashboard`).
 *
 * RequireAuth (RouteGuards.tsx) : sans `uticod` (issu de /me), redirige en dur vers
 * /login ; avec un utilisateur valide + email vérifié, rend le shell applicatif.
 */
describe('Dashboard (post-login)', () => {
  it('redirige un visiteur non authentifié vers /login', () => {
    cy.mockLoggedOut();
    // Visite publique (pas de sessionStorage d'auth) : la garde doit rediriger.
    cy.visitPublic('/dashboard');

    cy.location('pathname', { timeout: 10000 }).should('eq', '/login');
    cy.get('input[type="email"]').should('be.visible');
  });

  it('affiche le shell applicatif pour un admin authentifié', () => {
    cy.mockLoggedIn();
    cy.visitAuthed('/dashboard');

    cy.wait('@me');
    // Pas de redirection : on reste bien sur le dashboard.
    cy.location('pathname').should('eq', '/dashboard');

    // Le shell (sidebar) est rendu : l'entrée « Tableau de bord » est présente.
    cy.contains(/tableau de bord/i, { timeout: 10000 }).should('be.visible');
    // On est bien dans l'app, pas sur le formulaire de connexion.
    cy.get('input[type="password"]').should('not.exist');
  });

  it('respecte une surcharge de /me (email non vérifié → /verify-email)', () => {
    // Démontre la surcharge de fixture : un email non vérifié déclenche la
    // redirection RequireAuth vers /verify-email.
    cy.mockLoggedIn({ emailVerified: false });
    cy.visitAuthed('/dashboard');

    cy.wait('@me');
    cy.location('pathname', { timeout: 10000 }).should('eq', '/verify-email');
  });
});
