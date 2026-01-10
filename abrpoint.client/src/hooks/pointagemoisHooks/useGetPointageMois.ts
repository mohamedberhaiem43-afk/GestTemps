import { useQuery } from "react-query";
import GetPointageMoisService from "../../services/GetPointageMoisService";
import { useAuth } from "../../components/helper/AuthProvider";

const useGetPointageMois = (
  empcods: string[],
  mois: string,
  annee: string,
  semaine: string
) => {
  const { soccod } = useAuth();

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
    staleTime: 1000 * 60 * 5, // 5 minutes - data is considered fresh
    cacheTime: 1000 * 60 * 30, // 30 minutes - keep in cache
    refetchOnWindowFocus: false,
    refetchOnMount: true, // Allow refetch on mount if stale
    refetchInterval: false, // No automatic polling
    retry: 2,
    onError: (error) => {
      console.error("Error fetching pointage mois data:", error);
    }
  });
};

export default useGetPointageMois;
