import axios from "axios";
import { useQuery } from "react-query";
import { useAuth } from "../../components/helper/AuthProvider";

const useGetDemConges = () => {
    const uticod = localStorage.getItem('Uticod');
    const { soccod } = useAuth();
    const token = localStorage.getItem('authToken');
    const headers = { Authorization: `Bearer ${token}` };

    return useQuery({
        queryKey: ["demconges",soccod,uticod],
        queryFn: async () => {
            const response = await axios.get(
                `${import.meta.env.VITE_REACT_APP_API_URL}/DemConges/get-demconge/${soccod}/${uticod}`,
                { headers }
            );
            return response.data;
        }
    })
    

}

export default useGetDemConges;