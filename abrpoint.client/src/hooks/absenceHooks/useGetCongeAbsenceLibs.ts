import apiInstance from "../../components/API/apiInstance";
import { useQuery } from "@tanstack/react-query";

export interface CongeAbsenceLib {
    abscod: string;
    abslib: string;
    // 'R' = RTT (Réduction du Temps de Travail). Le composant de demande de congé
    // s'en sert pour cacher les types RTT aux employés non éligibles
    // (EmpRttMethode='N' ou null).
    abscng?: string;
}

const useGetCongeAbsenceLibs = () => {
    const soccod = sessionStorage.getItem('soccod');

    return useQuery<CongeAbsenceLib[]>({
        queryKey: ["congeAbsencesDetailed", soccod],
        queryFn: async () => {
            // Endpoint enrichi : renvoie [{abscod, abslib, abscng}]. L'ancien
            // /get-conge-libs (dict abscod→abslib) reste actif pour compat des
            // autres call-sites mais nous on a besoin de l'abscng pour filtrer RTT.
            const response = await apiInstance.get(
                `/Absences/get-conge-libs-detailed/${soccod}`
            );
            const data = response.data;
            if (Array.isArray(data)) return data as CongeAbsenceLib[];
            // Fallback si le serveur n'a pas encore la version avec endpoint détaillé :
            // on convertit l'ancien dict abscod→abslib (abscng inconnu).
            if (data && typeof data === 'object') {
                return Object.entries(data).map(([abscod, abslib]) => ({
                    abscod,
                    abslib: String(abslib),
                }));
            }
            return [];
        }
    });
}

export default useGetCongeAbsenceLibs;
