/**
 * Construit l'URL complète d'un asset uploadé (photo de profil, logo société…).
 *
 * Pourquoi ce helper :
 *   - `VITE_REACT_APP_API_URL` se termine par `/api` (ex: `/api` en prod, `https://host:7189/api` en dev).
 *   - `FileHelper.SaveFile` côté backend persiste les chemins préfixés `/api/uploads/<file>`.
 *   - Une simple concaténation `BASE_URL + stored` produit `/api/api/uploads/...` → 404.
 *
 * Le helper ci-dessous tolère les deux formats (`/api/uploads/...` legacy et `/uploads/...` futur)
 * et renvoie une URL exploitable dans `<img src>` aussi bien en dev qu'en prod.
 */
export function resolveAssetUrl(stored: string | null | undefined): string {
  if (!stored) return '';
  // URL absolue (http://, https://, data:) : rien à faire.
  if (/^(https?:|data:)/i.test(stored)) return stored;

  const base = (import.meta.env.VITE_REACT_APP_API_URL as string | undefined) || '';

  // Si le chemin stocké inclut déjà `/api/...`, on retire le suffixe `/api` de la base
  // pour éviter le doublon. Cas typique : valeur legacy retournée par FileHelper.SaveFile.
  if (stored.startsWith('/api/')) {
    const origin = base.replace(/\/api\/?$/, '');
    return origin + stored;
  }

  // Chemin relatif sans préfixe (`/uploads/foo.png`) : on préfixe par la base API complète.
  return base + stored;
}
