import { useMutation } from "@tanstack/react-query";
import ParametreService from "../../services/ParametreService/ParametreService";
import { useAuth } from "../../components/helper/AuthProvider";

const useAddLogoSoc = () => {
  const { soccod } = useAuth();
  return useMutation({
    mutationKey: ["logo-soc",soccod],
    mutationFn: (file: any) =>
      ParametreService.postWithParams(`upload-logo/${soccod}`, file),
  });
};

export default useAddLogoSoc;
