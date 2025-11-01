import { Module } from "../../models/Module";
import ApiClient from "../apiClient";

export default new ApiClient<Module>(`/Modules`);