import { Section } from "jspdf-autotable";
// SEC/PERF — Centralisation sur apiInstance (cf. GetFonctions.ts).
import apiInstance from '../../components/API/apiInstance';

// Lecture lazy de soccod : évite l'URL `Sections/null` au boot quand l'auth
// n'a pas encore rempli sessionStorage.
export default {
  getAll: async (): Promise<Section[]> => {
    const soccod = sessionStorage.getItem('soccod');
    if (!soccod || soccod === 'null') return [];
    const res = await apiInstance.get<Section[]>(`Sections/${soccod}`);
    return res.data;
  },
};