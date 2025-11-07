import axios from "axios";
import { useQuery } from "react-query";
import { useAuth } from "../../components/helper/AuthProvider";

const useGetEmployee = () => {
    const { soccod } = useAuth();
    const token = localStorage.getItem('authToken');
    const headers = { Authorization: `Bearer ${token}` };
    const uticod = localStorage.getItem('Uticod');
    
    return useQuery({
        queryKey: ["employes",soccod,uticod],
        queryFn: async () => {
            const response =  await axios.get
            (
                `${import.meta.env.VITE_REACT_APP_API_URL}/Employes/get-libs/${soccod}/${uticod}`, 
                { headers }
            )
            return response.data;   
        }
    })
    

}

export default useGetEmployee;