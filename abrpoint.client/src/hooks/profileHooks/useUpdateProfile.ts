import { useMutation } from "react-query";
import { UtilisateurUpdate } from "../../models/Utilisateur";
import UpdateUtilisateurService from "../../services/UtilisateurService/UpdateUtilisateurService";

const useUpdateProfile = () => {
    return useMutation({
        mutationKey: ["update-profile"],
        mutationFn: (user: UtilisateurUpdate) =>
            // ApiClient.putObject -> PUT {endPoint}/update-profile with body
            UpdateUtilisateurService.putObject("update-profile", user),
    });
};

export default useUpdateProfile;