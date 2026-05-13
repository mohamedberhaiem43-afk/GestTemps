import apiInstance from "../../components/API/apiInstance";
import { useMutation } from "@tanstack/react-query";

const useAddSolde = () => {
    return useMutation({
        mutationFn: ({ solde }: { solde: any }) =>
            apiInstance.post(`/Soldes`, solde).then(res => res.data),
    });
};

export default useAddSolde;
