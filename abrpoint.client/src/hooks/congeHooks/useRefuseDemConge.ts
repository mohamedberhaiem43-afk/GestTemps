import apiInstance from "../../components/API/apiInstance";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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

    return useMutation<RefuseCongeResponse, Error, RefuseCongeParams>({
        mutationFn: async ({ concod, empcod }: RefuseCongeParams) => {
            const response = await apiInstance.post(
                `/DemConges/refuse-demconge/${soccod}/${concod}/${empcod}`,
                null
            );
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['demconges'] });
            queryClient.invalidateQueries({ queryKey: ['pending-demconges'] });
        },
    });
};

export default useRefuseDemConge;
