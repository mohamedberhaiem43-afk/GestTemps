import * as SecureStore from 'expo-secure-store';

/**
 * Cache offline minimaliste pour donner une expérience gracieuse quand l'app est ouverte
 * sans réseau (ex: avion, métro, mauvaise couverture). On stocke un snapshot JSON+TTL et on
 * sert la version cachée si l'API échoue.
 *
 * On utilise SecureStore (déjà dans les deps Expo) plutôt que d'ajouter AsyncStorage —
 * la limite ~2 KB par clé sur iOS est largement suffisante pour today-status + KPIs.
 *
 * Préfixe `cache_` pour ne pas collisionner avec auth_token / refresh_token / tenant_slug.
 */

const PREFIX = 'cache_';

interface CachedEntry<T> {
  v: T;          // valeur
  t: number;     // timestamp ms à l'écriture
}

export async function readCache<T>(key: string, maxAgeMs?: number): Promise<T | null> {
  try {
    const raw = await SecureStore.getItemAsync(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedEntry<T>;
    if (maxAgeMs && Date.now() - parsed.t > maxAgeMs) return null;
    return parsed.v;
  } catch {
    return null;
  }
}

export async function writeCache<T>(key: string, value: T): Promise<void> {
  try {
    const entry: CachedEntry<T> = { v: value, t: Date.now() };
    await SecureStore.setItemAsync(PREFIX + key, JSON.stringify(entry));
  } catch {
    // Fail silently : le cache est best-effort.
  }
}

export async function removeCache(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(PREFIX + key);
  } catch { /* noop */ }
}

/**
 * Wrap un appel async : exécute `fetcher`, si succès met en cache et renvoie le résultat ;
 * si échec, tente de lire le cache et le renvoie (avec un flag `fromCache`).
 */
export async function withCacheFallback<T>(
  key: string,
  fetcher: () => Promise<T>
): Promise<{ data: T | null; fromCache: boolean }> {
  try {
    const data = await fetcher();
    await writeCache(key, data);
    return { data, fromCache: false };
  } catch (err) {
    const cached = await readCache<T>(key);
    if (cached !== null) return { data: cached, fromCache: true };
    throw err;
  }
}
