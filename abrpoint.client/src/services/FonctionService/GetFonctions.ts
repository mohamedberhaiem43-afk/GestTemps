import { FonctionModel } from "../../models/Fonction";
import axios from 'axios';

// Lecture lazy de soccod (cf. GetSectionsLibs.ts). Empêche l'appel `Fonctions/null`
// au tout début du chargement quand l'auth n'a pas encore peuplé sessionStorage.
const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_REACT_APP_API_URL,
  withCredentials: true,
});

export default {
  getAll: async (): Promise<FonctionModel[]> => {
    const soccod = sessionStorage.getItem('soccod');
    if (!soccod || soccod === 'null') return [];
    const res = await axiosInstance.get<FonctionModel[]>(`Fonctions/${soccod}`);
    return res.data;
  },
};