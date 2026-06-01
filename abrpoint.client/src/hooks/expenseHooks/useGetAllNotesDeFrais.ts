import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../components/helper/AuthProvider";
import NoteDeFraisService from "../../services/NoteDeFraisService";

const useGetAllNotesDeFrais = () => {
    // Liste de GESTION (toutes les notes de frais de la société). Activée en vue de gestion —
    // `isManagementView` couvre le dual-rôle (employé + manager/RH/admin) en mode Gestion, là
    // où l'ancien garde `!isEmp` la vidait pour tout utilisateur ayant une fiche employé.
    const { soccod, isManagementView } = useAuth();

    return useQuery({
        queryKey: ["allNotesDeFrais", soccod, isManagementView],
        queryFn: async () => {
            if (!isManagementView) return [];
            return await NoteDeFraisService.getBySoc(soccod || '');
        },
        enabled: !!soccod && isManagementView,
        refetchInterval: 30000, // Refetch every 30 seconds for real-time notifications
        refetchOnWindowFocus: true,
        staleTime: 1000 * 60 * 2, // 2 minutes stale time
    });
};

export default useGetAllNotesDeFrais;