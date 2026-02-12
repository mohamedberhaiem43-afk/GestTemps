import { useQuery } from "react-query";
import AvanceService from "../../services/AvanceService";

const useGetAvances = (mois:string,annee:string,niveau:string) => {
  const soccod = sessionStorage.getItem('soccod');

  return useQuery({
    queryKey: ["avances", soccod,mois, annee,niveau],
    queryFn: () => AvanceService.getAllWithParams(`${soccod}/${mois}/${annee}/${niveau}`),
    enabled: !!soccod && !!annee,
  });
};

export default useGetAvances;
