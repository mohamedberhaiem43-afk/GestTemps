import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../components/helper/AuthProvider";
import apiInstance from "../../components/API/apiInstance";

const useGetDemConges = () => {
    const { soccod, uticod, isEmp } = useAuth();

    return useQuery({
        queryKey: ["demconges", soccod, uticod, isEmp],
        queryFn: async () => {
            const endpoint = isEmp
                ? `/DemConges/get-emp-demconge/${soccod}/${uticod}`
                : `/DemConges/get-demconge/${soccod}/${uticod}`;

            const response = await apiInstance.get(endpoint);
            return response.data;
        },
        enabled: !!soccod && !!uticod,
        refetchInterval: 30000, // Refetch every 30 seconds for real-time notifications
        refetchOnWindowFocus: true,
        // Toujours refetch au montage : la liste des demandes alimente les KPI du solde
        // (jours pris / acceptés). Sans ça, après acceptation d'un congé sur un autre
        // écran, revenir sur le solde resservait une liste en cache (jusqu'à 2 min).
        refetchOnMount: 'always',
        staleTime: 0,
    })
};

export default useGetDemConges;
