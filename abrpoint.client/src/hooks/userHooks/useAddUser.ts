import apiInstance from "../../components/API/apiInstance";
import { useMutation } from "react-query";

const useAddUser = () => {
    return useMutation(({ user, soccod, sitcod }: { user: any; soccod: string; sitcod: string }) =>
        apiInstance.post(
            `/Utilisateurs/add-user/${soccod}/${sitcod}`,
            user
        ).then(res => res.data)
    );
};

export default useAddUser;
