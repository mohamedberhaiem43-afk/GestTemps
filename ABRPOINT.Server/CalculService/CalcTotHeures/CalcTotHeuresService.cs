using ABRPOINT.Server.CalculService.HeureRetard;
using ABRPOINT.Server.CalculService.HeureSupp;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.CalculService.CalcTotHeures
{
    public class CalcTotHeuresService : ICalcTotHeuresService
    {
        private readonly IParametreRepository _parametreRepository;
        private readonly IautoriserRepository _autorisationRepository;
        private readonly IPosteRepository _posteRepository;
        private readonly IHeureSuppService _heureSuppService;
        private readonly IHeureRetardService _heureRetardService;
        public CalcTotHeuresService(IParametreRepository parametreRepository,IautoriserRepository autorisationRepository,
            IPosteRepository posteRepository,IHeureSuppService heureSuppService, IHeureRetardService heureRetardService)
        {
            _parametreRepository = parametreRepository;
            _autorisationRepository = autorisationRepository;
            _posteRepository = posteRepository;
            _heureSuppService = heureSuppService;
            _heureRetardService = heureRetardService;
        }
        public async Task<(float? nbHeurSupp, int nbRetard)> CalculateDayWorkMetrics(PresenceDto presence)
        {
            try
            {
                Poste? poste = await _posteRepository.GetPoste(presence.Soccod, presence.Codposte);
                if (poste == null) return (0, 0);
                AutDto autorisation = await _autorisationRepository.GetAutLib(presence.Soccod, presence.Empcod, (DateTime)presence.Dmdate);
                return ((float?)await _heureSuppService.CalculateHeureSupp(presence, poste), (await _heureRetardService.CalculateHeureRetard(presence, poste, autorisation)).Item1);
            }
            catch (Exception ex)
            {
                // Consider logging the error here
                throw new ApplicationException("Error calculating work metrics", ex);
            }
        }
        public async Task<(float? nbHeurSupp, int nbRetard)> CalculateDayWorkMetricsOptimise(PresenceDto presence)
        {
            try
            {
                Poste? poste = await _posteRepository.GetPoste(presence.Soccod, presence.Codposte);
                if (poste == null) return (0, 0);
                AutDto autorisation = await _autorisationRepository.GetAutLib(presence.Soccod, presence.Empcod, (DateTime)presence.Dmdate);
                return ((float?)await _heureSuppService.CalculateHeureSuppOptimise(presence, poste), (await _heureRetardService.CalculateHeureRetard(presence, poste, autorisation)).Item1);
            }
            catch (Exception ex)
            {
                // Consider logging the error here
                throw new ApplicationException("Error calculating work metrics", ex);
            }
        }
        public async Task<string?> CalcHreTravOptimise(PresenceDto presence)
        {
            try
            {
                if (presence == null || string.IsNullOrEmpty(presence.Codposte) || presence.Dmdate == null)
                    return null;

                // 🔹 Étape 1 : Récupérer paramètre d'arrondi
                var param = await _parametreRepository.GetEtatPeriodiqueParamAsync(presence.Soccod);
                float arrondi = param?.Arrondi ?? 0f; // ⚠️ en MINUTES maintenant

                // 🔹 Étape 2 : Récupérer autorisation et poste
                AutDto? autorisation = await _autorisationRepository.GetAutLib(presence.Soccod, presence.Empcod, presence.Dmdate.Value);
                Poste? poste = await _posteRepository.GetPoste(presence.Soccod, presence.Codposte);

                if (poste == null) return null;

                float totalPosteJourHeures = await _posteRepository.GetJourHeures(presence.Soccod, presence.Dmdate, presence.Codposte) ?? 0f;

                // 🔹 Étape 3 : Calcul des heures travaillées
                //
                // L'ancienne formule `posteHeures + supp - retard` cumulait les erreurs
                // des deux services (retard parfois calculé contre une plage différente,
                // supp ne couvrant pas une pause-déjeuner raccourcie) → Tothre pouvait
                // afficher 04h47 alors que les pointages réels donnaient 05h47.
                //
                // Quand les 4 pointages sont présents (matin + après-midi), on additionne
                // simplement les durées réellement passées au travail — c'est ce que
                // l'utilisateur attend de voir sur la fiche journalière. On ne retombe
                // sur l'ancienne formule que pour les postes continus ou les pointages
                // partiels où on n'a pas les 2 plages.
                var (nbHeurSupp, nbRetard) = await CalculateDayWorkMetricsOptimise(presence);
                float totalHeures = ComputeWorkedHoursFromPunches(presence)
                                    ?? (totalPosteJourHeures + (((float)nbHeurSupp - nbRetard) / 60f));

                // 🔹 Étape 4 : Ajouter heures autorisées si absence partielle
                if (autorisation?.Condep != null && autorisation?.Conret != null)
                {
                    TimeSpan authStart = autorisation.Condep.Value.TimeOfDay;
                    TimeSpan authEnd = autorisation.Conret.Value.TimeOfDay;

                    List<(TimeSpan start, TimeSpan end)> presencePeriods = new();

                    if (TimeSpan.TryParse(presence.Preentmatup, out var entMat) && TimeSpan.TryParse(presence.Presortmatup, out var sortMat))
                        presencePeriods.Add((entMat, sortMat));

                    if (TimeSpan.TryParse(presence.Preentamidiup, out var entPm) && TimeSpan.TryParse(presence.Presortamidiup, out var sortPm))
                        presencePeriods.Add((entPm, sortPm));

                    TimeSpan totalAuthNotWorked = TimeSpan.Zero;
                    var authPeriod = (start: authStart, end: authEnd);

                    foreach (var period in GetOverlappingPeriods(authPeriod, presencePeriods))
                        totalAuthNotWorked += period;

                    TimeSpan authTotal = authEnd - authStart;
                    TimeSpan authNotWorked = authTotal - totalAuthNotWorked;
                    totalHeures += (float)authNotWorked.TotalHours;
                }

                // 🔹 Étape 5 : Appliquer arrondi (EN MINUTES)
                if (arrondi > 0)
                {
                    // Convertir les heures en minutes
                    float totalMinutes = totalHeures * 60f;

                    // Arrondir au multiple supérieur
                    totalMinutes = (float)(Math.Ceiling(totalMinutes / arrondi) * arrondi);

                    // Reconvertir en heures
                    totalHeures = totalMinutes / 60f;
                }

                // 🔹 Étape 6 : Formatage en hh:mm
                TimeSpan totalHeureTimeSpan = TimeSpan.FromHours(totalHeures);
                presence.Tothre = $"{totalHeureTimeSpan.Hours:D2}:{totalHeureTimeSpan.Minutes:D2}";

                // 🔹 Étape 7 : Contrôle des plafonds
                //EtatPresenceParametreDto presenceParam = await _parametreRepository.GetEtatPresenceParametres(presence.Soccod);

                //if (presenceParam.Nbhtr3M.HasValue && totalHeures > presenceParam.Nbhtr3M.Value)
                //{
                //    presence.Tothre = presenceParam.Tauxtr3M?.ToString("0.##");
                //}

                return presence.Tothre;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<string?> CalcHreTrav(PresenceDto presence)
        {
            try
            {
                if (presence == null || string.IsNullOrEmpty(presence.Codposte) || presence.Dmdate == null)
                    return null;

                // 🔹 Étape 1 : Récupérer paramètre d'arrondi
                var param = await _parametreRepository.GetEtatPeriodiqueParamAsync(presence.Soccod);
                float arrondi = param?.Arrondi ?? 0f; // ⚠️ en MINUTES maintenant

                // 🔹 Étape 2 : Récupérer autorisation et poste
                AutDto? autorisation = await _autorisationRepository.GetAutLib(presence.Soccod, presence.Empcod, presence.Dmdate.Value);
                Poste? poste = await _posteRepository.GetPoste(presence.Soccod, presence.Codposte);

                if (poste == null) return null;

                float totalPosteJourHeures = await _posteRepository.GetJourHeures(presence.Soccod, presence.Dmdate, presence.Codposte) ?? 0f;

                // 🔹 Étape 3 : Calcul des heures travaillées (cf. CalcHreTravOptimise pour le détail)
                var (nbHeurSupp, nbRetard) = await CalculateDayWorkMetrics(presence);
                float totalHeures = ComputeWorkedHoursFromPunches(presence)
                                    ?? (totalPosteJourHeures + (((float)nbHeurSupp - nbRetard) / 60f));

                // 🔹 Étape 4 : Ajouter heures autorisées si absence partielle
                if (autorisation?.Condep != null && autorisation?.Conret != null)
                {
                    TimeSpan authStart = autorisation.Condep.Value.TimeOfDay;
                    TimeSpan authEnd = autorisation.Conret.Value.TimeOfDay;

                    List<(TimeSpan start, TimeSpan end)> presencePeriods = new();

                    if (TimeSpan.TryParse(presence.Preentmatup, out var entMat) && TimeSpan.TryParse(presence.Presortmatup, out var sortMat))
                        presencePeriods.Add((entMat, sortMat));

                    if (TimeSpan.TryParse(presence.Preentamidiup, out var entPm) && TimeSpan.TryParse(presence.Presortamidiup, out var sortPm))
                        presencePeriods.Add((entPm, sortPm));

                    TimeSpan totalAuthNotWorked = TimeSpan.Zero;
                    var authPeriod = (start: authStart, end: authEnd);

                    foreach (var period in GetOverlappingPeriods(authPeriod, presencePeriods))
                        totalAuthNotWorked += period;

                    TimeSpan authTotal = authEnd - authStart;
                    TimeSpan authNotWorked = authTotal - totalAuthNotWorked;
                    totalHeures += (float)authNotWorked.TotalHours;
                }

                // 🔹 Étape 5 : Appliquer arrondi (EN MINUTES)
                if (arrondi > 0)
                {
                    // Convertir les heures en minutes
                    float totalMinutes = totalHeures * 60f;

                    // Arrondir au multiple supérieur
                    totalMinutes = (float)(Math.Ceiling(totalMinutes / arrondi) * arrondi);

                    // Reconvertir en heures
                    totalHeures = totalMinutes / 60f;
                }

                // 🔹 Étape 6 : Formatage en hh:mm
                TimeSpan totalHeureTimeSpan = TimeSpan.FromHours(totalHeures);
                presence.Tothre = $"{totalHeureTimeSpan.Hours:D2}:{totalHeureTimeSpan.Minutes:D2}";

                // 🔹 Étape 7 : Contrôle des plafonds
                //EtatPresenceParametreDto presenceParam = await _parametreRepository.GetEtatPresenceParametres(presence.Soccod);

                //if (presenceParam.Nbhtr3M.HasValue && totalHeures > presenceParam.Nbhtr3M.Value)
                //{
                //    presence.Tothre = presenceParam.Tauxtr3M?.ToString("0.##");
                //}

                return presence.Tothre;
            }
            catch (Exception)
            {
                throw;
            }
        }
        public List<TimeSpan> GetOverlappingPeriods((TimeSpan start, TimeSpan end) basePeriod, List<(TimeSpan start, TimeSpan end)> workedPeriods)
        {
            List<TimeSpan> overlaps = new();

            foreach (var work in workedPeriods)
            {
                if (work.end <= basePeriod.start || work.start >= basePeriod.end)
                    continue;

                var overlapStart = work.start > basePeriod.start ? work.start : basePeriod.start;
                var overlapEnd = work.end < basePeriod.end ? work.end : basePeriod.end;

                overlaps.Add(overlapEnd - overlapStart);
            }

            return overlaps;
        }
        /// <summary>
        /// Calcule directement les heures travaillées à partir des pointages réels (entrées/sorties)
        /// quand on a au moins une plage complète. Retourne <c>null</c> si aucune plage n'est exploitable
        /// — l'appelant retombe alors sur l'ancienne formule basée sur le poste théorique.
        ///
        /// Cas couverts :
        ///  - Matin + après-midi (4 pointages) : somme des deux durées (la pause-déjeuner est
        ///    naturellement exclue par le gap entre les 2 plages).
        ///  - Matin uniquement OU après-midi uniquement : durée de la plage présente.
        ///  - Aucun couple entrée/sortie cohérent : retourne null pour fallback.
        /// </summary>
        private static float? ComputeWorkedHoursFromPunches(PresenceDto presence)
        {
            TimeSpan total = TimeSpan.Zero;
            bool any = false;

            if (TimeSpan.TryParse(presence.Preentmatup, out var em) &&
                TimeSpan.TryParse(presence.Presortmatup, out var sm) &&
                sm > em)
            {
                total += sm - em;
                any = true;
            }

            if (TimeSpan.TryParse(presence.Preentamidiup, out var ea) &&
                TimeSpan.TryParse(presence.Presortamidiup, out var sa) &&
                sa > ea)
            {
                total += sa - ea;
                any = true;
            }

            return any ? (float)total.TotalHours : (float?)null;
        }

        public float CalcArrondi(float arrondi,float totalHeures)
        {
            if (arrondi > 0)
            {
                // Convertir les heures en minutes
                float totalMinutes = totalHeures * 60f;

                // Arrondir au multiple supérieur
                totalMinutes = (float)(Math.Ceiling(totalMinutes / arrondi) * arrondi);

                // Reconvertir en heures
                totalHeures = totalMinutes / 60f;
            }
            return totalHeures;
        }
    }
}
