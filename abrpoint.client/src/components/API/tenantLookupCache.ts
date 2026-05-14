import apiInstance from './apiInstance';

/**
 * Cache mémoire (durée de vie : session) pour /api/auth/lookup-tenant.
 *
 * Pourquoi : l'endpoint est touché à chaque tentative de login (Login.tsx ET
 * InlineAuthCard.tsx) et derrière un NAT d'entreprise / un essai à 3-4 tentatives
 * de login avec mauvais mot de passe, on saturait la quota 5/h/IP (anciennement)
 * et donnait des 429 « spurieux » à l'utilisateur (cf. ticket 2026-05-14).
 *
 * Le serveur a été relâché à 30/h/IP (policy "tenant-lookup"), mais c'est inutile
 * de re-faire l'aller-retour pour le même email entre deux tentatives consécutives.
 *
 * TTL court (5 min) : si l'utilisateur change vraiment de tenant (rare en pratique),
 * la lookup est refaite après expiration. Pas de stockage localStorage volontairement —
 * on ne veut pas mémoriser des emails entre les sessions de plusieurs utilisateurs
 * sur un poste partagé.
 */

const TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { slug: string | null; expiresAt: number }>();

function normalize(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Lookup avec mémoïsation. Retourne le slug du tenant pour cet email ou null si
 * aucun compte n'est trouvé. Sur 429 / réseau / autre erreur, on ne met PAS en
 * cache (on laisse le caller décider de la suite — afficher le bon message).
 */
export async function lookupTenantCached(email: string): Promise<string | null> {
  const key = normalize(email);
  if (!key || !key.includes('@')) return null;

  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.slug;
  }

  const res = await apiInstance.post('/auth/lookup-tenant', { email: key });
  const slug: string | null = res.data?.slug ?? null;
  cache.set(key, { slug, expiresAt: Date.now() + TTL_MS });
  return slug;
}

/** Invalide le cache (ex: après une réinitialisation de mot de passe ou un signup). */
export function clearTenantLookupCache(): void {
  cache.clear();
}
