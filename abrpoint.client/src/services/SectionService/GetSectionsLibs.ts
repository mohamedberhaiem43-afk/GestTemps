// SEC/PERF — Centralisation sur apiInstance (cf. GetFonctions.ts).
import apiInstance from '../../components/API/apiInstance';

// ⚠ Lecture LAZY de soccod : avant on faisait `sessionStorage.getItem('soccod')`
// au module load → si le module se chargeait avant que l'auth ait rempli la
// sessionStorage, l'URL devenait `Sections/get-seclibs/null` → 403 (le validateur
// soccod refuse le littéral "null"). Maintenant on récupère soccod au moment
// de l'appel HTTP et on bypasse silencieusement quand absent (l'écran qui
// consomme ce hook doit déjà gérer "pas de données").
export default {
  getAll: async (): Promise<Record<string, string>> => {
    const soccod = sessionStorage.getItem('soccod');
    if (!soccod || soccod === 'null') return {};
    const res = await apiInstance.get<Record<string, string>>(`Sections/get-seclibs/${soccod}`);
    return res.data;
  },
};