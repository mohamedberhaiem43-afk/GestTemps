import axios from "axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const useGetSiteLibs = () => {
  const token = localStorage.getItem("authToken");
  const headers = { Authorization: `Bearer ${token}` };

  const queryClient = useQueryClient();


  return useQuery({
    queryKey: ["sitlibs"],
    queryFn: async () => {
      const response = await axios.get(
        `${import.meta.env.VITE_REACT_APP_API_URL}/Sites/get-sitlibs`,
        { headers }
      );
      return response.data;
    },
    initialData: () => {
      return queryClient.getQueryData(["sitlibs"]);
    },
  });
};

export default useGetSiteLibs;
