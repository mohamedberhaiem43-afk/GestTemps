import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../components/helper/AuthProvider";
import apiInstance from "../components/API/apiInstance";

const useGetAdminVaultDocs = () => {
    const { soccod, isEmp } = useAuth();

    return useQuery({
        queryKey: ["adminVaultDocs", soccod],
        queryFn: async () => {
            if (isEmp || !soccod) return [];
            const response = await apiInstance.get(`/Vault/admin/${soccod}`);
            return response.data;
        },
        enabled: !!soccod && !isEmp
    });
};

export default useGetAdminVaultDocs;