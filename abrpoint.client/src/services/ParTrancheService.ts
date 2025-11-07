import ParTranche from "../models/ParTranche";
import ApiClient from "./apiClient";

export default new ApiClient<ParTranche>(`/ParTranches`);