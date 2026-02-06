import { useAuth } from "../../components/helper/AuthProvider";
import { Pointeuse } from "../../models/PointeuseModel";
import ApiClient from "../apiClient";
const { soccod } = useAuth();

export default new ApiClient<Pointeuse>(`Pointeuses/connect-pointeuse/${soccod}`);