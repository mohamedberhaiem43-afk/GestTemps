import axios from "axios";
import Utilisateur from "../../models/Utilisateur";
import ApiClient from "../apiClient";

class UtilisateurServiceClass extends ApiClient<Utilisateur> {
    constructor() {
        super("/Utilisateurs");
    }

    deleteUser = (uticod: string) => {
        return axiosInstance.delete(`${this.endPoint}/delete/${uticod}`).then(res => res.data);
    };

    resetPassword = (uticod: string, newPassword: string) => {
        return axiosInstance.post(`${this.endPoint}/reset-password-admin/${uticod}`, { NewPassword: newPassword }, {
            headers: { 'Content-Type': 'application/json' }
        }).then(res => res.data);
    };

    toggleStatus = (uticod: string) => {
        return axiosInstance.post(`${this.endPoint}/toggle-status/${uticod}`).then(res => res.data);
    };
}

const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_REACT_APP_API_URL,
    withCredentials: true,
});

export default new UtilisateurServiceClass();