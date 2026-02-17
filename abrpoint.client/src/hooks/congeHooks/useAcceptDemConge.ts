import axios from "axios";
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
    const token = localStorage.getItem('authToken');
    const headers = { Authorization: `Bearer ${token}` };
    
    return useMutation<AcceptCongeResponse, Error, AcceptCongeParams>(
        async ({ concod, empcod }: AcceptCongeParams) => {
            const response = await axios.post(
                `${import.meta.env.VITE_REACT_APP_API_URL}/DemConges/accept-demconge/${soccod}/${concod}/${empcod}`,
                null,
                { headers }
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