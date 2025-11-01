import { Section } from "jspdf-autotable";
import ApiClient from "../apiClient";
const soccod = sessionStorage.getItem('soccod');

export default new ApiClient<Section>(`Sections/${soccod}`)