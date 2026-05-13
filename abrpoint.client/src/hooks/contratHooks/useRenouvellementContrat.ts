import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiInstance from "../../components/API/apiInstance";

export interface RenewContractPayload {
  soccod: string;
  sourceConcod: string;
  newConcod: string;
  condat: string;
  startDate: string;
  endDate: string;
  monthNumber: number;
  contype?: string;
  empcontrat?: string;
  empmotif?: string;
}

const useRenouvellementContrat = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["renew-contrat"],
    mutationFn: async (contrat: RenewContractPayload) => {
      const response = await apiInstance.post("/Contrats/renew", contrat);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contrats"] });
    },
  });
};

export default useRenouvellementContrat;
