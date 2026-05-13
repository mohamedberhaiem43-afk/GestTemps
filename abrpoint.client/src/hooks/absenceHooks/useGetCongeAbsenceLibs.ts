import apiInstance from "../../components/API/apiInstance";
import { useQuery } from "@tanstack/react-query";

const useGetCongeAbsenceLibs = () => {
    const soccod = sessionStorage.getItem('soccod');

    return useQuery({
        queryKey: ["congeAbsences", soccod],
        queryFn: async () => {
            const response = await apiInstance.get(
              `/Absences/get-conge-libs/${soccod}`
            );
            return response.data;
          }
    })
}

export default useGetCongeAbsenceLibs;