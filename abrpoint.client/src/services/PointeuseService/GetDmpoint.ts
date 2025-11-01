import { Pointeuse } from "../../models/PointeuseModel";
import ApiClient from "../apiClient";
const soccod = sessionStorage.getItem('soccod');

export default new ApiClient<Pointeuse>(`Pointeuse/connect-pointeuse/${soccod}`);