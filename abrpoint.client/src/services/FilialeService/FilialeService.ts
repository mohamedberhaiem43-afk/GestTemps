import { Filiale } from "../../models/Filiale";
import ApiClient from "../apiClient";

export default new ApiClient<Filiale>(`/Sites`);