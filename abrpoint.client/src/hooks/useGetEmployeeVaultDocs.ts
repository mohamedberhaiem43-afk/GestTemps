import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../components/helper/AuthProvider";
import apiInstance from "../components/API/apiInstance";

const useGetEmployeeVaultDocs = () => {
    const { soccod, uticod, isEmp } = useAuth();

    return useQuery({
        queryKey: ["employeeVaultDocs", soccod, uticod],
        queryFn: async () => {
            if (!isEmp || !soccod || !uticod) return [];
            const response = await apiInstance.get(`/Vault/${soccod}/${uticod}`);
            return response.data;
        },
        enabled: !!soccod && !!uticod && isEmp
    });
};

export default useGetEmployeeVaultDocs;