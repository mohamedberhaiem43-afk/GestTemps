#!/usr/bin/env node
/**
 * Capture automatique des screenshots store via Playwright.
 *
 * Pré-requis :
 *   - npm install -g playwright
 *   - npx playwright install chromium
 *   - Backend ABRPOINT.Server lancé sur http://localhost:5173 (ou adapter BASE_URL)
 *   - Tenant de démo provisionné (compte reviewer pré-renseigné)
 *
 * Utilisation :
 *   BASE_URL=https://staging.concorde-work-force.com \
 *   REVIEWER_EMAIL=demo@concorde-work-force.com \
 *   REVIEWER_PASSWORD=xxx \
 *   node store/capture-screenshots.mjs
 *
 * Sortie : ./store/screenshots/{phone,tablet}/*.png aux dimensions natives
 * App Store / Play Store. Pas besoin de redimensionner — les fichiers générés
 * peuvent être uploadés tels quels.
 *
 * Stratégie : on capture le rendu web responsive sous viewport ≈ device pixel
 * exact. Les screenshots web sont acceptés par Apple/Google pour les apps
 * cross-platform tant qu'on respecte les dimensions natives. Pour des
 * screenshots VRAIMENT mobiles (status bar iOS, encoche, etc.), passer par
 * Xcode Simulator / Android Studio AVD (cf. SIMULATOR_CAPTURE.md).
 */

import { chromium, devices } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173';
const REVIEWER_EMAIL = process.env.REVIEWER_EMAIL ?? 'demo@concorde-work-force.com';
const REVIEWER_PASSWORD = process.env.REVIEWER_PASSWORD ?? '';
const OUT_DIR = resolve(__dirname, 'screenshots');

if (!REVIEWER_PASSWORD) {
  console.error('❌ REVIEWER_PASSWORD non défini. Exporter la variable d\'environnement.');
  process.exit(1);
}

// Profils de capture — chaque profil correspond à un device class store.
// Dimensions exactes acceptées par App Store Connect et Google Play.
const PROFILES = [
  {
    name: 'iphone-6.7',
    viewport: { width: 430, height: 932 },        // iPhone 15 Pro Max CSS pixels
    deviceScaleFactor: 3,                          // → 1290×2796 physical pixels
    isMobile: true,
    hasTouch: true,
  },
  {
    name: 'ipad-13',
    viewport: { width: 1024, height: 1366 },      // iPad 12.9" CSS pixels
    deviceScaleFactor: 2,                          // → 2048×2732 physical pixels
    isMobile: true,
    hasTouch: true,
  },
  {
    name: 'android-phone',
    viewport: { width: 412, height: 915 },        // Pixel 7 Pro CSS pixels
    deviceScaleFactor: 2.625,                     // → ≈1080×2400 physical pixels
    isMobile: true,
    hasTouch: true,
  },
];

// Pages à capturer — la liste reflète le parcours utilisateur "vendeur".
// Première et dernière screenshot ont le plus d'impact sur le taux de conversion.
const PAGES = [
  { slug: '01-login',         path: '/login',                                description: 'Écran de connexion redesigné' },
  { slug: '02-dashboard',     path: '/dashboard',                            description: 'Tableau de bord principal' },
  { slug: '03-pointage',      path: '/dashboard/pointage-du-mois',           description: 'Pointage du mois (calendrier coloré)' },
  { slug: '04-conges',        path: '/dashboard/gestion-de-conge',           description: 'Demandes de congé' },
  { slug: '05-frais',         path: '/dashboard/remboursement',              description: 'Notes de frais' },
  { slug: '06-team-cal',      path: '/dashboard/calendrier-equipe',          description: 'Calendrier d\'équipe (manager view)' },
  { slug: '07-vault',         path: '/dashboard/coffre-fort',                description: 'Coffre-fort documents RH' },
  { slug: '08-pricing',       path: '/',                                     description: 'Landing publique + pricing' },
];

async function login(page) {
  console.log(`  → login as ${REVIEWER_EMAIL}`);
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', REVIEWER_EMAIL);
  await page.fill('input[type="password"]', REVIEWER_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

async function captureProfile(profile) {
  console.log(`\n▶ Profil ${profile.name} (${profile.viewport.width}x${profile.viewport.height} @${profile.deviceScaleFactor}x)`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ...profile,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    colorScheme: 'light',
    // Masque la bannière cookies sur les pages publiques.
    storageState: undefined,
  });

  const page = await context.newPage();

  const outDir = resolve(OUT_DIR, profile.name);
  await mkdir(outDir, { recursive: true });

  // Login une seule fois — le cookie de session reste valable pour les pages /dashboard/*.
  await login(page);

  for (const p of PAGES) {
    console.log(`  → capture ${p.slug} (${p.path})`);
    await page.goto(`${BASE_URL}${p.path}`, { waitUntil: 'networkidle' });

    // Attend que les requêtes API liées au dashboard se terminent. Les composants
    // utilisent React Query avec staleTime 5min — on prend un délai conservateur
    // pour laisser le premier render arriver à un état stable.
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);

    // Ferme les bannières Cookie / TrialBanner qui couvriraient le hero shot.
    await page.evaluate(() => {
      document.querySelectorAll('[data-cy="cookie-banner"] button, [aria-label="close-trial-banner"]')
        .forEach((btn) => (btn).click());
    });
    await page.waitForTimeout(200);

    const file = resolve(outDir, `${p.slug}.png`);
    await page.screenshot({
      path: file,
      fullPage: false,
      omitBackground: false,
    });
  }

  await context.close();
  await browser.close();
}

(async () => {
  console.log(`📸 Capture screenshots store — BASE_URL=${BASE_URL}`);
  console.log(`   Sortie : ${OUT_DIR}\n`);

  for (const profile of PROFILES) {
    try {
      await captureProfile(profile);
    } catch (err) {
      console.error(`❌ Erreur sur profil ${profile.name}:`, err.message);
    }
  }

  console.log('\n✅ Terminé.');
  console.log(`   → uploadez les .png depuis ${OUT_DIR}/{iphone-6.7,ipad-13,android-phone}/`);
  console.log(`   → App Store Connect : iphone-6.7 + ipad-13`);
  console.log(`   → Play Console     : android-phone`);
})();
