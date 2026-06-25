// Wrapper de lancement Cypress.
//
// Contexte : l'hôte VS Code (terminal intégré / extension) exporte souvent
// `ELECTRON_RUN_AS_NODE=1`. Cette variable force TOUT binaire Electron — dont
// Cypress.exe — à s'exécuter comme un simple Node.js. Cypress échoue alors au
// démarrage avec « bad option: --smoke-test » (Node rejette les switches Electron).
//
// On supprime donc la variable de l'environnement transmis au process Cypress.
// Inoffensif quand elle n'est pas définie → sûr en CI comme en local.
import { spawn } from 'node:child_process';

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const mode = process.argv[2] === 'open' ? 'open' : 'run';
const extra = process.argv.slice(3);
const cli = process.platform === 'win32' ? 'cypress.cmd' : 'cypress';

const child = spawn(cli, [mode, '--e2e', ...extra], {
  stdio: 'inherit',
  env,
  shell: true,
});

child.on('exit', (code) => process.exit(code ?? 1));
child.on('error', (err) => {
  console.error('[run-cypress] échec de lancement de Cypress :', err);
  process.exit(1);
});
