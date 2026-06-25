/// <reference types="cypress" />

/**
 * Parcours d'inscription (route `/signup`).
 *
 * `/signup` est auth-free (pas d'appel /me). La page sonde des endpoints de
 * vérification (captcha, check-slug, check-email, check-siret) au montage / à la
 * saisie : on les couvre par un catch-all qui renvoie un objet vide inoffensif.
 */
describe('Inscription / Signup', () => {
  beforeEach(() => {
    // Réponses neutres pour les vérifications temps réel (lues en optional-chaining).
    cy.intercept('GET', '**/signup/**', { statusCode: 200, body: {} });
    cy.intercept('POST', '**/signup/**', { statusCode: 200, body: {} });
  });

  it('affiche le formulaire d\'inscription', () => {
    cy.visitPublic('/signup');

    cy.contains('Démarrer mon essai gratuit').should('be.visible');
    cy.get('#su-email').should('be.visible');
    cy.get('#su-company').should('be.visible');
    cy.get('#su-firstname').should('be.visible');
    cy.get('#su-lastname').should('be.visible');
  });

  it('génère automatiquement le slug à partir du nom de société', () => {
    cy.visitPublic('/signup');

    cy.get('#su-company').type('Demo Entreprise');
    // slugify : minuscules, accents retirés, séparateurs → tirets.
    cy.get('#su-slug').should('have.value', 'demo-entreprise');
  });

  it('permet de saisir email, prénom et nom', () => {
    cy.visitPublic('/signup');

    cy.get('#su-email').type('nouvel.admin@demo.test').should('have.value', 'nouvel.admin@demo.test');
    cy.get('#su-firstname').type('Jean').should('have.value', 'Jean');
    cy.get('#su-lastname').type('Dupont').should('have.value', 'Dupont');
  });
});
