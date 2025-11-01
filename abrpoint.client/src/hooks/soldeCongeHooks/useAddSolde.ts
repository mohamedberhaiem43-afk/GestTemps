import axios from "axios";
import { useMutation } from "react-query";

const useAddSolde = () => {
    const token = localStorage.getItem('authToken');
    const headers = { Authorization: `Bearer ${token}` };

    return useMutation(({ solde }: { solde: any}) =>
        axios.post(
            `${import.meta.env.VITE_REACT_APP_API_URL}/Soldes`,
            solde,
            { headers }
        ).then(res => res.data)
    );
};

export default useAddSolde;
