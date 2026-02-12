import { useMutation } from "react-query";
import EmployeService from "../../services/EmployeService/EmployeService";
import Employe from "../../models/Employe";

const useAddEmploye = () => {
  return useMutation({
    mutationKey: ["employe"],
    mutationFn: (employe: Employe) => {
      if (!employe || typeof employe !== 'object' || employe.empcod == '') {
        return Promise.reject(new Error("Données de l'employé non valides"));
      }
      return EmployeService.post(employe);
    },
  });
};

export default useAddEmploye;
