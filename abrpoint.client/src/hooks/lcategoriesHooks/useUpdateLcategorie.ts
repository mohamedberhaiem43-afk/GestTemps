import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Lcategorie } from "../../models/Lcategorie";
import LcategorieService from "../../services/LcategorieService/LcategorieService";

export default function useUpdateLcategorie() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["lcategorie-update"],
    mutationFn: (data: Lcategorie) => LcategorieService.putWithoutParams(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lcategories"] });
    },
  });
}
