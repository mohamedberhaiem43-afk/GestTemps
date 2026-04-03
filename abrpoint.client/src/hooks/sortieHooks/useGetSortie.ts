import { useQuery } from "react-query";
import { Autoriser } from "../../models/Autoriser";
import SortieService from "../../services/SortieService/SortieService";
import { useAuth } from "../../components/helper/AuthProvider";

const useGetSortie = (uticod:string | null) => {
  const { soccod } = useAuth();
  return useQuery<Autoriser[], Error>({
    queryKey: ["sorties", soccod,uticod],
    queryFn: () => SortieService.getAllWithParams(`${soccod}/${uticod}`),
    enabled: !!soccod && !!uticod,
    initialData: [],
  });
};

export default useGetSortie;
