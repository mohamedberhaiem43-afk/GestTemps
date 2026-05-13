import { useQuery } from "@tanstack/react-query";
import CongeService from "../../services/CongeService/CongeService";
import { useAuth } from "../../components/helper/AuthProvider";

const useGetDroitConge = (empcod:string,datedebut:string, datefin:string) => {
  const { soccod } = useAuth();

  return useQuery({
    queryKey: ["droit-conge", soccod, empcod, datedebut, datefin],
    queryFn: () => {
      // Create query string for empcods (backend expects a List<string> empcods)
      const queryParams = new URLSearchParams();
      if (empcod) {
        queryParams.append('empcods', empcod);
      }
      return CongeService.getAllWithParams(`get-droit-de-conge/${soccod}/${datedebut}/${datefin}?${queryParams.toString()}`);
    },
    enabled: !!soccod && !!datedebut && !!datefin,
  });
};

export default useGetDroitConge;
