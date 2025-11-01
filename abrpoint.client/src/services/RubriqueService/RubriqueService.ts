import { Rubrique } from "../../models/Rubrique";
import ApiClient from "../apiClient";

export default new ApiClient<Rubrique>(`/Rubriques`);