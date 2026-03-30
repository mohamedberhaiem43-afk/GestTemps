import apiInstance from "../../components/API/apiInstance";
import { useMutation, useQueryClient } from "react-query";
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

    return useMutation<AcceptCongeResponse, Error, AcceptCongeParams>(
        async ({ concod, empcod }: AcceptCongeParams) => {
            const response = await apiInstance.post(
                `/DemConges/accept-demconge/${soccod}/${concod}/${empcod}`,
                null
            );
            return response.data;
        },
        {
            onSuccess: () => {
                // Invalider les queries pour rafraîchir la liste
                queryClient.invalidateQueries('demconges');
            }
        }
    );
};

export default useAcceptDemConge;