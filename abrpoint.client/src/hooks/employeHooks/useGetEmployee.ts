import apiInstance from "../../components/API/apiInstance";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../components/helper/AuthProvider";

const useGetEmployee = (sitcod?: string, sercod?: string, dircod?: string, empreg?: string) => {
    const { soccod, uticod, isEmp, isManager, sercod: managerSercod } = useAuth();
    const effectiveSercod = isManager && managerSercod ? managerSercod : sercod;

    // Bug log #3 — Avant : ce hook utilisait le cache key "employes_libs" alors que
    // useGetEmployeesLibs utilisait "employees" pour la même URL et les mêmes params,
    // ce qui forçait deux GET /Employes/get-libs identiques quand une page utilisait
    // les deux hooks (cf. GestionContratsModern → empLibsRaw + empLibsDirect). On
    // unifie sur "employees" pour que react-query dédoublonne automatiquement.
    return useQuery({
        queryKey: ["employees", soccod, uticod, sitcod, effectiveSercod, dircod, empreg],
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
