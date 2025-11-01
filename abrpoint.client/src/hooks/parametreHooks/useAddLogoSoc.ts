import { useMutation } from "@tanstack/react-query";
import ParametreService from "../../services/ParametreService/ParametreService";

const useAddLogoSoc = () => {
  return useMutation({
    mutationKey: ["logo-soc"],
    mutationFn: (file: any) =>
      ParametreService.postWithParams("upload-logo", file),
  });
};

export default useAddLogoSoc;
