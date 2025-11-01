import { Poste } from "../models/Poste";
import ApiClient from "./apiClient";

export default new ApiClient<Partial<Poste>>(`/Postes`);