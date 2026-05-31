/**
 * Noms de pays (français) par countryCode ISO-3166 alpha-2, pour les libellés qui dépendent du
 * pays souscrit par le tenant (ex. bouton d'import des jours fériés en gestion des repos/fériés).
 * Source unique afin de ne plus figer « France » en dur dans l'UI. Le countryCode provient de
 * `/Utilisateurs/me` (cf. AuthProvider.countryCode).
 */
export const COUNTRY_NAMES: Record<string, string> = {
  FR: 'France', BE: 'Belgique', CH: 'Suisse', LU: 'Luxembourg', DE: 'Allemagne',
  ES: 'Espagne', IT: 'Italie', PT: 'Portugal', GB: 'Royaume-Uni', NL: 'Pays-Bas',
  MA: 'Maroc', DZ: 'Algérie', TN: 'Tunisie', SN: 'Sénégal', CI: "Côte d'Ivoire",
  CA: 'Canada', US: 'États-Unis',
};

/**
 * Nom du pays correspondant à un countryCode. Pays inconnu mais code fourni → le code brut ;
 * code absent/null → `fallback` (défaut « France », pour rester cohérent avec la source par
 * défaut côté backend pendant la fenêtre de chargement de /me).
 */
export function countryNameFor(countryCode?: string | null, fallback = 'France'): string {
  if (!countryCode) return fallback;
  const code = countryCode.trim().toUpperCase();
  return COUNTRY_NAMES[code] ?? code;
}
