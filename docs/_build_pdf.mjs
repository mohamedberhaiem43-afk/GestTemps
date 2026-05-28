// Script one-shot pour convertir docs/RAPPORT_FORMATION.md → PDF.
// Étapes :
//   1) Lecture du Markdown.
//   2) Conversion via `marked` (importé en runtime via npx).
//   3) Wrap dans un template HTML stylé pour impression A4.
//   4) Écriture HTML temporaire.
//   5) Appel à msedge --headless pour rendre en PDF.
//   6) Nettoyage du HTML temporaire.
//
// Usage : node _build_pdf.mjs

import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Nom du fichier source passé en argument (sans extension), défaut RAPPORT_FORMATION.
// Usage : node _build_pdf.mjs GUIDE_UTILISATEUR
const baseName = process.argv[2] || 'RAPPORT_FORMATION';
const mdPath = resolve(__dirname, `${baseName}.md`);
const htmlPath = resolve(__dirname, '_rapport_tmp.html');
const pdfPath = resolve(__dirname, `${baseName}.pdf`);

console.log('→ Lecture du Markdown…');
const md = readFileSync(mdPath, 'utf-8');

console.log('→ Conversion en HTML…');
// gfm + tables activés par défaut dans marked v9+.
const bodyHtml = marked.parse(md);

// Template HTML print-friendly. CSS inline pour que msedge n'aille pas chercher
// de ressources externes (offline-safe). Police système — pas de webfont (qui
// nécessiterait un GET réseau au moment de l'impression).
const fullHtml = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Rapport de formation — Concorde Workforce</title>
<style>
  @page {
    size: A4;
    margin: 18mm 16mm 22mm 16mm;
    @bottom-center {
      content: "Concorde Workforce — Rapport de formation — Page " counter(page) " / " counter(pages);
      font-family: 'Segoe UI', system-ui, sans-serif;
      font-size: 9pt;
      color: #64748b;
    }
  }
  * { box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    font-size: 10.5pt;
    line-height: 1.5;
    color: #0f172a;
    margin: 0;
    padding: 0;
  }
  h1 {
    color: #0040a1;
    border-bottom: 3px solid #0040a1;
    padding-bottom: 8px;
    margin: 30px 0 16px;
    font-size: 22pt;
    page-break-before: always;
  }
  h1:first-of-type { page-break-before: avoid; }
  h2 {
    color: #0040a1;
    border-bottom: 1px solid #cbd5e1;
    padding-bottom: 4px;
    margin: 24px 0 12px;
    font-size: 15pt;
    page-break-after: avoid;
  }
  h3 {
    color: #1e293b;
    margin: 18px 0 8px;
    font-size: 12.5pt;
    page-break-after: avoid;
  }
  h4 {
    color: #334155;
    margin: 14px 0 6px;
    font-size: 11pt;
    page-break-after: avoid;
  }
  p { margin: 6px 0 10px; }
  ul, ol { margin: 6px 0 10px; padding-left: 22px; }
  li { margin: 2px 0; }
  strong { color: #0f172a; font-weight: 700; }
  em { color: #475569; }
  hr {
    border: none;
    border-top: 1px solid #e2e8f0;
    margin: 18px 0;
  }
  blockquote {
    margin: 10px 0;
    padding: 10px 14px;
    background: #f0f6ff;
    border-left: 3px solid #0040a1;
    color: #1e293b;
    font-size: 10pt;
    page-break-inside: avoid;
  }
  code {
    background: #f1f5f9;
    color: #0f172a;
    padding: 1px 5px;
    border-radius: 3px;
    font-family: 'Consolas', 'Courier New', monospace;
    font-size: 9.5pt;
  }
  pre {
    background: #0f172a;
    color: #e2e8f0;
    padding: 12px;
    border-radius: 6px;
    overflow-x: auto;
    font-size: 9pt;
  }
  pre code {
    background: transparent;
    color: inherit;
    padding: 0;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 10px 0 14px;
    font-size: 9.5pt;
    page-break-inside: auto;
  }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  th, td {
    border: 1px solid #cbd5e1;
    padding: 5px 8px;
    text-align: left;
    vertical-align: top;
  }
  th {
    background: #0040a1;
    color: #fff;
    font-weight: 700;
    font-size: 9.5pt;
  }
  tbody tr:nth-child(even) { background: #f8fafc; }
  /* Captures intégrées dans les cellules de tableau (rapport §12).
     max-width:100% : la capture se contraint à la largeur de la cellule.
     border + radius : démarcation visuelle d'un screenshot.
     page-break-inside:avoid via tr déjà déclaré au-dessus. */
  td img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 4px 0;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    background: #fff;
  }
  a {
    color: #0040a1;
    text-decoration: none;
  }
  /* Page de garde — premier h1 sans page break avant, centré */
  body > h1:first-of-type {
    text-align: left;
    font-size: 26pt;
    margin-top: 0;
  }
  /* Évite que les sections de tableaux soient coupées au milieu d'une ligne */
  .keep-together { page-break-inside: avoid; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;

console.log('→ Écriture HTML temporaire…');
writeFileSync(htmlPath, fullHtml, 'utf-8');

console.log('→ Appel msedge --headless --print-to-pdf…');
const edgeExe = `"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"`;
// --no-pdf-header-footer : on désactive l'header/footer par défaut d'Edge (URL,
// date) — on a déjà défini un footer custom via @page CSS.
// --disable-gpu : recommandé en mode headless.
// file:// URL : Edge accepte file:/// pour charger un HTML local.
const fileUrl = `file:///${htmlPath.replace(/\\/g, '/')}`;
const cmd = `${edgeExe} --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="${pdfPath}" "${fileUrl}"`;
execSync(cmd, { stdio: 'inherit' });

console.log('→ Nettoyage HTML temporaire…');
if (existsSync(htmlPath)) unlinkSync(htmlPath);

console.log(`✓ PDF généré : ${pdfPath}`);
