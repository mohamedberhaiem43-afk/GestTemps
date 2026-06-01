import { useQuery } from "@tanstack/react-query";
import CongeService from "../../services/CongeService/CongeService";
import { useAuth } from "../../components/helper/AuthProvider";

// typeConge : "paye" (congés payés / CP, Abscng="0") ou "rtt" (Abscng="R").
// Le backend (GetDroitCongeAsync) filtre les droits selon ce type → le solde
// affiché reflète la nature de congé sélectionnée, et non un solde CP global.
const useGetDroitConge = (
  empcod: string,
  datedebut: string,
  datefin: string,
  typeConge: string = "paye"
) => {
  const { soccod } = useAuth();

  return useQuery({
    queryKey: ["droit-conge", soccod, empcod, datedebut, datefin, typeConge],
    queryFn: () => {
      // Create query string for empcods (backend expects a List<string> empcods)
      const queryParams = new URLSearchParams();
      if (empcod) {
        queryParams.append('empcods', empcod);
      }
      if (typeConge) {
        queryParams.append('typeConge', typeConge);
      }
      return CongeService.getAllWithParams(`get-droit-de-conge/${soccod}/${datedebut}/${datefin}?${queryParams.toString()}`);
    },
    enabled: !!soccod && !!datedebut && !!datefin,
  });
};

export default useGetDroitConge;
