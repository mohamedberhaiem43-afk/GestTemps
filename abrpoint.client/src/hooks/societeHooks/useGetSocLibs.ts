import axios from "axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const useGetSocLibs = () => {
  const token = localStorage.getItem("authToken");
  const headers = { Authorization: `Bearer ${token}` };

  const queryClient = useQueryClient();


  return useQuery({
    queryKey: ["soclibs"],
    queryFn: async () => {
      const response = await axios.get(
        `${import.meta.env.VITE_REACT_APP_API_URL}/Societes/get-soclibs`,
        { headers }
      );
      return response.data;
    },
    initialData: () => {
      return queryClient.getQueryData(["soclibs"]);
    },
  });
};

export default useGetSocLibs;
