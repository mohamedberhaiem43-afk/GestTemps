import { useQuery } from "react-query";
import EtatCongeService from "../../services/EmployeService/EtatCongeService";

const useGetEtatConge = (soccod: string | null, empcod: string | null, moisdeb: number | null, moisfin: number | null, annee: number | null) => {
  return useQuery({
    queryKey: ["etat-conge", soccod, empcod, moisdeb, moisfin, annee],
    queryFn: () =>
      EtatCongeService.getWithParams(`get-emp-etat-conge/${soccod}/${empcod}/${moisdeb}/${moisfin}/${annee}`),
    enabled: !!soccod && !!empcod && !!moisdeb && !!moisfin && !!annee, // Ensure all inputs are valid
    staleTime: 0, // Optional: Adjust to control cache time
  });
};

export default useGetEtatConge;
