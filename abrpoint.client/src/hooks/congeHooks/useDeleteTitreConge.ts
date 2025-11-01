import axios from "axios";
import { useMutation } from "react-query";
import { Conge } from "../../models/Conge";

const useDeleteTitreConge= () => {
    const token = localStorage.getItem('authToken');
    const headers = { Authorization: `Bearer ${token}` };
    
    return useMutation((conge:Conge) =>
        axios.delete(
            `${import.meta.env.VITE_REACT_APP_API_URL}/Conges/${conge.soccod}/${conge.concod}`,
            { headers }
        ).then(res=>res.data)
    );
};
export default useDeleteTitreConge