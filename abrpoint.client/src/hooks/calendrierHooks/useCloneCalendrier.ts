import { useMutation } from "react-query";
import { useAuth } from "../../components/helper/AuthProvider";
import CalendService from "../../services/CalendrierService/CalendService";

const useCloneCalendrier = (
  annee: number,
) => {
  const { soccod } = useAuth();

  return useMutation(() =>
    CalendService.postWithoutParams(`clone/${soccod}/${annee}`)
  );
};

export default useCloneCalendrier;
