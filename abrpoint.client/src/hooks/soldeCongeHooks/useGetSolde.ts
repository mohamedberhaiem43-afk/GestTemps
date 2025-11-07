import { useQuery } from "@tanstack/react-query";
import axios from 'axios';

const fetchUsers = async () => {
    const token = localStorage.getItem('authToken');
    const headers = { Authorization: `Bearer ${token}` };
    const response = await axios.get(`${import.meta.env.VITE_REACT_APP_API_URL}/Soldes`, { headers });
    return response.data;
};

const useGetSolde = () => {
    return useQuery({
      queryKey:["soldes"], 
      queryFn:fetchUsers,
});
};

export default useGetSolde;
