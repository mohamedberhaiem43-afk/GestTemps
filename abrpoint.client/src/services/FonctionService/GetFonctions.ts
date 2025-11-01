import { FonctionModel } from "../../models/Fonction";
import ApiClient from "../apiClient";

const soccod = sessionStorage.getItem('soccod');

export default new ApiClient<FonctionModel>(`Fonctions/${soccod}`);