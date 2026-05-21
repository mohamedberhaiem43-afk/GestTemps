import { useMutation } from "@tanstack/react-query";
import EmployeService from "../../services/EmployeService/EmployeService";
import Employe from "../../models/Employe";

const useUpdateEmploye = () => {
  return useMutation({
    mutationKey: ["employe"],
    mutationFn: (employe: Employe) => {
      if (!employe || typeof employe !== 'object') {
        return Promise.reject(new Error("Données de l'employé non valides"));
      }
      // Identifier précisément le(s) champ(s) manquant(s) pour que le snackbar
      // utilisateur explique quoi corriger (avant : « Données de l'employé non
      // valides » générique → « Erreur lors de la sauvegarde » dans le fallback
      // i18n du onError, l'utilisateur ne savait pas que la filiale manquait).
      const missing: string[] = [];
      if (!employe.empcod) missing.push('matricule');
      if (!employe.soccod) missing.push('société');
      if (!employe.sitcod) missing.push('filiale (site)');
      if (missing.length > 0) {
        return Promise.reject(new Error(`Champs obligatoires manquants : ${missing.join(', ')}.`));
      }
      return EmployeService.putObject(`update-employe`, employe);
    },
  });
};

export default useUpdateEmploye;
