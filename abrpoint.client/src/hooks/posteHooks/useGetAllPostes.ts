import { useQuery } from "@tanstack/react-query";
import apiInstance from "../../components/API/apiInstance";
import { useAuth } from "../../components/helper/AuthProvider";

const fetchPostes = async (soccod: string | null, codposte: string | undefined) => {
  const response = await apiInstance.get(
    `/Postes/get-postes/${soccod}/${codposte}`
  );
  return response.data;
};

const useGetAllPostes = (codposte: string | undefined) => {
  const { soccod } = useAuth(); // ✅ move it here!

  return useQuery({
    queryKey: ["all-postes", soccod, codposte],
    queryFn: () => fetchPostes(soccod, codposte),
    enabled: !!codposte && !!soccod, // optional: only fetch when both are ready
  });
};

export default useGetAllPostes;
