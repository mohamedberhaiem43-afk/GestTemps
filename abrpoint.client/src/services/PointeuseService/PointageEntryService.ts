import { LogsResponse } from "../../hooks/pointeuseHooks/useGetPointages";
import ApiClient from "../apiClient";

export default new ApiClient<LogsResponse>(`Pointeuse`);