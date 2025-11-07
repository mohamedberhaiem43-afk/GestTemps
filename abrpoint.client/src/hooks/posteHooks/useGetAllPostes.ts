import { useQuery } from "@tanstack/react-query";
import axios from 'axios';
import { useAuth } from "../../components/helper/AuthProvider";

const fetchPostes = async (soccod: string | null, codposte: string | undefined) => {
  const token = localStorage.getItem('authToken');
  const headers = { Authorization: `Bearer ${token}` };
  const response = await axios.get(
    `${import.meta.env.VITE_REACT_APP_API_URL}/Postes/get-postes/${soccod}/${codposte}`,
    { headers }
  );
  return response.data;
};

const useGetAllPostes = (codposte: string | undefined) => {
  const { soccod } = useAuth(); // ✅ move it here!

  return useQuery({
    queryKey: ["all-postes", soccod, codposte],
    queryFn: () => fetchPostes(soccod, codposte),
    enabled: !!codposte && !!soccod, // optional: only fetch when both are ready
  });
};

export default useGetAllPostes;
