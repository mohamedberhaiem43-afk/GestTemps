import { Section } from "jspdf-autotable";
import axios from 'axios';

// Lecture lazy de soccod (cf. GetSectionsLibs.ts pour les détails). Évite
// l'URL `Sections/null` au boot quand l'auth n'a pas encore rempli sessionStorage.
const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_REACT_APP_API_URL,
  withCredentials: true,
});

export default {
  getAll: async (): Promise<Section[]> => {
    const soccod = sessionStorage.getItem('soccod');
    if (!soccod || soccod === 'null') return [];
    const res = await axiosInstance.get<Section[]>(`Sections/${soccod}`);
    return res.data;
  },
};