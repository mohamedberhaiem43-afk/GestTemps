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
interface PageSeoProps {
  title: string;
  description: string;
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

export default function PageSeo({ title, description }: PageSeoProps) {
  useEffect(() => {
    document.title = title;
    upsertMeta('name', 'description', description);
    // Cohérence réseaux sociaux (la maquette index.html définit déjà ces balises).
    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', description);
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('name', 'twitter:description', description);
  }, [title, description]);

  return null;
}
