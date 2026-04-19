import { useQuery } from "react-query";
import { useAuth } from "../../components/helper/AuthProvider";
import apiInstance from "../../components/API/apiInstance";

const useGetDemandeAutorisations = () => {
    const { soccod, uticod, isEmp } = useAuth();

    return useQuery({
        queryKey: ["demande-autorisations", soccod, uticod, isEmp],
        queryFn: async () => {
            const endpoint = isEmp
                ? `/DemandeAutorisations/get-by-employe/${soccod}/${uticod}`
                : `/DemandeAutorisations/get-all/${soccod}/${uticod}`;

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