import { useQuery } from "react-query";
import EtatAbsenceService from "../../services/AbsenceService/EtatAbsenceService";

const useGetEtatAbsence = (
  datedebut: Date,
  datefin: Date,
  empcods: string[] = [],
  absaut: boolean,
  absret: boolean,
  presNonOpt: boolean,
  sansPointageInvalide: boolean,
  selectedAbstype: string,
) => {
  const soccod = sessionStorage.getItem('soccod');

  const formatDate = (date: Date) => date.toISOString().split('T')[0]; // yyyy-MM-dd
  const formattedDebut = formatDate(datedebut)+"T00:00:00";
  const formattedFin = formatDate(datefin)+"T00:00:00";


  const params = new URLSearchParams();
  empcods?.forEach(cod => params.append("empcods", cod));

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
      selectedAbstype
    ],
    queryFn: () =>
      EtatAbsenceService.getAllWithParams(
        `get-etat-absence/${soccod}/${formattedDebut}/${formattedFin}/${absaut}/${absret}/${presNonOpt}/${sansPointageInvalide}/0?${params.toString()}`
      ),
    enabled: !!soccod && !!datedebut && !!datefin,
  });
};

export default useGetEtatAbsence;
