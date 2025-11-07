import axios from "axios";
import { useMutation } from "react-query";

const useAddUser = () => {
    const token = localStorage.getItem('authToken');
    const headers = { Authorization: `Bearer ${token}` };

    return useMutation(({ user, soccod, sitcod }: { user: any; soccod: string; sitcod: string }) =>
        axios.post(
            `${import.meta.env.VITE_REACT_APP_API_URL}/Utilisateurs/add-user/${soccod}/${sitcod}`,
            user,
            { headers }
        ).then(res => res.data)
    );
};

export default useAddUser;
