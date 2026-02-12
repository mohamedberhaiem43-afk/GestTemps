import axios from "axios";
import { useQuery, useQueryClient } from "react-query";
import { useAuth } from "../../components/helper/AuthProvider";

const useGetServiceLibs = () => {
  const token = localStorage.getItem("authToken");
  const headers = { Authorization: `Bearer ${token}` };
  const { soccod } = useAuth();
  const queryClient = useQueryClient();


  return useQuery({
    queryKey: ["servlibs",soccod],
    queryFn: async () => {
      const response = await axios.get(
        `${import.meta.env.VITE_REACT_APP_API_URL}/Services/get-servlibs/${soccod}`,
        { headers }
      );
      return response.data;
    },
    initialData: () => {
      return queryClient.getQueryData(["servlibs",soccod]);
    },
  });
};

export default useGetServiceLibs;
