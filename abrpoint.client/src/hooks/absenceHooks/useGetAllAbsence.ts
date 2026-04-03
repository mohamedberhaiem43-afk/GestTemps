import apiInstance from "../../components/API/apiInstance";
import { useQuery } from "react-query";

const useGetAllAbsences = () => {
    const soccod = sessionStorage.getItem('soccod');

    return useQuery({
        queryKey: ["all-absences",soccod],
        queryFn: async () => {
            const response = await apiInstance.get(
              `/Absences/get-absence/${soccod}`
            );
            return response.data;
          }

    })


}

export default useGetAllAbsences;