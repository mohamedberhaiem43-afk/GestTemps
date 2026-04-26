import apiInstance from "../../components/API/apiInstance";
import { useMutation, useQueryClient } from "react-query";
import { useAuth } from "../../components/helper/AuthProvider";

interface RefuseCongeParams {
    concod: string;
    empcod: string;
}

interface RefuseCongeResponse {
    success: boolean;
    message: string;
}

const useRefuseDemConge = () => {
    const { soccod } = useAuth();
    const queryClient = useQueryClient();

    return useMutation<RefuseCongeResponse, Error, RefuseCongeParams>(
        async ({ concod, empcod }: RefuseCongeParams) => {
            const response = await apiInstance.post(
                `/DemConges/refuse-demconge/${soccod}/${concod}/${empcod}`,
                null
            );
            return response.data;
        },
        {
            onSuccess: () => {
                queryClient.invalidateQueries('demconges');
                queryClient.invalidateQueries('pending-demconges');
            }
        }
    );
};

export default useRefuseDemConge;