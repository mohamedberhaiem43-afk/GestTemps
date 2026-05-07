export type RestCountryRaw = {
  name: { common: string; official: string };
  translations?: Record<string, { common: string; official: string }>;
  cca2: string;
  cca3: string;
  flags: { png: string; svg: string; alt?: string };
  capital?: string[];
  region: string;
  subregion?: string;
  population?: number;
};

export type RestCountry = {
  cca2: string;
  cca3: string;
  nameCommon: string;
  nameFr: string;
  flagPng: string;
  flagSvg: string;
  flagAlt: string;
  capital: string;
  region: string;
  subregion: string;
  population: number;
};
