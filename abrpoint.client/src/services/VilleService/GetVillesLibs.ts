import { VilleModel } from "../../models/Ville";
import ApiClient from "../apiClient";

export default new ApiClient<VilleModel>(`Villes/get-villibs`);