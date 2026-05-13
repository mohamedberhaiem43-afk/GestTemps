import { FonctionModel } from "../../models/Fonction";
// SEC/PERF — Utiliser l'apiInstance singleton (cf. components/API/apiInstance.ts) :
//   - garantit l'injection du header X-Tenant-Slug sur chaque requête ;
//   - hérite de l'interceptor de refresh-token coalescé ;
//   - évite la duplication d'instance axios (memory + état d'interceptors fragile).
// Avant : axios.create() local qui dépendait du monkey-patch global pour le tenant
// header — ordre d'import fragile, et pas de refresh 401 propagé.
import apiInstance from '../../components/API/apiInstance';

// Lecture lazy de soccod : empêche l'appel `Fonctions/null` au tout début du
// chargement quand l'auth n'a pas encore peuplé sessionStorage.
export default {
  getAll: async (): Promise<FonctionModel[]> => {
    const soccod = sessionStorage.getItem('soccod');
    if (!soccod || soccod === 'null') return [];
    const res = await apiInstance.get<FonctionModel[]>(`Fonctions/${soccod}`);
    return res.data;
  },
};