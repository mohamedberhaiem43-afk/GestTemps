import { Filiale } from "../../models/Filiale";
import ApiClient from "../apiClient";

const soccod = sessionStorage.getItem('soccod');

export default new ApiClient<Filiale>(`Sites/${soccod}`)