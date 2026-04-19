import { Moduser } from "../../models/moduser";
import ApiClient from "../apiClient";

class ModuserServiceClass extends ApiClient<Moduser> {
    constructor() {
        super("/Modusers");
    }

    bulkUpdate = (uticod: string, permissions: Moduser[]) => {
        return this.putWithParamsList(`bulk-update/${uticod}`, permissions);
    };
}

export default new ModuserServiceClass();