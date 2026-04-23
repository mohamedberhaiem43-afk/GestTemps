import { useMutation } from "react-query";
import { useAuth } from "../../components/helper/AuthProvider";
import CalendService from "../../services/CalendrierService/CalendService";

const useCloneCalendrier = () => {
  const { soccod } = useAuth();

  return useMutation((annee: number) =>
    CalendService.postWithoutParams(`clone/${soccod}/${annee}`)
  );
};

export default useCloneCalendrier;
