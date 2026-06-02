import apiInstance from "../../components/API/apiInstance";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../components/helper/AuthProvider";

interface AcceptCongeParams {
    concod: string;
    empcod: string;
}

interface AcceptCongeResponse {
    success: boolean;
    message: string;
}

const useAcceptDemConge = () => {
    const { soccod } = useAuth();
    const queryClient = useQueryClient();

    return useMutation<AcceptCongeResponse, Error, AcceptCongeParams>({
        mutationFn: async ({ concod, empcod }: AcceptCongeParams) => {
            const response = await apiInstance.post(
                `/DemConges/accept-demconge/${soccod}/${concod}/${empcod}`,
                null
            );
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['demconges'] });
            // Indispensable : sans ça, la demande ACCEPTÉE restait affichée dans la liste
            // « à valider » du dashboard (alimentée par la query ['pending-demconges']).
            // Le hook de refus invalidait déjà cette clé — on s'aligne.
            queryClient.invalidateQueries({ queryKey: ['pending-demconges'] });
        },
    });
};

export default useAcceptDemConge;
