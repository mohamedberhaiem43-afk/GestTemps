import { useMutation, useQueryClient } from "react-query";
import UtilisateurService from "../../services/UtilisateurService/UtilisateurService";

export default function useDeleteUser() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (uticod: string) => UtilisateurService.deleteUser(uticod),
        onSuccess: () => {
            queryClient.invalidateQueries(["users"]);
            queryClient.invalidateQueries(["utilisateurs"]);
        },
    });
}
