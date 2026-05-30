import { useQuery } from "@tanstack/react-query";
import ListeService from "../../services/ListeService";
import { useAuth } from "../../components/helper/AuthProvider";

const useGetFemmeLibs = () => {
    const { soccod, uticod } = useAuth();
    return useQuery({
      queryKey: ["femme-libs", soccod, uticod],
      queryFn: () => ListeService.getAllWithParams(`Employes/get-femme-libs/${soccod}/${uticod}`),
      enabled: !!soccod && !!uticod,
      // La liste des salariées doit refléter immédiatement un changement de sexe / un
      // nouvel ajout sans rechargement manuel de la page. On considère donc la donnée
      // toujours périmée et on refetch à chaque montage de la page allaitement + au
      // retour de focus, plutôt que de dépendre d'une invalidation depuis la fiche.
      staleTime: 0,
      refetchOnMount: 'always',
      refetchOnWindowFocus: true,
    });
};

export default useGetFemmeLibs;
