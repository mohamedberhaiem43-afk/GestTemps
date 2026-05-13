import { useMutation, useQueryClient } from "@tanstack/react-query";
import UtilisateurService from "../../services/UtilisateurService/UtilisateurService";

export default function useDeleteUser() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (uticod: string) => UtilisateurService.deleteUser(uticod),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["users"] });
            queryClient.invalidateQueries({ queryKey: ["utilisateurs"] });
        },
    });
}
