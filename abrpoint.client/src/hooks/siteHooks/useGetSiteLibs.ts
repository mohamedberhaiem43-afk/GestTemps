import apiInstance from "../../components/API/apiInstance";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../components/helper/AuthProvider";

/**
 * Liste des sites (Sitcod → Sitlib) pour la société courante.
 *
 * Avant 2026-05-24 : ce hook appelait `/Sites/get-sitlibs/{soccod}/{uticod}`
 * (variante par utilisateur, filtrée via la table `socuser` qui ne contient
 * que les sites auxquels l'utilisateur courant a explicitement accès). Deux
 * problèmes en découlaient :
 *   1. Si `uticod` était null (auth en cours d'hydratation, ou comptes admin
 *      sans uticod stocké en session), le hook retournait `{}` → tous les
 *      dropdowns de sites (fiche employé, contrats, profil…) restaient vides.
 *   2. Sémantiquement faux : un admin/RH qui assigne un site à un employé
 *      doit voir TOUS les sites de la société, pas seulement ses propres
 *      accès — sinon il ne peut pas inscrire un collaborateur sur un site
 *      auquel lui-même n'a pas accès.
 *
 * Maintenant : on passe par `/Sites/get-sitlibs/{soccod}` (toute la société).
 * Si un écran a besoin du filtrage per-user, il faut un hook dédié.
 */
const useGetSiteLibs = () => {
  const queryClient = useQueryClient();
  const { soccod } = useAuth();

  return useQuery<Record<string,string>>({
    queryKey: ["sitlibs", soccod],
    queryFn: async () => {
      if (!soccod) return {};
      const response = await apiInstance.get<Record<string,string>>(
        `/Sites/get-sitlibs/${soccod}`
      );
      return response.data || {};
    },
    initialData: () => {
      return queryClient.getQueryData<Record<string,string>>(["sitlibs", soccod]) || {};
    },
    enabled: !!soccod,
  });
};

export default useGetSiteLibs;
