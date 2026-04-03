import { useQuery } from "react-query";
import PresenceService from "../../services/PersenceService/PresenceService";
import { useAuth } from "../../components/helper/AuthProvider";

const useGetPresence = (
  datedebut: Date,
  datefin: Date,
  regime: string,
  empcods?: string[] | null
) => {
  const { soccod } = useAuth();

  const formatDate = (date: Date) => date.toISOString().split('T')[0];
  const formattedDebut = formatDate(datedebut) + "T00:00:00";
  const formattedFin = formatDate(datefin) + "T00:00:00";

  const params: Record<string, string | string[]> = {};
  if (empcods && empcods.length > 0) {
    params.empcods = empcods;
  }

  return useQuery({
    queryKey: ["etat-presence", soccod, formattedDebut, formattedFin, regime, empcods],
    queryFn: () =>
      PresenceService.getAllWithParamsObject(
        `${soccod}/${formattedDebut}/${formattedFin}/${regime}`,
        params
      ),
    enabled: !!soccod && !!datedebut && !!datefin && !!regime,
    staleTime: 1000 * 60 * 5,
    retry: 2,
    onError: (error) => {
      console.error("Error fetching presence data:", error);
    }
  });
};

export default useGetPresence;
