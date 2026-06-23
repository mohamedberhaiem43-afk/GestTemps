import { RestCountry } from '../../models/RestCountry';
import { COUNTRIES_DATA, CountryDatum } from './countriesData';

// ─────────────────────────────────────────────────────────────────────────────
// Source des pays : liste statique embarquée (countriesData.ts) — PLUS d'appel à
// restcountries.com. L'API v3.1 a été dépréciée (réponse d'erreur + redirection
// qui casse le preflight CORS du navigateur), ce qui vidait toutes les listes de
// pays de l'app (fiche employé, signup, base de données Pays).
// Les drapeaux restent servis à la demande par flagcdn.com via les <img> des
// composants : l'affichage d'une image n'est pas soumis à la politique CORS, donc
// aucune dépendance réseau bloquante ne subsiste pour peupler la liste.
// ─────────────────────────────────────────────────────────────────────────────

const FLAG_BASE = 'https://flagcdn.com';

const mapCountry = (c: CountryDatum): RestCountry => {
  const code = c.cca2.toLowerCase();
  return {
    cca2: c.cca2,
    cca3: c.cca3,
    nameCommon: c.nameCommon,
    nameFr: c.nameFr,
    flagPng: `${FLAG_BASE}/w80/${code}.png`,
    flagSvg: `${FLAG_BASE}/${code}.svg`,
    flagAlt: c.nameFr,
    capital: '',
    region: '',
    subregion: '',
    population: 0,
  };
};

// Conserve une signature asynchrone : useGetRestCountries (react-query) l'utilise
// comme queryFn et le reste de l'app n'a pas à changer.
const getAll = async (): Promise<RestCountry[]> =>
  COUNTRIES_DATA.map(mapCountry).sort((a, b) => a.nameFr.localeCompare(b.nameFr, 'fr'));

export default { getAll };
