import axios from "axios";
import { useQuery } from "react-query";
import { useAuth } from "../../components/helper/AuthProvider";

const useGetTitreCongeById = (concod: string) => {
    const { soccod } = useAuth();
    const token = localStorage.getItem('authToken');
    const headers = { Authorization: `Bearer ${token}` };

    return useQuery({
        queryKey: ["conges", soccod, concod],
        queryFn: async () => {
            if (!soccod || !token) {
                throw new Error("Missing session or authentication data");
            }

            const response = await axios.get(
                `${import.meta.env.VITE_REACT_APP_API_URL}/Conges/${soccod}/${concod}`,
                { headers }
            );
            return response.data;
        },
        enabled: !!concod, // Ensure the query runs only if concod is available
    });
};

export default useGetTitreCongeById;
