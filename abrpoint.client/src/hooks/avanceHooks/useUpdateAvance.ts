// ✅ useUpdateAvance.ts
import { useMutation } from "@tanstack/react-query";
import AvanceService from "../../services/AvanceService";

const useUpdateAvance = () => {
  return useMutation({
    mutationFn: ({
      mois,
      annee,
      niveau,
      empcod,
      montant,
    }: {
      mois: string;
      annee: string;
      niveau: string;
      empcod: string;
      montant: number;
    }) => {
      const soccod = sessionStorage.getItem("soccod");
      if (!soccod) throw new Error("soccod manquant");

      return AvanceService.putWithParams(
        `${soccod}/${mois}/${annee}/${empcod}/${niveau}/${montant}`
      );
    },
  });
};

export default useUpdateAvance;
