import ApiClient from "../apiClient";
import { Pointeuse } from "../../models/PointeuseModel";

const pointeuseApiClient = new ApiClient<Pointeuse>("Pointeuse");

const DeletePointeuse = {
    delete: (soccod: string | null, code: string) => pointeuseApiClient.delete(soccod, code),
};

export default DeletePointeuse;
