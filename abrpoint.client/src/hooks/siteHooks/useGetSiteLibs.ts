import apiInstance from "../../components/API/apiInstance";
import { useQuery, useQueryClient } from "react-query";

const useGetSiteLibs = () => {
  const queryClient = useQueryClient();


  return useQuery({
    queryKey: ["sitlibs"],
    queryFn: async () => {
      const response = await apiInstance.get(
        `/Sites/get-sitlibs`
      );
      return response.data;
    },
    initialData: () => {
      return queryClient.getQueryData(["sitlibs"]);
    },
  });
};

export default useGetSiteLibs;
