import { useQuery } from "react-query";
import axios from "axios";
import { useAuth } from "../../components/helper/AuthProvider";

const fetchLcategories = async (soccod: string | null, catperiode: string) => {
  const token = localStorage.getItem("authToken");
  const headers = { Authorization: `Bearer ${token}` };

  const response = await axios.get(
    `${import.meta.env.VITE_REACT_APP_API_URL}/Lcategories/${soccod}/${catperiode}`,
    { headers }
  );

  return response.data;
};

const useGetLcategories = (catperiode: string) => {
  const { soccod } = useAuth();

  return useQuery({
    queryKey: ["lcategories", soccod, catperiode],
    queryFn: () => fetchLcategories(soccod, catperiode),
    enabled: !!soccod && !!catperiode, // ✅ only run when both exist
  });
};

export default useGetLcategories;
