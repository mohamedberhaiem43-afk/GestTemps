import axios from "axios";
import { useQuery } from "react-query";

const useGetAllAbsences = () => {
    const soccod = sessionStorage.getItem('soccod');
    const token = localStorage.getItem('authToken');
    const headers = { Authorization: `Bearer ${token}` };
    
    return useQuery({
        queryKey: ["all-absences",soccod],
        queryFn: async () => {
            const response = await axios.get(
              `${import.meta.env.VITE_REACT_APP_API_URL}/Absences/get-absence/${soccod}`, 
              { headers }
            );
            return response.data;
          }
          
    })
    

}

export default useGetAllAbsences;