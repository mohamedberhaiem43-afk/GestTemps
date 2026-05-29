/**
 * Devise d'affichage dérivée du pays souscrit par le tenant (Tenant.CountryCode, rempli au
 * signup et exposé via /Utilisateurs/me → useAuth().countryCode).
 *
 * Sert aux montants monétaires dépendant du pays (ex : indemnités du cahier de congé), qui
 * étaient auparavant figés sur « DT » (dinar tunisien) quel que soit le pays du client.
 *
 * Note : on renvoie le symbole/abréviation usuel (€, DH, DT, FCFA…), pas le code ISO 4217,
 * car c'est un libellé d'affichage à côté du montant.
 */
const CURRENCY_BY_COUNTRY: Record<string, string> = {
  // Zone euro
  FR: '€', BE: '€', DE: '€', ES: '€', IT: '€', PT: '€', NL: '€', LU: '€', IE: '€', AT: '€', FI: '€', GR: '€',
  // Maghreb
  MA: 'DH', TN: 'DT', DZ: 'DA', LY: 'LD', MR: 'MRU',
  // Franc CFA — UEMOA (XOF) & CEMAC (XAF), même symbole d'usage « FCFA »
  SN: 'FCFA', CI: 'FCFA', BJ: 'FCFA', BF: 'FCFA', ML: 'FCFA', NE: 'FCFA', TG: 'FCFA', GW: 'FCFA',
  CM: 'FCFA', GA: 'FCFA', CG: 'FCFA', TD: 'FCFA', CF: 'FCFA', GQ: 'FCFA',
  // Autres
  GB: '£', US: '$', CA: 'CAD', CH: 'CHF',
};

/**
 * Renvoie la devise d'affichage pour un code pays ISO-2. Repli sur « € » quand le pays est
 * inconnu/absent (la majorité des tenants étant en zone euro).
 */
export const currencyForCountry = (countryCode?: string | null): string => {
  if (!countryCode) return '€';
  return CURRENCY_BY_COUNTRY[countryCode.trim().toUpperCase()] ?? '€';
};
