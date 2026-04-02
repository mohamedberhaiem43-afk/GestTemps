import apiInstance from "../../components/API/apiInstance";
import { useQuery, useQueryClient } from "react-query";
import { useAuth } from "../../components/helper/AuthProvider";

const useGetSiteLibs = () => {
  const queryClient = useQueryClient();
  const { soccod } = useAuth();

  return useQuery({
    queryKey: ["sitlibs", soccod],
    queryFn: async () => {
      if (!soccod) return {};
      const response = await apiInstance.get(
        `/Sites/get-sitlibs/${soccod}`
      );
      return response.data;
    },
    initialData: () => {
      return queryClient.getQueryData(["sitlibs", soccod]);
    },
    enabled: !!soccod,
  });
};

export default useGetSiteLibs;
