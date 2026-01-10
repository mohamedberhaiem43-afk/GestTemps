import { useQuery } from "react-query";
import PresenceService from "../../services/PersenceService/PresenceService";
import { useAuth } from "../../components/helper/AuthProvider";

const useGetPresence = (
  datedebut: Date,
  datefin: Date,
  regime: string,
  empcods?: string[]|null
) => {
  const { soccod } = useAuth();
  
  // Format dates to ISO strings without time (yyyy-MM-dd)
  const formatDate = (date: Date) => date.toISOString().split('T')[0];
  const formattedDebut = formatDate(datedebut) + "T00:00:00";
  const formattedFin = formatDate(datefin) + "T00:00:00";

  // Create query parameters object
  const params = new URLSearchParams();
  
  // Add each empcod as a separate parameter
  if (empcods && empcods.length > 0) {
    empcods.forEach(cod => params.append("empcods", cod));
  }


  return useQuery({
    queryKey: [
      "etat-presence",
      soccod,
      formattedDebut,
      formattedFin,
      regime,
      empcods
    ],
    queryFn: () =>
      PresenceService.getAllWithBody(
        `${soccod}/${formattedDebut}/${formattedFin}/${regime}?${params.toString()}`,
        { params }  // Pass the URLSearchParams object
      ),
    enabled: !!soccod && !!datedebut && !!datefin && !!regime,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 2,
    onError: (error) => {
      console.error("Error fetching presence data:", error);
    }
  });
};

export default useGetPresence;