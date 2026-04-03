import { useMutation } from "react-query";
import EmployeService from "../../services/EmployeService/EmployeService";
import { useAuth } from "../../components/helper/AuthProvider";

const useDeleteEmploye = () => {
    const { soccod } = useAuth();
  return useMutation({
    mutationKey: ["delete-employe"],
    mutationFn: async ({ empcod }: { empcod: string }) => {
      return await EmployeService.delete(soccod, empcod);
    },
  });
};

export default useDeleteEmploye;
