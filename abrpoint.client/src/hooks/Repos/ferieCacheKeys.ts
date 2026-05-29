import type { QueryClient } from "@tanstack/react-query";

// Vues dont les calculs côté serveur dépendent des jours fériés / repos. Après une
// création / modification / suppression de férié, ces caches React Query (staleTime 5 min)
// doivent être invalidés — sinon l'État Périodique, le Pointage du Mois, etc. continuent
// d'afficher les anciennes valeurs jusqu'au rafraîchissement de la page.
const FERIE_DEPENDENT_KEYS = [
  'repos',            // liste des fériés (useGetRepos)
  'emp-etat',         // État Périodique (useGetEmpEtat)
  'etat-presence',    // État de présence
  'etat-retard',      // État des retards
  'pointage-mois',    // Pointage du mois
  'cumul-calendrier', // Cumul heures mensuelles
  'calendrier',       // Calendrier société
  'calendriers',
];

export function invalidateFerieDependentCaches(qc: QueryClient) {
  qc.invalidateQueries({
    predicate: (q) => {
      const k = q.queryKey?.[0];
      return typeof k === 'string' && FERIE_DEPENDENT_KEYS.includes(k);
    },
  });
}
