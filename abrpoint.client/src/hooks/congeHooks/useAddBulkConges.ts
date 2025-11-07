import axios from "axios";
import { useMutation } from "react-query";

const useAddBulkConges = () => {
    const token = localStorage.getItem('authToken');
    const headers = { Authorization: `Bearer ${token}` };
    
    return useMutation((conge:any) =>
        axios.post(
            `${import.meta.env.VITE_REACT_APP_API_URL}/Conges/bulk`,
            conge,
            { headers }
        ).then(res=>res.data)
    );
};
export default useAddBulkConges;