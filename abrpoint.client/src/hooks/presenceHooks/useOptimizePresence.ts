// useOptimizePresence.ts
import { useMutation } from "@tanstack/react-query";
import OptimiserPointageService from "../../services/PersenceService/OptimiserPointageService";

const useOptimisePresence = () => {
  return useMutation({
    mutationFn: async ({
      soccod,
      empMat,
      dateDeb,
      dateFin,
    }: {
      soccod: string;
      empMat: string;
      dateDeb: string;
      dateFin: string;
    }) => {
      return await OptimiserPointageService.putWithManyParams(
        soccod,
        empMat,
        dateDeb,
        dateFin
      );
    },
  });
};

export default useOptimisePresence;
