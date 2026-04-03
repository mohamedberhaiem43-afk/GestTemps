import { FonctionModel } from "../../models/Fonction";
import ApiClient from "../apiClient";

export default new ApiClient<FonctionModel>(`/Fonctions`);