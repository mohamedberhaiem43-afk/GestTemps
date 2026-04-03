import { useMutation } from "react-query";
import { Lcategorie } from "../../models/Lcategorie";
import LcategorieService from "../../services/LcategorieService/LcategorieService";

export default function usePostLcategorie() {

  return useMutation({
        mutationKey: ["lcategorie"],
        mutationFn: (data:Lcategorie) => LcategorieService.post(data),
  });
}
