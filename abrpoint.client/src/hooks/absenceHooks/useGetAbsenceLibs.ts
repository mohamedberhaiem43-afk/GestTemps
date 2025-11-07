import axios from "axios";
import { useQuery } from "react-query";

const useGetAbsencesLibs = () => {
    const soccod = sessionStorage.getItem('soccod');
    const token = localStorage.getItem('authToken');
    const headers = { Authorization: `Bearer ${token}` };
    
    return useQuery({
        queryKey: ["absences",soccod],
        queryFn: async () => {
            const response = await axios.get(
              `${import.meta.env.VITE_REACT_APP_API_URL}/Absences/get-libs/${soccod}`, 
              { headers }
            );
            return response.data; // Ensure this line returns the correct data.
          }
          
    })
    

}

export default useGetAbsencesLibs;