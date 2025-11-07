import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../components/helper/AuthProvider";

const fetchConges = async (soccod: string | null) => {
  const uticod = localStorage.getItem("Uticod");
  const token = localStorage.getItem("authToken");
  const headers = { Authorization: `Bearer ${token}` };
  const response = await axios.get(
    `${import.meta.env.VITE_REACT_APP_API_URL}/Conges/get-conges/${soccod}/${uticod}`,
    { headers }
  );
  return response.data;
};

const useGetTitreConge = () => {
  const { soccod } = useAuth();

  return useQuery({
    queryKey: ["conges", soccod],
    queryFn: () => fetchConges(soccod), // ✅ Call the function properly
    enabled: !!soccod, // ✅ Wait until soccod is loaded
  });
};

export default useGetTitreConge;
