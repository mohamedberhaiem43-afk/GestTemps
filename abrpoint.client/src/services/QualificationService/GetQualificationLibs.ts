import { Qualification } from "../../models/Qualification"
import ApiClient from "../apiClient"

export default new ApiClient<Qualification>(`Qualifs/get-qualibs`);