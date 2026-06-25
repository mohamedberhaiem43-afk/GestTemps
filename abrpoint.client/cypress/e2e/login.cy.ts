/// <reference types="cypress" />

/**
 * Parcours de connexion (route `/login`).
 *
 * Flux réel (cf. Login.tsx) : lookup-tenant (résout le slug depuis l'email) →
 * POST /Utilisateurs/connect → /me. Tous mockés ici.
 * `/login` est auth-free : pas d'appel /me au montage tant que sessionStorage est vide.
 */
describe('Connexion / Authentification', () => {
  it('affiche le formulaire de connexion', () => {
    cy.visitPublic('/login');

    cy.contains(/bon retour/i).should('be.visible');
    cy.get('input[type="email"]').should('be.visible');
    cy.get('input[type="password"]').should('be.visible');
    cy.contains('button', /connecter/i).should('be.visible');
  });

  it('valide les champs obligatoires', () => {
    cy.visitPublic('/login');

    // Soumission à vide → message d'erreur, aucun appel réseau.
    cy.contains('button', /connecter/i).click();
    cy.contains('Veuillez remplir tous les champs obligatoires').should('be.visible');
  });

  it('affiche une erreur si aucun compte n\'est trouvé pour l\'email', () => {
    cy.intercept('POST', '**/auth/lookup-tenant', { statusCode: 200, body: { slug: null } }).as('lookup');

    cy.visitPublic('/login');
    cy.get('input[type="email"]').type('inconnu@nulle-part.test');
    cy.get('input[type="password"]').type('peu-importe', { log: false });
    cy.contains('button', /connecter/i).click();

    cy.wait('@lookup');
    cy.contains('Aucun compte trouvé pour cet email').should('be.visible');
  });

  it('affiche une erreur sur identifiants invalides', () => {
    cy.intercept('POST', '**/auth/lookup-tenant', { fixture: 'lookup-tenant.json' }).as('lookup');
    cy.intercept('POST', '**/Utilisateurs/connect', { statusCode: 401, body: { error: 'invalid' } }).as('connect');

    cy.visitPublic('/login');
    cy.get('input[type="email"]').type('admin@demo.test');
    cy.get('input[type="password"]').type('mauvais-mot-de-passe', { log: false });
    cy.contains('button', /connecter/i).click();

    cy.wait('@connect');
    cy.contains('Identifiants incorrects').should('be.visible');
    // On reste sur la page de login.
    cy.location('pathname').should('eq', '/login');
  });

  it('connecte et redirige vers le dashboard sur identifiants valides', () => {
    cy.loginViaUi();

    cy.wait('@connect');
    cy.wait('@me');
    cy.location('pathname').should('eq', '/dashboard');
  });

  it('bascule sur le formulaire « mot de passe oublié »', () => {
    cy.visitPublic('/login');

    cy.contains(/mot de passe oublié/i).click();
    cy.contains(/réinitialiser votre mot de passe/i).should('be.visible');
    cy.contains('button', /envoyer le code/i).should('be.visible');
  });
});
