import { useMutation } from "react-query";
import { UtilisateurUpdate } from "../../models/Utilisateur";
import UpdateUtilisateurService from "../../services/UtilisateurService/UpdateUtilisateurService";


const useUpdateUtilisateur = () => {
    return useMutation({
        mutationKey: ["utilisateurs-update"],
        mutationFn: (user:UtilisateurUpdate) => UpdateUtilisateurService.putWithoutParams(user),
    });
};  

export default useUpdateUtilisateur;