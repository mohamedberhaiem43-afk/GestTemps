import apiInstance from "../../components/API/apiInstance";
import { useQuery, useQueryClient } from "react-query";
import { useAuth } from "../../components/helper/AuthProvider";

const useGetServiceLibs = () => {
  const { soccod } = useAuth();
  const queryClient = useQueryClient();


  return useQuery({
    queryKey: ["servlibs",soccod],
    queryFn: async () => {
      const response = await apiInstance.get(
        `/Services/get-servlibs/${soccod}`
      );
      return response.data;
    },
    initialData: () => {
      return queryClient.getQueryData(["servlibs",soccod]);
    },
  });
};

export default useGetServiceLibs;
