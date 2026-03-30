import apiInstance from "../../components/API/apiInstance";
import { useQuery } from "react-query";

const useGetAbsencesLibs = () => {
    const soccod = sessionStorage.getItem('soccod');

    return useQuery({
        queryKey: ["absences",soccod],
        queryFn: async () => {
            const response = await apiInstance.get(
              `/Absences/get-libs/${soccod}`
            );
            return response.data; // Ensure this line returns the correct data.
          }

    })


}

export default useGetAbsencesLibs;