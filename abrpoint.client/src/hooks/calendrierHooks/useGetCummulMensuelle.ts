import { useQuery } from "react-query";
import CalendrierService from "../../services/CalendrierService/CalendrierService";

const useGetCummulMensuelle = (annee:string) => {
  const soccod = sessionStorage.getItem('soccod');

  return useQuery({
    queryKey: ["cumul-calendrier", soccod, annee],
    queryFn: () => CalendrierService.getAllWithParams(`${soccod}/${annee}`),
    enabled: !!soccod && !!annee, // Empêche l'exécution si l'un des paramètres est null
  });
};

export default useGetCummulMensuelle;
