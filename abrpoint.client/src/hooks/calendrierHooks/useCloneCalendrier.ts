import { useMutation } from "@tanstack/react-query";
import { useAuth } from "../../components/helper/AuthProvider";
import CalendService from "../../services/CalendrierService/CalendService";

const useCloneCalendrier = () => {
  const { soccod } = useAuth();

  return useMutation({
    mutationFn: (annee: number) =>
      CalendService.postWithoutParams(`clone/${soccod}/${annee}`),
  });
};

export default useCloneCalendrier;
