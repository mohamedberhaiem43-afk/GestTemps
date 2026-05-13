import { useQuery } from "@tanstack/react-query";
import apiInstance from "../../components/API/apiInstance";
import { useAuth } from "../../components/helper/AuthProvider";

/**
 * Récupère TOUTES les classes horaires d'une société, peu importe leur fréquence
 * (Périodique 'N' ET Selon pointage 'S'), en faisant les 2 appels en parallèle
 * et en concaténant les résultats. Évite à l'utilisateur d'avoir à basculer
 * entre les types pour voir l'ensemble de son paramétrage.
 *
 * Chaque ligne renvoyée porte son propre champ `catperiode` ('N' ou 'S'), donc
 * le composant qui consomme cette liste peut continuer à brancher sa logique
 * conditionnelle (mono-poste vs rotation hebdomadaire) sur la valeur de la ligne.
 */
const useGetAllLcategories = () => {
  const { soccod } = useAuth();

  return useQuery({
    queryKey: ["lcategories-all", soccod],
    queryFn: async () => {
      if (!soccod) return [] as any[];
      // 2 appels en parallèle : Promise.all évite la latence cumulée.
      const [periodique, selonPointage] = await Promise.all([
        apiInstance.get(`/Lcategories/${soccod}/N`).then(r => r.data ?? []),
        apiInstance.get(`/Lcategories/${soccod}/S`).then(r => r.data ?? []),
      ]);
      const merged = [
        ...(Array.isArray(periodique) ? periodique : []),
        ...(Array.isArray(selonPointage) ? selonPointage : []),
      ];
      return merged;
    },
    enabled: !!soccod,
  });
};

export default useGetAllLcategories;
