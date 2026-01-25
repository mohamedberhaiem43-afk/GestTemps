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
        public HeureSuppSerivce(ILcategorieRepository categorieRepository, IParametreRepository parametreRepository)
        {
            _categorieRepository = categorieRepository;
            _parametreRepository = parametreRepository;
        }
        public async Task<double> CalculateHeureSuppOptimise(PresenceDto presence, Poste poste)
        {
            if (presence == null) throw new ArgumentNullException(nameof(presence));
            if (poste == null) throw new ArgumentNullException(nameof(poste));
            try
            {
                string? cathsup = await _categorieRepository.GetCathsup(presence.Soccod, presence.Empcod);

                // Si la catégorie de l'employé est "Hors Catégorie", pas d'heures supp
                if (cathsup == "0")
                    return 0;

                int nbHeurSupp = 0;

                var (morningStartTime, morningEndTime, eveningStartTime, eveningEndTime) =
                    GenericMethodes.GetStartsWorkDay(presence.Dmdate, poste);

                if (string.IsNullOrEmpty(morningStartTime) || string.IsNullOrEmpty(presence.Preentmatup))
                    return 0;

                // Parsing safe
                TimeSpan morningStart = ParseOrZero(morningStartTime);
                TimeSpan actualArrival = ParseOrZero(presence.Preentmatup);
                TimeSpan eveningStart = ParseOrZero(eveningStartTime);
                TimeSpan eveningEnd = ParseOrZero(eveningEndTime);
                TimeSpan morningEnd = ParseOrZero(morningEndTime);
                TimeSpan actualMorningEnd = ParseOrZero(presence.Presortmatup);

                // Détermination de l'heure de sortie réelle
                TimeSpan actualLeave;
                if (string.IsNullOrEmpty(presence.Presortsupup))
                {
                    actualLeave = ParseOrZero(presence.Presortamidiup);
                    if (actualLeave == TimeSpan.Zero)
                        actualLeave = ParseOrZero(presence.Presortmatup);
                }
                else
                {
                    actualLeave = ParseOrZero(presence.Presortsupup);
                }

                // Cas du midi : sortie plus tard que la fin officielle du matin
                if (actualMorningEnd > morningEnd)
                {
                    nbHeurSupp += (int)(eveningStart.TotalMinutes < actualMorningEnd.TotalMinutes
                        ? actualMorningEnd.TotalMinutes - morningEnd.TotalMinutes
                        : eveningStart.TotalMinutes - morningEnd.TotalMinutes);
                }

                // Convert times en minutes
                int morningStartMinutes = (int)morningStart.TotalMinutes;
                int actualArrivalMinutes = (int)actualArrival.TotalMinutes;
                int eveningLeaveMinutes = (int)eveningEnd.TotalMinutes;
                int actualLeaveMinutes = (eveningLeaveMinutes != 0) ? (int)actualLeave.TotalMinutes : 0;

                int EntreeTolerance = poste.Avantent ?? 0;
                int SortieTolerance = poste.Apressort ?? 0;

                int diffFromOfficialStart = actualArrivalMinutes - morningStartMinutes;
                int diffFromOfficialLeave = actualLeaveMinutes - eveningLeaveMinutes;

                // Arrivée avant l'heure officielle (avec tolérance) => heures supp
                if (actualArrivalMinutes < (morningStartMinutes - EntreeTolerance))
                {
                    int SupMorning = morningStartMinutes - actualArrivalMinutes;
                    nbHeurSupp += SupMorning;
                }
                else
                {
                    UpdateTothre(presence, diffFromOfficialStart);
                }

                // Départ après l'heure officielle (avec tolérance) => heures supp
                if (actualLeaveMinutes != 0 && actualLeaveMinutes > (eveningLeaveMinutes - SortieTolerance))
                {
                    int SupEvening = actualLeaveMinutes - eveningLeaveMinutes;
                    nbHeurSupp += SupEvening;
                }
                else
                {
                    UpdateTothre(presence, -diffFromOfficialLeave);
                }

                return (double)nbHeurSupp / 60;
            }
            catch (Exception ex)
            {
                // Ici on logge avant de relancer
                // _logger.LogError(ex, "Erreur dans CalculateHeureSupp");
                throw;
            }
        }

        public async Task<double> CalculateHeureSupp(PresenceDto presence, Poste poste)
        {
            if (presence == null) throw new ArgumentNullException(nameof(presence));
            if (poste == null) throw new ArgumentNullException(nameof(poste));
            if (!string.IsNullOrEmpty(presence.Tothsup) && presence.Tothsup != "-")
            {
                var convertedValue = GenericMethodes.ConvertHHmmToDouble(presence.Tothsup);
                if (convertedValue.HasValue)
                {
                    return (int)convertedValue.Value;
                }
            }
            try
            {
                string? cathsup = await _categorieRepository.GetCathsup(presence.Soccod, presence.Empcod);

                // Si la catégorie de l'employé est "Hors Catégorie", pas d'heures supp
                if (cathsup == "0")
                    return 0;

                int nbHeurSupp = 0;

                var (morningStartTime, morningEndTime, eveningStartTime, eveningEndTime) =
                    GenericMethodes.GetStartsWorkDay(presence.Dmdate, poste);

                if (string.IsNullOrEmpty(morningStartTime) || string.IsNullOrEmpty(presence.Preentmatup))
                    return 0;

                // Parsing safe
                TimeSpan morningStart = ParseOrZero(morningStartTime);
                TimeSpan actualArrival = ParseOrZero(presence.Preentmatup);
                TimeSpan eveningStart = ParseOrZero(eveningStartTime);
                TimeSpan eveningEnd = ParseOrZero(eveningEndTime);
                TimeSpan morningEnd = ParseOrZero(morningEndTime);
                TimeSpan actualMorningEnd = ParseOrZero(presence.Presortmatup);

                // Détermination de l'heure de sortie réelle
                TimeSpan actualLeave;
                if (string.IsNullOrEmpty(presence.Presortsupup))
                {
                    actualLeave = ParseOrZero(presence.Presortamidiup);
                    if (actualLeave == TimeSpan.Zero)
                        actualLeave = ParseOrZero(presence.Presortmatup);
                }
                else
                {
                    actualLeave = ParseOrZero(presence.Presortsupup);
                }

                // Cas du midi : sortie plus tard que la fin officielle du matin
                if (actualMorningEnd > morningEnd)
                {
                    nbHeurSupp += (int)(eveningStart.TotalMinutes < actualMorningEnd.TotalMinutes
                        ? actualMorningEnd.TotalMinutes - morningEnd.TotalMinutes
                        : eveningStart.TotalMinutes - morningEnd.TotalMinutes);
                }

                // Convert times en minutes
                int morningStartMinutes = (int)morningStart.TotalMinutes;
                int actualArrivalMinutes = (int)actualArrival.TotalMinutes;
                int eveningLeaveMinutes = (int)eveningEnd.TotalMinutes;
                int actualLeaveMinutes = (eveningLeaveMinutes != 0) ? (int)actualLeave.TotalMinutes : 0;

                int EntreeTolerance = poste.Avantent ?? 0;
                int SortieTolerance = poste.Apressort ?? 0;

                int diffFromOfficialStart = actualArrivalMinutes - morningStartMinutes;
                int diffFromOfficialLeave = actualLeaveMinutes - eveningLeaveMinutes;

                // Arrivée avant l'heure officielle (avec tolérance) => heures supp
                if (actualArrivalMinutes < (morningStartMinutes - EntreeTolerance))
                {
                    int SupMorning = morningStartMinutes - actualArrivalMinutes;
                    nbHeurSupp += SupMorning;
                }
                else
                {
                    UpdateTothre(presence, diffFromOfficialStart);
                }

                // Départ après l'heure officielle (avec tolérance) => heures supp
                if (actualLeaveMinutes != 0 && actualLeaveMinutes > (eveningLeaveMinutes - SortieTolerance))
                {
                    int SupEvening = actualLeaveMinutes - eveningLeaveMinutes;
                    nbHeurSupp += SupEvening;
                }
                else
                {
                    UpdateTothre(presence, -diffFromOfficialLeave);
                }

                return nbHeurSupp / 60;
            }
            catch (Exception ex)
            {
                // Ici on logge avant de relancer
                // _logger.LogError(ex, "Erreur dans CalculateHeureSupp");
                throw;
            }
        }

        /// <summary>
        /// Parse un TimeSpan à partir d'une chaîne, sinon retourne TimeSpan.Zero
        /// </summary>
        private TimeSpan ParseOrZero(string? value)
        {
            return TimeSpan.TryParse(value, out var ts) ? ts : TimeSpan.Zero;
        }

        /// <summary>
        /// Met à jour le champ Tothre de presence en ajoutant des minutes
        /// </summary>
        private void UpdateTothre(PresenceDto presence, int minutesDelta)
        {
            TimeSpan tothre = TimeSpan.Zero;

            if (!string.IsNullOrWhiteSpace(presence.Tothre) && TimeSpan.TryParse(presence.Tothre, out var existing))
            {
                tothre = existing.Add(TimeSpan.FromMinutes(minutesDelta));
            }
            else
            {
                tothre = TimeSpan.FromMinutes(minutesDelta);
            }

            if (tothre < TimeSpan.Zero)
                tothre = TimeSpan.Zero;

            // Limite de sécurité (12h max par jour par ex.)
            TimeSpan maxOvertime = TimeSpan.FromHours(12);
            if (tothre > maxOvertime)
                tothre = maxOvertime;

            presence.Tothre = $"{tothre.Hours:D2}:{tothre.Minutes:D2}";
        }

    }
}
