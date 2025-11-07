import { PosteHoraire } from "../../models/PosteHoraire";
import ApiClient from "../apiClient";

export default new ApiClient<PosteHoraire>(`Postes`);