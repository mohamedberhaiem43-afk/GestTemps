import apiInstance from "../../components/API/apiInstance";
import { useQuery } from "react-query";
import { useAuth } from "../../components/helper/AuthProvider";

const useGetEmployee = (sitcod?: string, sercod?: string, dircod?: string, empreg?: string) => {
    const { soccod, uticod, isEmp, isManager, sercod: managerSercod } = useAuth();
    const effectiveSercod = isManager && managerSercod ? managerSercod : sercod;

    return useQuery({
        queryKey: ["employes_libs", soccod, uticod, sitcod, effectiveSercod, dircod, empreg],
        queryFn: async () => {
            const response = await apiInstance.get(
                `/Employes/get-libs/${soccod}/${uticod}`, {
                    params: { sitcod, sercod: effectiveSercod, dircod, empreg }
                }
            );
            return response.data;
        },
        enabled: !!soccod && !!uticod && !isEmp,
    })
}

export default useGetEmployee;
