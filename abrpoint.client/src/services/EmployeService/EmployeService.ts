import Employe from "../../models/Employe";
import ApiClient from "../apiClient";

export default new ApiClient<Employe>(`Employes`);