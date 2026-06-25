import { defineConfig } from 'cypress';

/**
 * Configuration Cypress — tests E2E « API mockée ».
 *
 * Fichier en `.mjs` (ESM pur) : le projet est `"type": "module"`, donc une config
 * `.ts` chargée via ts-node sortirait du CommonJS dans un scope ESM
 * (« exports is not defined »). Le `.mjs` est auto-détecté par Cypress et évite tout
 * transpile.
 *
 * Approche : toutes les requêtes backend sont stubbées via `cy.intercept` (cf.
 * cypress/support/commands.ts). Les tests tournent UNIQUEMENT contre le serveur de
 * dev Vite, sans backend .NET ni PostgreSQL → déterministes, rapides, CI-ready.
 *
 * Le dev server est démarré en HTTP (DOCKER_BUILD=true côté vite.config.ts) pour
 * éviter les soucis de certificat auto-signé HTTPS. Cf. scripts npm `cypress:run` / `e2e`.
 */
export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    fixturesFolder: 'cypress/fixtures',
    viewportWidth: 1366,
    viewportHeight: 900,
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 8000,
    // L'app fait des appels cross-origin (API sur un autre port/host). On désactive
    // la web security Chrome pour que cy.intercept couvre tout sans friction.
    chromeWebSecurity: false,
    retries: { runMode: 1, openMode: 0 },
  },
});
