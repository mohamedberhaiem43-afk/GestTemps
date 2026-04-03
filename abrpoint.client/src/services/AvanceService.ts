import { Avance } from "../models/Avance";
import ApiClient from "./apiClient";

export default new ApiClient<Avance>(`/Avances`);