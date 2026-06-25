/// <reference types="cypress" />
import './commands';

/**
 * Le code applicatif logue volontairement certaines erreurs réseau attendues en
 * console (ex. 401 sur /me quand on est déconnecté, cf. apiInstance interceptor).
 * On empêche ces `console.error` de faire échouer les tests : ce ne sont pas des
 * exceptions non gérées, juste du bruit de log attendu dans un contexte mocké.
 */
Cypress.on('uncaught:exception', (err) => {
  // Les rejets de promesse axios sur les appels mockés en 401/erreur sont attendus
  // et gérés par l'app (état déconnecté). On ne fait pas échouer le test dessus.
  if (/Network Error|Request failed with status code|401/.test(err.message)) {
    return false;
  }
  // Toute autre exception non gérée reste une vraie régression → on laisse échouer.
  return undefined;
});
