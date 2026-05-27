import { useQuery } from "@tanstack/react-query";
import EtatPresenceService from "../../services/PersenceService/EtatPresenceService";
import { useAuth } from "../../components/helper/AuthProvider";

// Date considérée utilisable côté backend = Date JS valide (pas NaN). Sans ce
// garde, un input vidé ou un transitoire de re-render (string state "" passée
// à `new Date()`) produisait un Invalid Date, et `formatDate(date).toISOString()`
// jetait `RangeError: Invalid time value`, crashant TOUTE la page État Présence.
const isValidDate = (d: Date | null | undefined): d is Date =>
  d instanceof Date && !Number.isNaN(d.getTime());

const useGetEtatPresence = (
  datedebut: Date,
  datefin: Date,
  empcods: string[] = [],
  regime: string,
) => {
  const { soccod } = useAuth();

  const datesValid = isValidDate(datedebut) && isValidDate(datefin);

  // formatDate ne doit plus jamais crasher : si la date est invalide on retourne
  // une chaîne vide (le `enabled` ci-dessous coupe de toute façon la requête).
  const formatDate = (date: Date) =>
    isValidDate(date) ? date.toISOString().split('T')[0] : '';
  const formattedDebut = datesValid ? formatDate(datedebut) + "T00:00:00" : '';
  const formattedFin   = datesValid ? formatDate(datefin)   + "T00:00:00" : '';

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
    // ⚠ datesValid AVANT le check empcods : un changement de mois peut
    // transitoirement passer une date invalide ; il faut tenir la query off
    // tant que les bornes ne sont pas propres.
    enabled: !!soccod && datesValid && !!regime && empcods.length !== 0,
  });
};

export default useGetEtatPresence;