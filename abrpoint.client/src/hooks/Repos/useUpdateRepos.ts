import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Ferier } from "../../models/Ferier";
import apiInstance from "../../components/API/apiInstance";
import { invalidateFerieDependentCaches } from "./ferieCacheKeys";

interface UpdateReposArgs {
    ferier: Ferier;
    // Date d'origine de la ligne (PK = Soccod + Ferdate côté backend). Indispensable si la date
    // a changé : sans elle, le backend ne retrouve pas la ligne et insère un doublon.
    originalFerdate?: string | null;
}

const useUpdateRepos = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationKey: ["repos"],
        mutationFn: ({ ferier, originalFerdate }: UpdateReposArgs) => {
            const params = originalFerdate ? { originalFerdate } : undefined;
            return apiInstance.put('Feriers', ferier, { params }).then((r) => r.data);
        },
        // Invalide les vues dépendant des fériés pour refléter la modification sans
        // rafraîchissement de page (cache React Query staleTime 5 min).
        onSuccess: () => invalidateFerieDependentCaches(qc),
    });
};

export default useUpdateRepos;