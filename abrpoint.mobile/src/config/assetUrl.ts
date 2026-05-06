import { API_BASE_URL } from './env';

/**
 * Construit l'URL complète d'un asset uploadé (photo de profil, logo société…)
 * pour l'app mobile.
 *
 * Pourquoi ce helper :
 *   - `API_BASE_URL` se termine par `/api` (ex: `https://concorde-work-force.com/api`).
 *   - `FileHelper.SaveFile` côté backend persiste les chemins préfixés `/api/uploads/<file>`.
 *   - Une simple concaténation `BASE_URL + stored` produit `/api/api/uploads/...` → 404.
 *
 * Le helper tolère les deux formats (`/api/uploads/...` et `/uploads/...`) et
 * renvoie une URL exploitable directement dans `<Image source={{ uri }} />`.
 *
 * Pendant pour l'app web (cf. abrpoint.client/src/helpers/assetUrl.ts).
 */
export function resolveAssetUrl(stored: string | null | undefined): string {
  if (!stored) return '';
  // URL absolue (http://, https://, data:) : rien à faire.
  if (/^(https?:|data:)/i.test(stored)) return stored;

  if (stored.startsWith('/api/')) {
    const origin = API_BASE_URL.replace(/\/api\/?$/, '');
    return origin + stored;
  }

  return API_BASE_URL + stored;
}
