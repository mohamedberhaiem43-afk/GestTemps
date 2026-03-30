import apiInstance from "../../components/API/apiInstance";
import { useQuery } from "react-query";
import { useAuth } from "../../components/helper/AuthProvider";

const fetchConges = async (soccod: string | null, uticod: string | null) => {
  const response = await apiInstance.get(
    `/Conges/get-conges/${soccod}/${uticod}`
  );
  return response.data;
};

const useGetTitreConge = () => {
  const { soccod, uticod } = useAuth();

  return useQuery({
    queryKey: ["conges", soccod, uticod],
    queryFn: () => fetchConges(soccod, uticod),
    enabled: !!soccod && !!uticod,
  });
};

export default useGetTitreConge;
