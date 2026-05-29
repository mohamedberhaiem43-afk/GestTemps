import apiInstance from "../../components/API/apiInstance";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Ferier } from "../../models/Ferier";
import { invalidateFerieDependentCaches } from "./ferieCacheKeys";

const useAddRepos = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (ferier: Ferier) =>
            apiInstance.post(`/Feriers`, ferier).then(res => res.data),
        // Invalide les vues dépendant des fériés (État Périodique, Pointage du Mois…)
        // pour qu'elles reflètent immédiatement le nouveau férié.
        onSuccess: () => invalidateFerieDependentCaches(qc),
    });
};

export default useAddRepos;
