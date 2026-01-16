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
                return (await _heureSuppService.CalculateHeureSupp(presence, poste), await _heureRetardService.CalculateHeureRetard(presence, poste, autorisation));
            }
            catch (Exception ex)
            {
                // Consider logging the error here
                throw new ApplicationException("Error calculating work metrics", ex);
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

                // 🔹 Étape 3 : Calcul heures normales + heures supp - retards
                var (nbHeurSupp, nbRetard) = await CalculateDayWorkMetrics(presence);
                float totalHeures = totalPosteJourHeures + (((float)nbHeurSupp - nbRetard) / 60f);

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
