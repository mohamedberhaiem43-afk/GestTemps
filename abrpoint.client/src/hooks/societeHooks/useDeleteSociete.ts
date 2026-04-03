import SocieteService from "../../services/SocieteService/SocieteService";
import { useMutation } from "react-query";
import useGetSocietes from "./useGetSocietes";

const useDeleteSociete = () => {
 const {refetch} = useGetSocietes()
  return useMutation({
    mutationKey: ["societes"],
    mutationFn: ({ soccod }: { soccod: string;}) =>
      SocieteService.delete(soccod),
    onSuccess: () => {
      refetch();
    },
    onError: (error) => {
      console.error("Error deleting Societe:", error);
    },
  });
};

export default useDeleteSociete;
