import { useQuery } from "react-query";
import apiInstance from "../../components/API/apiInstance";
import { useAuth } from "../../components/helper/AuthProvider";

const fetchLcategories = async (soccod: string | null, catperiode: string) => {
  const response = await apiInstance.get(
    `/Lcategories/${soccod}/${catperiode}`
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
