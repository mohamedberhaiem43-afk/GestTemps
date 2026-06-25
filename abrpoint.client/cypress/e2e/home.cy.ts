/// <reference types="cypress" />

/**
 * Page d'accueil publique (landing marketing, route `/`).
 *
 * `/` n'est PAS auth-free → AuthProvider appelle /me au montage : on stubbe donc
 * l'état déconnecté avant chaque visite.
 */
describe('Page d\'accueil (publique)', () => {
  beforeEach(() => {
    cy.mockLoggedOut();
  });

  it('affiche le hero et la navigation', () => {
    cy.visitPublic('/');

    // Le titre principal (hero) doit être rendu.
    cy.get('h1').first().should('be.visible').and('not.be.empty');

    // La nav propose « Connexion » et « Créer un compte » pour un visiteur anonyme.
    cy.contains('button', /connexion/i).should('be.visible');
    cy.contains('button', /créer un compte/i).should('be.visible');
  });

  it('renvoie vers /login au clic sur « Connexion »', () => {
    cy.visitPublic('/');

    cy.contains('button', /connexion/i).first().click();
    cy.location('pathname').should('eq', '/login');
    cy.get('input[type="email"]').should('be.visible');
  });

  it('affiche la bannière de consentement cookies au premier passage', () => {
    // Ici on NE prépose PAS le consentement : la modale RGPD doit apparaître.
    cy.visit('/');

    cy.contains(/préférences cookies/i).should('be.visible');
    cy.contains('button', /tout accepter/i).click();

    // Après acceptation, la modale se ferme et le choix est persisté.
    cy.contains(/préférences cookies/i).should('not.exist');
    cy.window().its('localStorage')
      .invoke('getItem', 'abrpoint.cookie-consent.v2')
      .should('contain', '"version":2');
  });
});
