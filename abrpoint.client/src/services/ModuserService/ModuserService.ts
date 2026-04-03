import { Moduser } from "../../models/moduser";
import ApiClient from "../apiClient";

export default new ApiClient<Moduser>(`/Modusers`);