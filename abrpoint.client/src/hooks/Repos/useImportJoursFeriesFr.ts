/**
 * Récupère les jours fériés français (métropole) pour une année donnée via l'API officielle
 * `https://calendrier.api.gouv.fr/jours-feries/metropole/{year}.json`.
 *
 * Réponse :
 *   { "2025-01-01": "1er janvier", "2025-04-21": "Lundi de Pâques", ... }
 *
 * Ce hook NE persiste rien : il transforme la réponse en lignes Ferier prêtes à être
 * envoyées via le hook d'ajout existant. Le composant qui l'appelle reste responsable
 * de la déduplication contre les jours déjà saisis et de la boucle d'insertion.
 */
import { Ferier } from '../../models/Ferier';

/**
 * Liste des dates fixes (mois-jour) en métropole — pour pré-cocher la case "fixe (annuel)".
 * Toutes les autres (Pâques/Ascension/Pentecôte) sont mobiles → ferfixe = "0".
 */
const FIXED_DATES = new Set<string>([
  '01-01', // 1er janvier
  '05-01', // Fête du Travail
  '05-08', // Victoire 1945
  '07-14', // Fête nationale
  '08-15', // Assomption
  '11-01', // Toussaint
  '11-11', // Armistice 1918
  '12-25', // Noël
]);

export interface FerieFromApi {
  date: string;          // ISO yyyy-mm-dd
  label: string;         // libellé renvoyé par l'API
  isFixed: boolean;      // true pour 1er janvier, 1er mai, 14 juillet, etc.
}

export const fetchJoursFeriesFr = async (year: number | string): Promise<FerieFromApi[]> => {
  const url = `https://calendrier.api.gouv.fr/jours-feries/metropole/${year}.json`;
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) throw new Error(`API jours fériés indisponible (HTTP ${res.status}).`);
  const data = (await res.json()) as Record<string, string>;
  return Object.entries(data).map(([date, label]) => {
    const mmdd = date.slice(5);
    return { date, label, isFixed: FIXED_DATES.has(mmdd) };
  });
};

/**
 * Construit une ligne Ferier complète pour la sauvegarde back-end.
 * Convention paramètres :
 *   - ferheure = 8h (journée pleine standard)
 *   - fertype  = 'F' (férié — pas un repos hebdomadaire)
 *   - fernpaye = '0' (payé : tous les fériés métropole sont payés sauf cas conventionnel)
 *   - ferfixe  = '1' si la date est fixe (mêmes mois-jour chaque année), '0' sinon (Pâques etc.)
 *   - fertrv   = ferdate + 1 jour (date de retour = lendemain du férié, contrainte back)
 *
 * Construction des dates : on passe par Date.UTC à midi UTC pour que la sérialisation JSON
 * (toISOString) conserve la date civile attendue quel que soit le fuseau du navigateur.
 * Sans ça, `new Date('2025-05-01T00:00:00')` était interprété comme minuit local et, en
 * UTC+1/+2, sérialisé en `2025-04-30T22:00:00Z` → le back-end enregistrait le 30 avril.
 */
export const toFerier = (item: FerieFromApi, soccod: string): Ferier => {
  const [yyyy, mm, dd] = item.date.split('-').map(Number);
  const ferdate = new Date(Date.UTC(yyyy, mm - 1, dd, 12, 0, 0));
  const fertrv = new Date(Date.UTC(yyyy, mm - 1, dd + 1, 12, 0, 0));
  return {
    soccod,
    annee: String(yyyy),
    fermotif: item.label,
    ferdate,
    fertrv,
    ferheure: 8,
    fertype: 'F',
    ferfixe: item.isFixed ? '1' : '0',
    fernpaye: '0',
  };
};
