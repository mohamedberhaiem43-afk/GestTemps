import { useQuery } from "react-query";
import CalendrierService from "../../services/CalendrierService/CalendrierService";

const useGetCalendrierSociete = (annee: string) => {
  const soccod = localStorage.getItem('soccod') || "01";

  return useQuery({
    queryKey: ["calendrier", soccod, annee],
    queryFn: () => CalendrierService.getWithParams(`get-calendrier/${soccod}/${annee}`),
    enabled: !!soccod && !!annee,
  });
};

export default useGetCalendrierSociete;
