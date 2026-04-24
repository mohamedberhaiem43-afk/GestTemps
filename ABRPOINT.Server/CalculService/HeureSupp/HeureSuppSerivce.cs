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

                int nbHeurSupp = 0;

                var (morningStartTime, morningEndTime, eveningStartTime, eveningEndTime) =
                    GenericMethodes.GetStartsWorkDay(presence.Dmdate, poste);

                if (string.IsNullOrEmpty(morningStartTime))
                    return 0;

                TimeSpan morningStart = ParseOrZero(morningStartTime);
                TimeSpan morningEnd = ParseOrZero(morningEndTime);
                TimeSpan eveningStart = ParseOrZero(eveningStartTime);
                TimeSpan eveningEnd = ParseOrZero(eveningEndTime);

                TimeSpan actualMorningArrival = ParseOrZero(presence.Preentmatup);
                TimeSpan actualMorningEnd = ParseOrZero(presence.Presortmatup);
                TimeSpan actualAfternoonArrival = ParseOrZero(presence.Preentamidiup);
                TimeSpan actualAfternoonEnd = ParseOrZero(presence.Presortamidiup);

                int EntreeTolerance = poste.Avantent ?? 0;
                int SortieTolerance = poste.Apressort ?? 0;

                bool hasEveningSession = eveningStart != TimeSpan.Zero && eveningEnd != TimeSpan.Zero;

                // 1️⃣ HEURES SUPP DU MATIN
                if (!string.IsNullOrEmpty(presence.Preentmatup))
                {
                    int morningStartMinutes = (int)morningStart.TotalMinutes;
                    int actualMorningArrivalMinutes = (int)actualMorningArrival.TotalMinutes;

                    if (actualMorningArrivalMinutes < (morningStartMinutes - EntreeTolerance))
                    {
                        int SupMorning = morningStartMinutes - actualMorningArrivalMinutes;
                        nbHeurSupp += SupMorning;
                    }
                    else
                    {
                        int diffFromOfficialStart = actualMorningArrivalMinutes - morningStartMinutes;
                        UpdateTothre(presence, diffFromOfficialStart);
                    }
                }

                // 2️⃣ SORTIE MATIN TARDIVE
                if (actualMorningEnd > morningEnd)
                {
                    int morningEndMinutes = (int)morningEnd.TotalMinutes;
                    int actualMorningEndMinutes = (int)actualMorningEnd.TotalMinutes;
                    int eveningStartMinutes = (int)eveningStart.TotalMinutes;

                    if (!hasEveningSession)
                    {
                        nbHeurSupp += actualMorningEndMinutes - morningEndMinutes;
                    }
                    else
                    {
                        nbHeurSupp += (int)(eveningStartMinutes < actualMorningEndMinutes
                            ? actualMorningEndMinutes - morningEndMinutes
                            : eveningStartMinutes - morningEndMinutes);
                    }
                }

                // 3️⃣ SESSION APRÈS-MIDI/SOIR
                if (!string.IsNullOrEmpty(presence.Preentamidiup) && actualAfternoonArrival != TimeSpan.Zero)
                {
                    int actualAfternoonArrivalMinutes = (int)actualAfternoonArrival.TotalMinutes;

                    if (hasEveningSession)
                    {
                        int eveningStartMinutes = (int)eveningStart.TotalMinutes;

                        if (actualAfternoonArrivalMinutes < (eveningStartMinutes - EntreeTolerance))
                        {
                            int SupAfternoonEntry = eveningStartMinutes - actualAfternoonArrivalMinutes;
                            nbHeurSupp += SupAfternoonEntry;
                        }
                    }
                    else
                    {
                        // ✅ PAS de session du soir : tout le travail = heures supp
                        if (!string.IsNullOrEmpty(presence.Presortamidiup) && actualAfternoonEnd != TimeSpan.Zero)
                        {
                            int actualAfternoonEndMinutes = (int)actualAfternoonEnd.TotalMinutes;

                            int afternoonWorkMinutes;

                            // ✅ Gestion du passage de minuit
                            if (actualAfternoonEndMinutes < actualAfternoonArrivalMinutes)
                            {
                                afternoonWorkMinutes = (1440 - actualAfternoonArrivalMinutes) + actualAfternoonEndMinutes;
                            }
                            else
                            {
                                afternoonWorkMinutes = actualAfternoonEndMinutes - actualAfternoonArrivalMinutes;
                            }

                            nbHeurSupp += afternoonWorkMinutes;
                        }
                    }
                }

                // 4️⃣ HEURES SUPP EN FIN DE JOURNÉE
                TimeSpan actualLeave = TimeSpan.Zero;

                if (!string.IsNullOrEmpty(presence.Presortmatup))
                {
                    actualLeave = ParseOrZero(presence.Presortmatup);
                }
                else if (!string.IsNullOrEmpty(presence.Presortamidiup))
                {
                    actualLeave = actualAfternoonEnd;
                }
                else if (!string.IsNullOrEmpty(presence.Presortmatup))
                {
                    actualLeave = actualMorningEnd;
                }

                if (actualLeave != TimeSpan.Zero && hasEveningSession)
                {
                    int eveningEndMinutes = (int)eveningEnd.TotalMinutes;
                    int actualLeaveMinutes = (int)actualLeave.TotalMinutes;

                    if (actualLeaveMinutes > (eveningEndMinutes + SortieTolerance))
                    {
                        int SupEvening = actualLeaveMinutes - eveningEndMinutes;
                        nbHeurSupp += SupEvening;
                    }
                    else if (actualLeaveMinutes < eveningEndMinutes)
                    {
                        int diffFromOfficialLeave = actualLeaveMinutes - eveningEndMinutes;
                        UpdateTothre(presence, -diffFromOfficialLeave);
                    }
                }

                return (double)nbHeurSupp / 60;
            }
            catch (Exception ex)
            {
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

                if (cathsup == "0")
                    return 0;

                int nbHeurSupp = 0;

                var (morningStartTime, morningEndTime, eveningStartTime, eveningEndTime) =
                    GenericMethodes.GetStartsWorkDay(presence.Dmdate, poste);

                if (string.IsNullOrEmpty(morningStartTime))
                    return 0;

                TimeSpan morningStart = ParseOrZero(morningStartTime);
                TimeSpan morningEnd = ParseOrZero(morningEndTime);
                TimeSpan eveningStart = ParseOrZero(eveningStartTime);
                TimeSpan eveningEnd = ParseOrZero(eveningEndTime);

                TimeSpan actualMorningArrival = ParseOrZero(presence.Preentmatup);
                TimeSpan actualMorningEnd = ParseOrZero(presence.Presortmatup);
                TimeSpan actualAfternoonArrival = ParseOrZero(presence.Preentamidiup);
                TimeSpan actualAfternoonEnd = ParseOrZero(presence.Presortamidiup);

                int EntreeTolerance = poste.Avantent ?? 0;
                int SortieTolerance = poste.Apressort ?? 0;

                bool hasEveningSession = eveningStart != TimeSpan.Zero && eveningEnd != TimeSpan.Zero;

                // 1️⃣ HEURES SUPP DU MATIN
                if (!string.IsNullOrEmpty(presence.Preentmatup))
                {
                    int morningStartMinutes = (int)morningStart.TotalMinutes;
                    int actualMorningArrivalMinutes = (int)actualMorningArrival.TotalMinutes;

                    if (actualMorningArrivalMinutes < (morningStartMinutes - EntreeTolerance))
                    {
                        int SupMorning = morningStartMinutes - actualMorningArrivalMinutes;
                        nbHeurSupp += SupMorning;
                    }
                    else
                    {
                        int diffFromOfficialStart = actualMorningArrivalMinutes - morningStartMinutes;
                        UpdateTothre(presence, diffFromOfficialStart);
                    }
                }

                // 2️⃣ SORTIE MATIN TARDIVE
                if (actualMorningEnd > morningEnd)
                {
                    int morningEndMinutes = (int)morningEnd.TotalMinutes;
                    int actualMorningEndMinutes = (int)actualMorningEnd.TotalMinutes;
                    int eveningStartMinutes = (int)eveningStart.TotalMinutes;

                    if (!hasEveningSession)
                    {
                        nbHeurSupp += actualMorningEndMinutes - morningEndMinutes;
                    }
                    else
                    {
                        nbHeurSupp += (int)(eveningStartMinutes < actualMorningEndMinutes
                            ? actualMorningEndMinutes - morningEndMinutes
                            : eveningStartMinutes - morningEndMinutes);
                    }
                }

                // 3️⃣ SESSION APRÈS-MIDI/SOIR
                if (!string.IsNullOrEmpty(presence.Preentamidiup) && actualAfternoonArrival != TimeSpan.Zero)
                {
                    int actualAfternoonArrivalMinutes = (int)actualAfternoonArrival.TotalMinutes;

                    if (hasEveningSession)
                    {
                        int eveningStartMinutes = (int)eveningStart.TotalMinutes;

                        if (actualAfternoonArrivalMinutes < (eveningStartMinutes - EntreeTolerance))
                        {
                            int SupAfternoonEntry = eveningStartMinutes - actualAfternoonArrivalMinutes;
                            nbHeurSupp += SupAfternoonEntry;
                        }
                    }
                    else
                    {
                        // ✅ PAS de session du soir : tout le travail = heures supp
                        if (!string.IsNullOrEmpty(presence.Presortamidiup) && actualAfternoonEnd != TimeSpan.Zero)
                        {
                            int actualAfternoonEndMinutes = (int)actualAfternoonEnd.TotalMinutes;

                            int afternoonWorkMinutes;

                            // ✅ Gestion du passage de minuit
                            if (actualAfternoonEndMinutes < actualAfternoonArrivalMinutes)
                            {
                                afternoonWorkMinutes = (1440 - actualAfternoonArrivalMinutes) + actualAfternoonEndMinutes;
                            }
                            else
                            {
                                afternoonWorkMinutes = actualAfternoonEndMinutes - actualAfternoonArrivalMinutes;
                            }

                            nbHeurSupp += afternoonWorkMinutes;
                        }
                    }
                }

                // 4️⃣ HEURES SUPP EN FIN DE JOURNÉE
                TimeSpan actualLeave = TimeSpan.Zero;

                if (!string.IsNullOrEmpty(presence.Presortmatup))
                {
                    actualLeave = ParseOrZero(presence.Presortmatup);
                }
                else if (!string.IsNullOrEmpty(presence.Presortamidiup))
                {
                    actualLeave = actualAfternoonEnd;
                }
                else if (!string.IsNullOrEmpty(presence.Presortmatup))
                {
                    actualLeave = actualMorningEnd;
                }

                if (actualLeave != TimeSpan.Zero && hasEveningSession)
                {
                    int eveningEndMinutes = (int)eveningEnd.TotalMinutes;
                    int actualLeaveMinutes = (int)actualLeave.TotalMinutes;

                    if (actualLeaveMinutes > (eveningEndMinutes + SortieTolerance))
                    {
                        int SupEvening = actualLeaveMinutes - eveningEndMinutes;
                        nbHeurSupp += SupEvening;
                    }
                    else if (actualLeaveMinutes < eveningEndMinutes)
                    {
                        int diffFromOfficialLeave = actualLeaveMinutes - eveningEndMinutes;
                        UpdateTothre(presence, -diffFromOfficialLeave);
                    }
                }

                return nbHeurSupp / 60;
            }
            catch (Exception ex)
            {
                throw;
            }
        } /// <summary>
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
