import { useQuery } from "@tanstack/react-query";
import PresenceService from "../../services/PersenceService/PresenceService";
import { useAuth } from "../../components/helper/AuthProvider";

const useGetPresence = (
  datedebut: Date,
  datefin: Date,
  regime: string,
  empcods?: string[] | null
) => {
  const { soccod } = useAuth();

  // date.toISOString() lève RangeError sur une Invalid Date (champ date vidé,
  // chaîne malformée…). Comme formatDate est appelé À CHAQUE rendu — avant le
  // garde `enabled` — un tel jet faisait planter le composant appelant (ex :
  // crash de l'État Retard au clic sur « Filtrer » après vidage d'une date).
  // On renvoie '' pour une date invalide ; la requête est alors désactivée.
  const isValid = (d: Date) => d instanceof Date && !Number.isNaN(d.getTime());
  const formatDate = (date: Date) => (isValid(date) ? date.toISOString().split('T')[0] : '');
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
    enabled: !!soccod && isValid(datedebut) && isValid(datefin) && !!regime,
    staleTime: 1000 * 60 * 5,
    retry: 2,
  });
};

export default useGetPresence;
