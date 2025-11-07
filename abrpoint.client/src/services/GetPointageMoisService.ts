import { PointageMois } from "../models/PointageMois";
import ApiClient from "./apiClient";

export default new ApiClient<PointageMois[]>(`PointageMois`);