import { useMutation } from "react-query";
import CalendrierService from "../../services/CalendrierService/CalendrierService";

const useUpdateCalendrier = (
  caltype: string,
  annee: string,
  mois: string,
  nbhJours: number,
  nbhSamedi: number,
  tousMois: 0 | 1,
  jourRepos: string
) => {
  const soccod = localStorage.getItem("soccod") || "01";

  return useMutation(() =>
    CalendrierService.putWithParams(
      `update-calendrier/${soccod}/${caltype}/${annee}/${tousMois}/${mois}/${nbhJours}/${jourRepos}/${nbhSamedi}`
    )
  );
};

export default useUpdateCalendrier;
