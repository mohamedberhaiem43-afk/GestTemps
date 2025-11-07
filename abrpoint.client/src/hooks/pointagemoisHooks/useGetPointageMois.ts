import { useQuery } from "react-query";
import GetPointageMoisService from "../../services/GetPointageMoisService";

const useGetPointageMois = (
  empcods: string[],
  mois: string,
  annee: string,
  semaine: string
) => {
  const soccod = sessionStorage.getItem('soccod');

  return useQuery({
    queryKey: ["pointage-mois", soccod, empcods, mois, annee, semaine],
    queryFn: () => {
      const queryParams = new URLSearchParams();
      empcods.forEach(code => queryParams.append("empcods", code));
      const queryString = queryParams.toString();

      const path = `${soccod}/${mois}/${annee}/${semaine}?${queryString}`;
      return GetPointageMoisService.getAllWithParams(path);
    },
    enabled: !!soccod && empcods.length > 0 && !!mois && !!annee && !!semaine,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchInterval: false,
  });
};

export default useGetPointageMois;
