import ApiClient from "../apiClient";

const soccod = sessionStorage.getItem('soccod');


export default new ApiClient<Record<string,string>>(`Sections/get-seclibs/${soccod}`);