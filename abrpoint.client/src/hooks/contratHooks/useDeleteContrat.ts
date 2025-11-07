import { useMutation } from "@tanstack/react-query";
import ContratService from "../../services/ContratService/ContratService";

const useDeleteContrat = () => {
  return useMutation({
    mutationKey: ["delete-contrat"],
    mutationFn: async ({ soccod, concod }: { soccod: string; concod: string }) => {
      return await ContratService.delete(soccod, concod);
    },
  });
};

export default useDeleteContrat;
