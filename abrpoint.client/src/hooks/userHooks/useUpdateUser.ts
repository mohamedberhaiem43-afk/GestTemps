import apiInstance from "../../components/API/apiInstance";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const useUpdateUser = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ user, soccod, sitcod, sercod }: { user: any; soccod: string; sitcod: string; sercod?: string | null }) =>
            apiInstance.put(
                `/Utilisateurs/update-user/${soccod}/${sitcod}${sercod ? `?sercod=${encodeURIComponent(sercod)}` : ''}`,
                { utilisateur: user }
            ).then(res => res.data),
        // Après une mise à jour réussie, on invalide À LA FOIS la liste (['utilisateurs'])
        // et TOUTES les fiches individuelles (préfixe ['utilisateur', …]). Sans cette
        // invalidation, rouvrir la modale d'édition sur le même utilisateur réaffichait
        // les anciennes valeurs (le staleTime/gcTime=0 ne suffit pas si l'observer de la
        // requête ne se démonte pas entre deux ouvertures) → il fallait recharger la page.
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['utilisateurs'] });
            queryClient.invalidateQueries({ queryKey: ['utilisateur'] });
        },
    });
};

export default useUpdateUser;
