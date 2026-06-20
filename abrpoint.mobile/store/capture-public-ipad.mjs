#!/usr/bin/env node
/**
 * Capture des pages PUBLIQUES (sans authentification) au format iPad App Store.
 *
 * Contrairement à capture-screenshots.mjs (qui se connecte avec un compte
 * reviewer), ce script ne capture que ce qui est accessible sans login :
 *   - /login   → l'écran de connexion de l'app (vrai écran applicatif)
 *   - /        → la landing publique
 *
 * Pourquoi : sans identifiants du tenant de démo (stockés en password manager,
 * pas dans le repo) et sans environnement de staging, les écrans authentifiés
 * (dashboard, pointage, congés…) ne sont pas capturables automatiquement.
 *
 * Sortie : ./store/screenshots/ipad-public/<size>/<page>.png
 * Tailles : 2048x2732 (iPad 12.9") et 2064x2752 (iPad 13" M4) — toutes deux
 * acceptées par App Store Connect pour le slot "iPad 13"/12.9" Displays".
 *
 * Usage :
 *   BASE_URL=https://concorde-work-force.com node store/capture-public-ipad.mjs
 */

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_URL = (process.env.BASE_URL ?? 'https://concorde-work-force.com').replace(/\/$/, '');
const OUT_DIR = resolve(__dirname, 'screenshots', 'ipad-public');

// Deux tailles iPad portrait acceptées par App Store Connect. CSS = physique / 2.
const SIZES = [
  { name: '2048x2732', viewport: { width: 1024, height: 1366 } }, // iPad 12.9"
  { name: '2064x2752', viewport: { width: 1032, height: 1376 } }, // iPad 13" (M4)
];

const PAGES = [
  { slug: '01-login', path: '/login', waitFor: 'input[type="email"], input[type="password"]' },
  { slug: '02-landing', path: '/', waitFor: null },
];

async function dismissBanners(page) {
  // Bannières cookie / RGPD / trial qui couvriraient le hero shot — best effort.
  await page.evaluate(() => {
    const sels = [
      '[data-cy="cookie-banner"] button',
      '[aria-label="close-trial-banner"]',
      'button[aria-label*="accept" i]',
      'button[aria-label*="accepter" i]',
    ];
    for (const sel of sels) document.querySelectorAll(sel).forEach((b) => b.click());
    // Texte FR/EN courant des boutons de consentement.
    for (const b of Array.from(document.querySelectorAll('button'))) {
      const t = (b.textContent || '').trim().toLowerCase();
      if (['accepter', 'tout accepter', 'accept', 'accept all', "j'accepte"].includes(t)) b.click();
    }
  }).catch(() => {});
}

async function captureSize(browser, size) {
  console.log(`\n▶ ${size.name} (CSS ${size.viewport.width}x${size.viewport.height} @2x)`);
  const context = await browser.newContext({
    viewport: size.viewport,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    colorScheme: 'light',
  });
  const page = await context.newPage();
  const outDir = resolve(OUT_DIR, size.name);
  await mkdir(outDir, { recursive: true });

  for (const p of PAGES) {
    const url = `${BASE_URL}${p.path}`;
    process.stdout.write(`  → ${p.slug} (${url}) ... `);
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 45_000 });
      if (p.waitFor) {
        await page.waitForSelector(p.waitFor, { timeout: 15_000 }).catch(() => {});
      }
      await dismissBanners(page);
      await page.waitForTimeout(1200); // laisse fonts/images/animations se stabiliser
      const file = resolve(outDir, `${p.slug}.png`);
      await page.screenshot({ path: file, fullPage: false });
      console.log('OK');
    } catch (err) {
      console.log(`ÉCHEC: ${err.message}`);
    }
  }
  await context.close();
}

(async () => {
  console.log(`📸 Capture pages publiques iPad — BASE_URL=${BASE_URL}`);
  console.log(`   Sortie : ${OUT_DIR}`);
  const browser = await chromium.launch({ headless: true });
  try {
    for (const size of SIZES) await captureSize(browser, size);
  } finally {
    await browser.close();
  }
  console.log('\n✅ Terminé.');
})();
