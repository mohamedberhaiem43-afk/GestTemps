using ABRPOINT.Helper;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.CalculService.HeureSupp
{
    public class HeureSuppSerivce : IHeureSuppService
    {
        private readonly ILcategorieRepository  _categorieRepository;
        private readonly IParametreRepository  _parametreRepository;
        private readonly IPosteRepository  _posteRepository;
        public HeureSuppSerivce(ILcategorieRepository categorieRepository, IParametreRepository parametreRepository, IPosteRepository posteRepository)
        {
            _categorieRepository = categorieRepository;
            _parametreRepository = parametreRepository;
            _posteRepository = posteRepository;
        }

        // ─────────────────────────────────────────────────────────────────────
        // RÈGLE DE CALCUL DES HEURES SUPPLÉMENTAIRES — révision 2026-06.
        //
        // Décision produit : les heures supp d'une journée ne sont comptées
        // qu'À PARTIR DU DÉPASSEMENT des heures PLANIFIÉES du poste pour ce jour.
        //
        //     H.Sup (jour) = max(0, heures travaillées − heures planifiées du jour)
        //
        // Exemple : poste de 8h/jour, salarié présent 9h → 1h supplémentaire.
        //
        // « Heures planifiées du jour » = somme des plages matin (hdmat→hfmat) et
        // après-midi (hdam→hfam) configurées sur le poste pour ce jour de la
        // semaine (cf. ComputePlannedDailyHours). La pause repas (hdrep→hfrep)
        // n'appartient pas à ces plages, elle est donc déjà exclue du seuil.
        //
        // Cette règle REMPLACE l'ancien modèle « hors-plage » (qui comptait les
        // minutes pointées avant l'heure d'entrée prévue, après l'heure de sortie,
        // ou pendant la pause). On ne raisonne plus sur les bornes horaires mais
        // sur le volume total travaillé vs le volume planifié.
        // ─────────────────────────────────────────────────────────────────────

        public async Task<double> CalculateHeureSuppOptimise(PresenceDto presence, Poste poste)
        {
            if (presence == null) throw new ArgumentNullException(nameof(presence));
            if (poste == null)
            {
                string? codpost = await _posteRepository.GetEmpPoste(presence.Soccod, presence.Empcod, presence.Predat, presence.Catcod);
                if (string.IsNullOrEmpty(codpost))
                    codpost = presence.Codposte;
                poste = await _posteRepository.GetPoste(presence.Soccod, codpost);
            }
            try
            {
                string? cathsup = await _categorieRepository.GetCathsup(presence.Soccod, presence.Empcod);

                if (cathsup == "0")
                    return 0;

                return ComputeDailyOvertime(presence, poste);
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<double> CalculateHeureSupp(PresenceDto presence, Poste poste)
        {
            if (presence == null) throw new ArgumentNullException(nameof(presence));
            if (poste == null) throw new ArgumentNullException(nameof(poste));

            // Valeur déjà calculée/validée et persistée : on la respecte (le
            // recalcul ne ré-écrase pas une H.Sup confirmée par un manager).
            if (!string.IsNullOrEmpty(presence.Tothsup) && presence.Tothsup != "-")
            {
                var convertedValue = GenericMethodes.ConvertHHmmToDouble(presence.Tothsup);
                if (convertedValue.HasValue)
                {
                    return convertedValue.Value;
                }
            }

            try
            {
                string? cathsup = await _categorieRepository.GetCathsup(presence.Soccod, presence.Empcod);

                if (cathsup == "0")
                    return 0;

                return ComputeDailyOvertime(presence, poste);
            }
            catch (Exception)
            {
                throw;
            }
        }

        /// <summary>
        /// Cœur du calcul (partagé par les deux entrées publiques) :
        /// H.Sup = max(0, heures travaillées − heures planifiées du poste ce jour).
        /// </summary>
        private double ComputeDailyOvertime(PresenceDto presence, Poste poste)
        {
            // 🛌 JOUR DE REPOS — aucune plage n'est prévue, donc toute heure
            // travaillée est par définition supplémentaire. On retombe sur le
            // total travaillé (Tothre), planché à 0 pour neutraliser un Tothre
            // négatif issu d'un ancien calcul.
            if (presence.Prerepos == "1")
            {
                var tRepos = GenericMethodes.ConvertHHmmToDouble(presence.Tothre) ?? 0;
                return tRepos > 0 ? tRepos : 0;
            }

            double workedHours = GenericMethodes.ConvertHHmmToDouble(presence.Tothre) ?? 0;
            if (workedHours <= 0)
                return 0;

            double plannedHours = ComputePlannedDailyHours(presence, poste);

            // Poste sans plage configurée pour ce jour (et hors jour de repos) :
            // on ne génère pas d'H.Sup « fantôme » à partir d'un poste mal
            // paramétré — comportement conservateur identique à l'ancien
            // garde-fou (retour 0 quand aucune heure d'entrée n'était définie).
            if (plannedHours <= 0)
                return 0;

            double overtime = workedHours - plannedHours;
            return overtime > 0 ? overtime : 0;
        }

        /// <summary>
        /// Heures planifiées du poste pour le jour de la présence = somme des
        /// durées des plages matin (hdmat→hfmat) et après-midi (hdam→hfam)
        /// configurées sur le poste pour ce jour de la semaine. La pause repas
        /// (hdrep→hfrep) n'est pas comprise dans ces plages, elle est donc déjà
        /// exclue. Sert de seuil au-delà duquel les heures travaillées deviennent
        /// supplémentaires.
        /// </summary>
        private double ComputePlannedDailyHours(PresenceDto presence, Poste poste)
        {
            var (morningStart, morningEnd, eveningStart, eveningEnd) =
                GenericMethodes.GetStartsWorkDay(presence.Dmdate, poste);

            double SessionHours(string? start, string? end)
            {
                var s = ParseOrZero(start);
                var e = ParseOrZero(end);
                // Une plage absente est représentée par une borne à zéro (champ
                // poste vide) → durée nulle, la session n'est pas comptée.
                if (s == TimeSpan.Zero || e == TimeSpan.Zero) return 0;
                double h = (e - s).TotalHours;
                return h > 0 ? h : 0;
            }

            return SessionHours(morningStart, morningEnd) + SessionHours(eveningStart, eveningEnd);
        }

        /// <summary>
        /// Parse un TimeSpan à partir d'une chaîne, sinon retourne TimeSpan.Zero.
        /// </summary>
        private TimeSpan ParseOrZero(string? value)
        {
            return TimeSpan.TryParse(value, out var ts) ? ts : TimeSpan.Zero;
        }
    }
}
