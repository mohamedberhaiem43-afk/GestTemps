import apiInstance from "../../components/API/apiInstance";
import { useMutation } from "react-query";

const useAddSolde = () => {
    return useMutation(({ solde }: { solde: any}) =>
        apiInstance.post(
            `/Soldes`,
            solde
        ).then(res => res.data)
    );
};

export default useAddSolde;
