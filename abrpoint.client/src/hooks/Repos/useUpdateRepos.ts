import { useMutation } from "@tanstack/react-query";
import { Ferier } from "../../models/Ferier";
import apiInstance from "../../components/API/apiInstance";

interface UpdateReposArgs {
    ferier: Ferier;
    // Date d'origine de la ligne (PK = Soccod + Ferdate côté backend). Indispensable si la date
    // a changé : sans elle, le backend ne retrouve pas la ligne et insère un doublon.
    originalFerdate?: string | null;
}

const useUpdateRepos = () => {
    return useMutation({
        mutationKey: ["repos"],
        mutationFn: ({ ferier, originalFerdate }: UpdateReposArgs) => {
            const params = originalFerdate ? { originalFerdate } : undefined;
            return apiInstance.put('Feriers', ferier, { params }).then((r) => r.data);
        },
    });
};

export default useUpdateRepos;