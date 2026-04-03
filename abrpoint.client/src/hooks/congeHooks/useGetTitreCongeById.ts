import apiInstance from "../../components/API/apiInstance";
import { useQuery } from "react-query";
import { useAuth } from "../../components/helper/AuthProvider";

const useGetTitreCongeById = (concod: string) => {
    const { soccod } = useAuth();

    return useQuery({
        queryKey: ["conges", soccod, concod],
        queryFn: async () => {
            if (!soccod) {
                throw new Error("Missing session or authentication data");
            }

            const response = await apiInstance.get(
                `/Conges/${soccod}/${concod}`
            );
            return response.data;
        },
        enabled: !!concod, // Ensure the query runs only if concod is available
    });
};

export default useGetTitreCongeById;
