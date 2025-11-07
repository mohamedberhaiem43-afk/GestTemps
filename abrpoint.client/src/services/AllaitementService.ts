import { AllaitementDto } from "../models/Allaitement";
import ApiClient from "./apiClient";

export default new ApiClient<AllaitementDto>(`/Allaitements`);