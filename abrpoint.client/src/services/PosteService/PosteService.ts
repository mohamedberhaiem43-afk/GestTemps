import { Poste } from "../../models/Poste";
import ApiClient from "../apiClient";

export default new ApiClient<Poste>(`Postes`);