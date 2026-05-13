import { useMutation } from "@tanstack/react-query";
import UtilisateurService from "../../services/UtilisateurService/UtilisateurService";

export default function useResetPassword() {
    return useMutation({
        mutationFn: ({ uticod, newPassword }: { uticod: string; newPassword: string }) => 
            UtilisateurService.resetPassword(uticod, newPassword),
    });
}
