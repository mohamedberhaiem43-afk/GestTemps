import apiInstance from "../../components/API/apiInstance";
import { useMutation } from "@tanstack/react-query";

const useUpdateUser = () => {
    return useMutation({
        mutationFn: ({ user, soccod, sitcod, sercod }: { user: any; soccod: string; sitcod: string; sercod?: string | null }) =>
            apiInstance.put(
                `/Utilisateurs/update-user/${soccod}/${sitcod}${sercod ? `?sercod=${encodeURIComponent(sercod)}` : ''}`,
                { utilisateur: user }
            ).then(res => res.data),
    });
};

export default useUpdateUser;
