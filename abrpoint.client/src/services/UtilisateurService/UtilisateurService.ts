import Utilisateur from "../../models/Utilisateur";
import ApiClient from "../apiClient";

export default new ApiClient<Utilisateur>(`/Utilisateurs`);