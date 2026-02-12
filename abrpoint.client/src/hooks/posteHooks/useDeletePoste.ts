import { useMutation } from "react-query";
import PosteService from "../../services/PosteService";

const useDeletePoste = () => {
  return useMutation({
    mutationKey: ["poste"],
    mutationFn: async ({ soccod, poscod }: { soccod: string; poscod: string }) => {
      const response = await PosteService.delete(soccod, poscod);
      return response;
    },
  });
};

export default useDeletePoste;
