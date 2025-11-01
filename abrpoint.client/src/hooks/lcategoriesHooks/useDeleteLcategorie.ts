import { useMutation } from "react-query";
import { Lcategorie } from "../../models/Lcategorie";
import LcategorieService from "../../services/LcategorieService/LcategorieService";

export default function useDeleteLcategorie() {

  return useMutation({
        mutationKey: ["lcategorie"],
        mutationFn: (data:Lcategorie) => LcategorieService.deleteObject(data),
  });
}
