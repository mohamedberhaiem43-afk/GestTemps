import apiInstance from "../../components/API/apiInstance";
import { useQuery, useQueryClient } from "react-query";
import { useAuth } from "../../components/helper/AuthProvider";

const useGetSiteLibs = () => {
  const queryClient = useQueryClient();
  const { soccod, uticod } = useAuth();

  return useQuery<Record<string,string>>({
    queryKey: ["sitlibs", soccod, uticod],
    queryFn: async () => {
      if (!soccod || !uticod) return {};
      const response = await apiInstance.get<Record<string,string>>(
        `/Sites/get-sitlibs/${soccod}/${uticod}`
      );
      return response.data || {};
    },
    initialData: () => {
      return queryClient.getQueryData<Record<string,string>>(["sitlibs", soccod, uticod]) || {};
    },
    enabled: !!soccod && !!uticod,
  });
};

export default useGetSiteLibs;
