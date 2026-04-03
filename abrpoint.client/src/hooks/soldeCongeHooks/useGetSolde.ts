import { useQuery } from "react-query";
import apiInstance from "../../components/API/apiInstance";

const fetchUsers = async () => {
    const response = await apiInstance.get('/Soldes');
    return response.data;
};

const useGetSolde = () => {
    return useQuery({
        queryKey: ["soldes"],
        queryFn: fetchUsers,
    });
};

export default useGetSolde;
