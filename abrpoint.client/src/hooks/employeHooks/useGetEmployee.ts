import axios from "axios";
import { useQuery } from "react-query";

const useGetEmployee = () => {
    const soccod = sessionStorage.getItem('soccod');
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