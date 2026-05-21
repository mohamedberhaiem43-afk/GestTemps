import { useMutation } from "@tanstack/react-query";
import EmployeService from "../../services/EmployeService/EmployeService";
import Employe from "../../models/Employe";

const useAddEmploye = () => {
  return useMutation({
    mutationKey: ["employe"],
    mutationFn: (employe: Employe) => {
      if (!employe || typeof employe !== 'object') {
        return Promise.reject(new Error("Données de l'employé non valides"));
      }
      // Détail des champs manquants : le caller peut alors afficher un message
      // exploitable au lieu du générique « Erreur lors de la sauvegarde ».
      const missing: string[] = [];
      if (!employe.empcod) missing.push('matricule');
      if (!employe.soccod) missing.push('société');
      if (!employe.sitcod) missing.push('filiale (site)');
      if (missing.length > 0) {
        return Promise.reject(new Error(`Champs obligatoires manquants : ${missing.join(', ')}.`));
      }
      return EmployeService.post(employe);
    },
  });
};

export default useAddEmploye;
