import { useQuery } from "react-query";
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
        enabled: !!soccod && !!uticod
    })
};

export default useGetDemConges;
