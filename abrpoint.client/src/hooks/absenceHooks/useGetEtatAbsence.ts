import { useQuery } from "@tanstack/react-query";
import EtatAbsenceService from "../../services/AbsenceService/EtatAbsenceService";
import { useAuth } from "../../components/helper/AuthProvider";

const isValidDate = (date: Date | null | undefined): date is Date => {
  return date instanceof Date && !Number.isNaN(date.getTime());
};

const formatDate = (date: Date | null | undefined) => {
  if (!isValidDate(date)) {
    return null;
  }

  return date.toISOString().split("T")[0];
};

const useGetEtatAbsence = (
  datedebut: Date,
  datefin: Date,
  empcods: string[] | null,
  absaut: boolean,
  absret: boolean,
  presNonOpt: boolean,
  sansPointageInvalide: boolean,
  radioValue: string,
) => {
  const { soccod } = useAuth();

  const formattedDebutDate = formatDate(datedebut);
  const formattedFinDate = formatDate(datefin);
  const formattedDebut = formattedDebutDate ? `${formattedDebutDate}T00:00:00` : "";
  const formattedFin = formattedFinDate ? `${formattedFinDate}T00:00:00` : "";
  const hasSelectedEmployees = Array.isArray(empcods) && empcods.length > 0;
  const hasValidDates = Boolean(formattedDebutDate && formattedFinDate);

  const params = new URLSearchParams();
  if (Array.isArray(empcods)) {
    empcods.forEach((cod) => params.append("empcods", cod));
  }

  return useQuery({
    queryKey: [
      "etat-absence",
      soccod,
      formattedDebut,
      formattedFin,
      empcods,
      absaut,
      absret,
      presNonOpt,
      sansPointageInvalide,
      radioValue,
    ],
    queryFn: () =>
      EtatAbsenceService.getAllWithParams(
        `get-etat-absence/${soccod}/${formattedDebut}/${formattedFin}/${absaut}/${absret}/${presNonOpt}/${sansPointageInvalide}/${radioValue}?${params.toString()}`
      ),
    enabled: Boolean(soccod) && hasValidDates && hasSelectedEmployees,
  });
};

export default useGetEtatAbsence;
