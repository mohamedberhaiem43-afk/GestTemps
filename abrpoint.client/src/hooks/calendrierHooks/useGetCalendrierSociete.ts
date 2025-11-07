import { useQuery } from "@tanstack/react-query";
import CalendrierService from "../../services/CalendrierService/CalendrierService";

const useGetCalendrierSociete = (annee:string) => {
  const soccod = sessionStorage.getItem('soccod');

  return useQuery({
    queryKey: ["calendrier", soccod, annee],
    queryFn: () => CalendrierService.getWithParams(`get-calendrier/${soccod}/${annee}`),
    enabled: !!soccod && !!annee,
  });
};

export default useGetCalendrierSociete;
