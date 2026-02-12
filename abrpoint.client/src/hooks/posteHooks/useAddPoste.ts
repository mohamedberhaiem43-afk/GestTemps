import { useMutation } from "react-query";
import { Poste } from "../../models/Poste";
import PosteService from "../../services/PosteService";

const useAddPoste = () => {
  return useMutation({
    mutationKey: ["postes"],
    mutationFn: async (data: Poste) => {
      const res = await PosteService.post(data);
      return res;
    },
  });
};

export default useAddPoste;
