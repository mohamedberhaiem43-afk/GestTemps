import { useMutation } from "react-query";
import RubriqueService from "../../services/RubriqueService/RubriqueService";
import { useAuth } from "../../components/helper/AuthProvider";

export default function useDeleteRubrique()  {
    const { soccod } = useAuth();
  
    return useMutation({
      mutationKey: ["rubriques", soccod],
      mutationFn: ({ rubcod }: { rubcod: string }) => RubriqueService.delete(`${soccod}/${rubcod}`)
    });
  };
  