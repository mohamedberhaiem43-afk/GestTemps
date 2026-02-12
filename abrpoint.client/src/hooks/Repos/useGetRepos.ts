import axios from "axios";
import { useQuery } from "react-query";
import { useAuth } from "../../components/helper/AuthProvider";

const useGetRepos = () => {
  const { soccod } = useAuth();
  const token = localStorage.getItem("authToken");
  const headers = { Authorization: `Bearer ${token}` };


  return useQuery({
    queryKey: ["repos", soccod],
    queryFn: async () => {
      const response = await axios.get(
        `${import.meta.env.VITE_REACT_APP_API_URL}/Feriers`,
        { headers }
      );
      return response.data;
    },
  });
};

export default useGetRepos;
