import { useMutation, useQueryClient } from "react-query";
import apiInstance from "../../components/API/apiInstance";
import { useAuth } from "../../components/helper/AuthProvider";

export interface AddPointageParams {
  employe_code: string;
  time: string; // ISO string or format expected by backend
}

const useAddPointage = () => {
  const queryClient = useQueryClient();
  const { soccod } = useAuth();

  return useMutation({
    mutationFn: async (params: AddPointageParams) => {
      const response = await apiInstance.post(`/Presences/mark-presence/${soccod}/${params.employe_code}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["pointages"]);
      queryClient.invalidateQueries(["kpis", soccod]);
    },
  });
};

export default useAddPointage;
