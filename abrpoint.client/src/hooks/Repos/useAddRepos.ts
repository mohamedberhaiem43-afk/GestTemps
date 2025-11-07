import axios from "axios";
import { useMutation } from "react-query";
import { Ferier } from "../../models/Ferier";

const useAddRepos = () => {
    const token = localStorage.getItem('authToken');
    const headers = { Authorization: `Bearer ${token}` };
    
    return useMutation((ferier: Ferier) =>
            axios
                .post(
                    `${import.meta.env.VITE_REACT_APP_API_URL}/Feriers`,
                    ferier,
                    { headers }
                )
                .then(res => res.data),
        
    );
};

export default useAddRepos;
