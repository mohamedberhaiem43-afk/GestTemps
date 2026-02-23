import { useAuth } from "../../components/helper/AuthProvider";
import { Filiale } from "../../models/Filiale";
import ApiClient from "../apiClient";

const { soccod } = useAuth();

export default new ApiClient<Filiale>(`Sites/${soccod}`)