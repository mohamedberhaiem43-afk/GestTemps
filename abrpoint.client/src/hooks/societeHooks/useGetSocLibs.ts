import apiInstance from "../../components/API/apiInstance";
import { useQuery, useQueryClient } from "react-query";

const useGetSocLibs = () => {
  const queryClient = useQueryClient();


  return useQuery({
    queryKey: ["soclibs"],
    queryFn: async () => {
      const response = await apiInstance.get(
        `/Societes/get-soclibs`
      );
      return response.data;
    },
    initialData: () => {
      return queryClient.getQueryData(["soclibs"]);
    },
  });
};

export default useGetSocLibs;
