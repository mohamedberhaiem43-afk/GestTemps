import { PaysModel } from "../../models/Pays";
import ApiClient from "../apiClient";

export default new ApiClient<PaysModel>(`Pays/get-natlibs`);