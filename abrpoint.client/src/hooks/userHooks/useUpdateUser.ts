import apiInstance from "../../components/API/apiInstance";
import { useMutation } from "react-query";

const useUpdateUser = () => {
    return useMutation(({ user, soccod, sitcod }: { user: any; soccod: string; sitcod: string }) =>
        apiInstance.put(
            `/Utilisateurs/update-user/${soccod}/${sitcod}`,
            { utilisateur: user }
        ).then(res => res.data)
    );
};

export default useUpdateUser;
