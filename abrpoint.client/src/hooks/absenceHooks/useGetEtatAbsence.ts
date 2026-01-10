import { useQuery } from "react-query";
import EtatAbsenceService from "../../services/AbsenceService/EtatAbsenceService";
import { useAuth } from "../../components/helper/AuthProvider";

const useGetEtatAbsence = (
  datedebut: Date,
  datefin: Date,
  empcods: string[] | null,
  absaut: boolean,
  absret: boolean,
  presNonOpt: boolean,
  sansPointageInvalide: boolean,
  selectedAbstype: string,
) => {
  const { soccod } = useAuth();

  const formatDate = (date: Date) => date.toISOString().split('T')[0];
  const formattedDebut = formatDate(datedebut) + "T00:00:00";
  const formattedFin = formatDate(datefin) + "T00:00:00";

  const params = new URLSearchParams();
  // Vérifiez que empcods existe et est un tableau
  if (empcods && Array.isArray(empcods)) {
    empcods.forEach(cod => params.append("empcods", cod));
  }
  
  console.log("empcods:", empcods);

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
    // La requête se lance seulement si les dates sont définies
    enabled: !!soccod && !!datedebut && !!datefin && (empcods !== null && empcods.length > 0),
  });
};

export default useGetEtatAbsence;