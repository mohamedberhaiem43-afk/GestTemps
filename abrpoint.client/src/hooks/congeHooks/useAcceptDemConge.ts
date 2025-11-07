import axios from "axios";
import { useMutation } from "react-query";
import { useAuth } from "../../components/helper/AuthProvider";

const useAcceptDemConge = () => {
    const { soccod } = useAuth();
    const token = localStorage.getItem('authToken');
    const headers = { Authorization: `Bearer ${token}` };
    
    return useMutation((concod:string) =>
        axios.post(
            `${import.meta.env.VITE_REACT_APP_API_URL}/DemConges/accept-demconge/${soccod}/${concod}`,
            null,
            { headers }
        )
    );
};
export default useAcceptDemConge;