import apiInstance from "../../components/API/apiInstance";
import { useQuery } from "@tanstack/react-query";
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
 *
 * 2026-05-27 — Param optionnel `overrideSoccod` : permet aux pages multi-sociétés
 * (ex: SaisieContrat où l'admin choisit la société du contrat dans un dropdown)
 * de charger les sites de la société SÉLECTIONNÉE, et non de la société courante
 * de l'auth. Sans cet override, le dropdown SITE restait vide dès que la société
 * choisie côté form différait de la société de session de l'utilisateur.
 * Le `initialData: {}` retournait alors un cache « vide » qui ne déclenchait
 * pas de refetch — l'utilisateur voyait « Aucun site disponible » malgré
 * l'existence de sites enregistrés sous cette société.
 */
const useGetSiteLibs = (overrideSoccod?: string | null) => {
  const { soccod: authSoccod } = useAuth();
  const soccod = overrideSoccod ?? authSoccod;

  return useQuery<Record<string,string>>({
    queryKey: ["sitlibs", soccod],
    queryFn: async () => {
      if (!soccod) return {};
      const response = await apiInstance.get<Record<string,string>>(
        `/Sites/get-sitlibs/${soccod}`
      );
      return response.data || {};
    },
    // initialData retiré : il pré-remplissait un `{}` traité comme fresh data,
    // ce qui empêchait l'UI de distinguer « pas encore chargé » de « 0 site ».
    // En cas de cache hit, react-query renverra directement le cached data
    // sans cet artifice.
    enabled: !!soccod,
    placeholderData: (previous) => previous,
  });
};

export default useGetSiteLibs;
