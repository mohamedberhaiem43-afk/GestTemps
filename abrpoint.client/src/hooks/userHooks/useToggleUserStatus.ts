import { useMutation, useQueryClient } from "@tanstack/react-query";
import UtilisateurService from "../../services/UtilisateurService/UtilisateurService";

export default function useToggleUserStatus() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (uticod: string) => UtilisateurService.toggleStatus(uticod),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["users"] });
            queryClient.invalidateQueries({ queryKey: ["utilisateurs"] });
        },
    });
}
