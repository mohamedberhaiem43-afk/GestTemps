import { useQuery } from "react-query";
import EtatPresenceService from "../../services/PersenceService/EtatPresenceService";

const useGetEtatPresence = (
  datedebut: Date,
  datefin: Date,
  //empcods: string[] = [],
  regime: string,
) => {
  const soccod = sessionStorage.getItem('soccod');

  const formatDate = (date: Date) => date.toISOString().split('T')[0]; // yyyy-MM-dd
  const formattedDebut = formatDate(datedebut)+"T00:00:00";
  const formattedFin = formatDate(datefin)+"T00:00:00";


  // const params = new URLSearchParams();
  //empcods?.forEach(cod => params.append("empcods", cod));

  return useQuery({
    queryKey: [
      "etat-absence",
      soccod,
      formattedDebut,
      formattedFin,
    //   empcods,
    //   absaut,
    //   absret,
    //   presNonOpt,
    //   sansPointageInvalide,
    //   selectedAbstype
    ],
    queryFn: () =>
      EtatPresenceService.getAllWithParams(
        `${soccod}/${formattedDebut}/${formattedFin}/${regime}`
      ),
    enabled: !!soccod && !!datedebut && !!datefin && !!regime,
  });
};

export default useGetEtatPresence;
