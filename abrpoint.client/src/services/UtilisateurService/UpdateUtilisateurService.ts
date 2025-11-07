import { UtilisateurUpdate } from "../../models/Utilisateur";
import ApiClient from "../apiClient";

export default new ApiClient<UtilisateurUpdate>(`/Utilisateurs`);