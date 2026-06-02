import apiInstance from "../../components/API/apiInstance";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../components/helper/AuthProvider";

const useGetEmployee = (sitcod?: string, sercod?: string, dircod?: string, empreg?: string) => {
    const { soccod, uticod, isEmp, isManager, isAdmin, sercod: managerSercod, hasPermission } = useAuth();
    const effectiveSercod = isManager && managerSercod ? managerSercod : sercod;

    // Profil de GESTION = peut consulter la liste des employés. Couvre admin, RH, manager ET
    // tout rôle custom doté du droit « Gestion Employés » — y compris ceux qui ont AUSSI une
    // fiche employé (dual-rôle / RH avec fiche), cas où `isManager`/`isAdmin` seuls renvoyaient
    // false et désactivaient le dropdown à tort. `hasPermission` renvoie déjà true pour l'admin.
    const canManageEmployees = isAdmin || isManager || hasPermission('Gestion Employés', 'consult');

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
        // Le dropdown liste les AUTRES employés (Solde congé, Titre congé, Autorisations,
        // signatures…). On le désactive pour un employé SIMPLE (qui n'agit que sur lui-même),
        // mais on le réactive pour tout profil de gestion MÊME s'il est aussi salarié
        // (dual-rôle, RH avec fiche) : sans `canManageEmployees`, un RH/rôle custom également
        // employé voyait la requête désactivée → dropdown vide alors qu'il a le droit liste.
        enabled: !!soccod && !!uticod && (!isEmp || canManageEmployees),
    })
}

export default useGetEmployee;
