import axios from "axios";
import { useMutation } from "react-query";
import { Conge } from "../../models/Conge";

const useAddConge = () => {
    const token = localStorage.getItem('authToken');
    const headers = { Authorization: `Bearer ${token}` };
    
    return useMutation((conge:Conge) =>
        axios.post(
            `${import.meta.env.VITE_REACT_APP_API_URL}/Conges`,
            conge,
            { headers }
        ).then(res=>res.data)
    );
};
export default useAddConge;