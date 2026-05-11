import axios from 'axios';

// ⚠ Lecture LAZY de soccod : avant on faisait `sessionStorage.getItem('soccod')`
// au module load → si le module se chargeait avant que l'auth ait remplit la
// sessionStorage, l'URL devenait `Sections/get-seclibs/null` → 403 (le validateur
// soccod refuse le littéral "null"). Maintenant on récupère soccod au moment
// de l'appel HTTP et on bypasse silencieusement quand absent (l'écran qui
// consomme ce hook doit déjà gérer "pas de données").
const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_REACT_APP_API_URL,
  withCredentials: true,
});

export default {
  getAll: async (): Promise<Record<string, string>> => {
    const soccod = sessionStorage.getItem('soccod');
    if (!soccod || soccod === 'null') return {};
    const res = await axiosInstance.get<Record<string, string>>(`Sections/get-seclibs/${soccod}`);
    return res.data;
  },
};