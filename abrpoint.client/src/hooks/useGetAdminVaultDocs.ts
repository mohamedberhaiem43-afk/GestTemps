import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../components/helper/AuthProvider";
import apiInstance from "../components/API/apiInstance";

const useGetAdminVaultDocs = () => {
    // Coffre-fort de GESTION (vue globale). Activé en vue de gestion : `isManagementView`
    // inclut le dual-rôle en mode Gestion, là où l'ancien garde `!isEmp` rendait le coffre
    // global vide pour un admin/manager possédant aussi une fiche employé.
    const { soccod, isManagementView } = useAuth();

    return useQuery({
        queryKey: ["adminVaultDocs", soccod, isManagementView],
        queryFn: async () => {
            if (!isManagementView || !soccod) return [];
            const response = await apiInstance.get(`/Vault/admin/${soccod}`);
            return response.data;
        },
        enabled: !!soccod && isManagementView
    });
};

export default useGetAdminVaultDocs;