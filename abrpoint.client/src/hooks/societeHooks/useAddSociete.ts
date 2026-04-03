import SocieteService from "../../services/SocieteService/SocieteService";
import { useMutation } from "react-query";

const useAddSociete = () => {

  return useMutation({
    mutationKey: ["societes"],
    mutationFn: SocieteService.post
  });
};

export default useAddSociete;
