import axios from "axios";
import { useMutation } from "react-query";
import { Solde } from "../../models/Solde";

const useDeleteSolde= () => {
    const token = localStorage.getItem('authToken');
    const headers = { Authorization: `Bearer ${token}` };
    
    return useMutation((solde:Solde) =>
        axios.delete(
            `${import.meta.env.VITE_REACT_APP_API_URL}/Soldes/${solde.soccod}/${solde.empcod}`,
            { headers }
        ).then(res=>res.data)
    );
};
export default useDeleteSolde