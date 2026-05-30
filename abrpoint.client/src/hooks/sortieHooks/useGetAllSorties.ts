import { useQuery } from "@tanstack/react-query";
import { Autoriser } from "../../models/Autoriser";
import SortieService from "../../services/SortieService/SortieService";
import { useAuth } from "../../components/helper/AuthProvider";

/**
 * Liste TOUTES les autorisations de sortie de la société (écran de gestion admin),
 * indépendamment du site de l'utilisateur connecté. À utiliser sur l'écran de
 * gestion : `useGetSortie(uticod)` scope par Socusers (site du compte) et laissait
 * la liste vide à l'ouverture tant qu'aucun enregistrement n'était rattaché au site.
 */
const useGetAllSorties = () => {
  const { soccod } = useAuth();
  return useQuery<Autoriser[], Error>({
    queryKey: ["sorties-all", soccod],
    queryFn: () => SortieService.getAllWithParams(`all/${soccod}`),
    enabled: !!soccod,
    initialData: [],
  });
};

export default useGetAllSorties;
