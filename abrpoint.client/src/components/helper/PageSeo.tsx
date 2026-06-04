import { useEffect } from 'react';

/**
 * Balises SEO par route pour la SPA (Vite — pas de SSR, donc pas de Helmet/Metadata API).
 *
 * Met à jour côté client `document.title` + `<meta name="description">` (et, par
 * cohérence, og:title/og:description/twitter:*), en créant la balise si elle n'existe
 * pas encore. Chaque page publique rend son propre <PageSeo> → titres/descriptions
 * UNIQUES (pas de title global identique partout).
 *
 * Googlebot exécute le JS et indexe le DOM rendu : ces balises sont donc bien prises en
 * compte. NB : le HTML *initial* (index.html) garde le title par défaut jusqu'à
 * l'hydratation. Si un rendu 100 % statique au 1er byte devient nécessaire (autres
 * crawlers, partage social sans exécution JS), il faudra un prerender au build
 * (vite-plugin-ssg / prerender) — non requis pour l'indexation Google.
 */
const SITE_ORIGIN = 'https://concorde-work-force.com';

interface PageSeoProps {
  title: string;
  description: string;
  /**
   * La page possède une vraie version anglaise sous /en. true (défaut) → émet les
   * alternates hreflang fr/en/x-default. false → page FR uniquement (aucun
   * hreflang `en` trompeur ; canonical seul).
   */
  bilingual?: boolean;
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function upsertAlternate(hreflang: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="alternate"][hreflang="${hreflang}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'alternate');
    el.setAttribute('hreflang', hreflang);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

export default function PageSeo({ title, description, bilingual = true }: PageSeoProps) {
  useEffect(() => {
    document.title = title;
    upsertMeta('name', 'description', description);
    // Cohérence réseaux sociaux (la maquette index.html définit déjà ces balises).
    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', description);
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('name', 'twitter:description', description);

    // Canonical + og:url + hreflang dérivés de l'URL RÉELLE. Le préfixe /en
    // identifie la version anglaise ; la version FR est l'URL sans /en.
    const raw = window.location.pathname.replace(/\/+$/, '') || '/';
    const isEn = raw === '/en' || raw.startsWith('/en/');
    const base = isEn ? (raw === '/en' ? '/' : raw.slice(3)) : raw; // chemin FR équivalent
    const frUrl = SITE_ORIGIN + base;
    const enUrl = SITE_ORIGIN + (base === '/' ? '/en' : '/en' + base);
    const canonical = SITE_ORIGIN + raw;
    upsertLink('canonical', canonical);
    upsertMeta('property', 'og:url', canonical);
    upsertMeta('property', 'og:locale', isEn ? 'en_US' : 'fr_FR');
    // Alternates bilingues (FR/EN) + x-default → FR. Émis uniquement si une vraie
    // version anglaise existe, pour ne pas déclarer un hreflang `en` vers une URL morte.
    if (bilingual) {
      upsertAlternate('fr', frUrl);
      upsertAlternate('en', enUrl);
      upsertAlternate('x-default', frUrl);
    }
  }, [title, description, bilingual]);

  return null;
}
