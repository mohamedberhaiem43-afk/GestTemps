import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../components/helper/AuthProvider";
import apiInstance from "../../components/API/apiInstance";

const useGetDemandeAutorisations = () => {
    // On choisit l'endpoint selon la VUE EFFECTIVE (isManagementView) et non `isEmp` brut :
    // un dual-rôle (employé + manager/RH/admin) en mode Gestion doit voir les demandes de SES
    // collaborateurs (get-all), pas seulement les siennes. En vue salarié (ou employé simple)
    // on reste sur le self-service (get-by-employe). Corrige « le manager ne voit pas les
    // autorisations de sortie de ses collaborateurs ».
    const { soccod, uticod, isManagementView } = useAuth();

    return useQuery({
        queryKey: ["demande-autorisations", soccod, uticod, isManagementView],
        queryFn: async () => {
            const endpoint = isManagementView
                ? `/DemandeAutorisations/get-all/${soccod}/${uticod}`
                : `/DemandeAutorisations/get-by-employe/${soccod}/${uticod}`;

            const response = await apiInstance.get(endpoint);
            return response.data;
        },
        enabled: !!soccod && !!uticod,
        refetchInterval: 30000,
        refetchOnWindowFocus: true,
        staleTime: 1000 * 60 * 2,
    });
};

export default useGetDemandeAutorisations;