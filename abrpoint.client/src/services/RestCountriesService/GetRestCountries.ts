import axios from 'axios';
import { RestCountry, RestCountryRaw } from '../../models/RestCountry';

const REST_COUNTRIES_URL =
  'https://restcountries.com/v3.1/all?fields=name,translations,cca2,cca3,flags,capital,region,subregion,population';

const restCountriesAxios = axios.create({ withCredentials: false });

const mapCountry = (raw: RestCountryRaw): RestCountry => ({
  cca2: raw.cca2,
  cca3: raw.cca3,
  nameCommon: raw.name?.common ?? '',
  nameFr: raw.translations?.fra?.common ?? raw.name?.common ?? '',
  flagPng: raw.flags?.png ?? '',
  flagSvg: raw.flags?.svg ?? '',
  flagAlt: raw.flags?.alt ?? raw.name?.common ?? '',
  capital: raw.capital?.[0] ?? '',
  region: raw.region ?? '',
  subregion: raw.subregion ?? '',
  population: raw.population ?? 0,
});

const getAll = async (): Promise<RestCountry[]> => {
  const { data } = await restCountriesAxios.get<RestCountryRaw[]>(REST_COUNTRIES_URL);
  return data
    .map(mapCountry)
    .sort((a, b) => a.nameFr.localeCompare(b.nameFr, 'fr'));
};

export default { getAll };
