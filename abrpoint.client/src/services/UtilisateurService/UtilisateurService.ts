import Utilisateur from "../../models/Utilisateur";
import ApiClient from "../apiClient";
// SEC/PERF — Centralisation sur apiInstance singleton :
//   - header X-Tenant-Slug garanti ;
//   - interceptor refresh-token coalescé propagé ;
//   - plus de duplication d'instance.
import apiInstance from "../../components/API/apiInstance";

class UtilisateurServiceClass extends ApiClient<Utilisateur> {
    constructor() {
        super("/Utilisateurs");
    }

    deleteUser = (uticod: string) => {
        return apiInstance.delete(`${this.endPoint}/delete/${uticod}`).then(res => res.data);
    };

    resetPassword = (uticod: string, newPassword: string) => {
        return apiInstance.post(`${this.endPoint}/reset-password-admin/${uticod}`, { NewPassword: newPassword }, {
            headers: { 'Content-Type': 'application/json' }
        }).then(res => res.data);
    };

    toggleStatus = (uticod: string) => {
        return apiInstance.post(`${this.endPoint}/toggle-status/${uticod}`).then(res => res.data);
    };
}

export default new UtilisateurServiceClass();