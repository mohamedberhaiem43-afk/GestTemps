import apiInstance from "../../components/API/apiInstance";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Ferier } from "../../models/Ferier";
import { invalidateFerieDependentCaches } from "./ferieCacheKeys";

const useDeleteRepos = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (ferier: Ferier) =>
            apiInstance.delete(`/Feriers/${ferier.soccod}/${ferier.ferdate}`)
                .then(res => res.data),
        // Invalide les vues dépendant des fériés après suppression.
        onSuccess: () => invalidateFerieDependentCaches(qc),
    });
};

export default useDeleteRepos;
