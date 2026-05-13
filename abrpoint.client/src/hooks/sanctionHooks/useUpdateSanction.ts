import { useMutation, useQueryClient } from "@tanstack/react-query";
import SanctionService from "../../services/SanctionService/SanctionService";
import { Sanction } from "../../models/Sanction";

const useUpdateSanction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["Sanction"],
    mutationFn: (sanction: Sanction) =>
      SanctionService.putWithoutParams(sanction),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sanction"] });
    },
  });
};

export default useUpdateSanction;