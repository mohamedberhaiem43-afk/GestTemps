import AllaitementModel from "../models/Allaitement";
import ApiClient from "./apiClient";

export default new ApiClient<AllaitementModel>(`/Allaitements`);