import { useQuery } from "react-query";
import UtilisateurService from "../../services/UtilisateurService/UtilisateurService";

const useGetUtilisateur = (uticod:string) => {
  return useQuery({
    queryKey: ["utilisateur", uticod],
    queryFn: () => UtilisateurService.getAllWithParams(`${uticod}`),
    enabled: !!uticod,
  });
};

export default useGetUtilisateur;
