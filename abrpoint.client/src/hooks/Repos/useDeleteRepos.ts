import axios from "axios";
import { useMutation } from "react-query";
import { Ferier } from "../../models/Ferier";

const useDeleteRepos = () => {
    const token = localStorage.getItem('authToken');
    const headers = { Authorization: `Bearer ${token}` };
    
    return useMutation((ferier:Ferier) =>
        axios.delete(
            `${import.meta.env.VITE_REACT_APP_API_URL}/Feriers/${ferier.soccod}/${ferier.ferdate}`,
            { headers }
        ).then(res=>res.data)
    );
};
export default useDeleteRepos;