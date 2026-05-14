import apiInstance from "../../components/API/apiInstance";
import { useMutation } from "@tanstack/react-query";

const useAddUser = () => {
    return useMutation({
        mutationFn: ({ user, soccod, sitcod }: { user: any; soccod: string; sitcod: string }) =>
            apiInstance.post(
                `/Utilisateurs/add-user/${soccod}/${sitcod}`,
                user
            ).then(res => res.data),
    });
};

export default useAddUser;
