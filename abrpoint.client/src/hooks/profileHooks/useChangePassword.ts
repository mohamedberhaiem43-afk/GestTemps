import { useMutation } from "@tanstack/react-query";
import { PasswordUpdate } from "../../models/Utilisateur";
import ProfileService from "../../services/ProfileService/ProfileService";

const useUpdateProfile = () => {
    return useMutation({
        mutationKey: ["change-password"],
        mutationFn: (pwd: PasswordUpdate) =>
            // ApiClient.putObject -> PUT {endPoint}/change-password with body
            ProfileService.putObject("change-password", pwd),
    });
};

export default useUpdateProfile;