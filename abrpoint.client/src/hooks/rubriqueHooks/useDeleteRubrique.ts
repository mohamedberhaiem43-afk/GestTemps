import { useMutation } from "react-query";
import RubriqueService from "../../services/RubriqueService/RubriqueService";

export default function useDeleteRubrique()  {
    const soccod = sessionStorage.getItem('soccod');
  
    return useMutation({
      mutationKey: ["rubriques", soccod],
      mutationFn: ({ rubcod }: { rubcod: string }) => RubriqueService.delete(`${soccod}/${rubcod}`)
    });
  };
  