import apiInstance from "../../components/API/apiInstance";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../components/helper/AuthProvider";

const useGetEmployee = (sitcod?: string, sercod?: string, dircod?: string, empreg?: string) => {
    const { soccod, uticod, isEmp, isManager, isAdmin, sercod: managerSercod } = useAuth();
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
        // Le dropdown liste les AUTRES employés (Solde congé, Titre congé, Autorisations…).
        // On le désactive pour un employé SIMPLE (qui n'agit que sur lui-même), mais on le
        // réactive pour les rôles de gestion MÊME s'ils sont aussi salariés (dual-rôle) :
        // sans ce `|| isManager || isAdmin`, un manager/admin également employé voyait la
        // requête désactivée → dropdown vide alors qu'il accède bien à la liste globale.
        enabled: !!soccod && !!uticod && (!isEmp || isManager || isAdmin),
    })
}

export default useGetEmployee;
