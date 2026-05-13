import apiInstance from "../../components/API/apiInstance";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../components/helper/AuthProvider";

const useGetRepos = () => {
  const { soccod } = useAuth();

  return useQuery({
    queryKey: ["repos", soccod],
    queryFn: async () => {
      const response = await apiInstance.get(
        `/Feriers`
      );
      return response.data;
    },
  });
};

export default useGetRepos;
