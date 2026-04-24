import apiInstance from "../../components/API/apiInstance";
import { useQuery } from "react-query";

const useGetAutorisationLibs = () => {
    const soccod = sessionStorage.getItem('soccod');

    return useQuery({
        queryKey: ["autorisation-libs", soccod],
        queryFn: async () => {
            const response = await apiInstance.get(
              `/Absences/get-autorisations-libs/${soccod}`
            );
            return response.data;
        },
        enabled: !!soccod
    });
}

export default useGetAutorisationLibs;
