import { useQuery } from "react-query";
import EtatPresenceService from "../../services/PersenceService/EtatPresenceService";
import { useAuth } from "../../components/helper/AuthProvider";

const useGetEtatPresence = (
  datedebut: Date,
  datefin: Date,
  empcods: string[] = [],
  regime: string,
) => {
  const { soccod } = useAuth();

  const formatDate = (date: Date) => date.toISOString().split('T')[0]; // yyyy-MM-dd
  const formattedDebut = formatDate(datedebut) + "T00:00:00";
  const formattedFin = formatDate(datefin) + "T00:00:00";

  const params = new URLSearchParams();
  empcods?.forEach(cod => params.append("empcods", cod));
  return useQuery({
    queryKey: [
      "etat-absence",
      soccod,
      formattedDebut,
      formattedFin,
      empcods,
      regime, // Added regime to queryKey for proper cache invalidation
    ],
    queryFn: () =>
      EtatPresenceService.getAllWithBody(
        `${soccod}/${formattedDebut}/${formattedFin}/${regime}?${params.toString()}`,
        params // Pass the params here if your service expects it
      ),
    enabled: !!soccod && !!datedebut && !!datefin && !!regime && empcods.length !== 0,
  });
};

export default useGetEtatPresence;