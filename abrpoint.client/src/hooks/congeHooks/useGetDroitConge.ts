import { useQuery } from "react-query";
import CongeService from "../../services/CongeService/CongeService";
import { useAuth } from "../../components/helper/AuthProvider";

const useGetDroitConge = (empcod:string,datedebut:string, datefin:string) => {
  const { soccod } = useAuth();

  return useQuery({
    queryKey: ["droit-conge", soccod,empcod, datedebut, datefin],
    queryFn: () => CongeService.getAllWithParams(`${soccod}/${empcod}/${datedebut}/${datefin}`),
    enabled: !!soccod && !!datedebut && !!datefin,
  });
};

export default useGetDroitConge;
