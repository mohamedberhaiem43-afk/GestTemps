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
                    // Pas de side-effect sur Tothre : un retard ou une arrivée dans la tolérance
                    // ne génère pas d'heures supp (la diff est traitée par CalculateHeureRetard).
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
                    // ⚠️ FIX: When no evening session is defined, we do NOT count all afternoon
                    // work as overtime. The overtime for late departure is handled in section 4
                    // (comparing actualLeave against the scheduled end time).
                }

                // 4️⃣ HEURES SUPP EN FIN DE JOURNÉE
                TimeSpan actualLeave = TimeSpan.Zero;

                // FIX: Prioritize afternoon exit (last departure of the day) over morning exit
                if (!string.IsNullOrEmpty(presence.Presortamidiup) && actualAfternoonEnd != TimeSpan.Zero)
                {
                    actualLeave = actualAfternoonEnd;
                }
                else if (!string.IsNullOrEmpty(presence.Presortmatup))
                {
                    actualLeave = actualMorningEnd;
                }

                // FIX: Handle both cases — with and without evening session
                TimeSpan scheduledEnd = hasEveningSession ? eveningEnd : morningEnd;

                if (actualLeave != TimeSpan.Zero)
                {
                    int scheduledEndMinutes = (int)scheduledEnd.TotalMinutes;
                    int actualLeaveMinutes = (int)actualLeave.TotalMinutes;

                    if (actualLeaveMinutes > (scheduledEndMinutes + SortieTolerance))
                    {
                        int SupEvening = actualLeaveMinutes - scheduledEndMinutes;
                        nbHeurSupp += SupEvening;
                    }
                    // Sortie anticipée : ne pas muter Tothre. CalcNbHeure reflète déjà le temps
                    // réellement travaillé (entrée → sortie réelle).
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
                    // FIX: Removed (int) cast that was truncating minutes.
                    // e.g. "01:30" → 1.5 → (int)1.5 = 1 → lost 30 min
                    return convertedValue.Value;
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
                    // Pas de side-effect sur Tothre : un retard ou une arrivée dans la tolérance
                    // ne génère pas d'heures supp (la diff est traitée par CalculateHeureRetard).
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
                    // ⚠️ FIX: When no evening session is defined, we do NOT count all afternoon
                    // work as overtime. The overtime for late departure is handled in section 4
                    // (comparing actualLeave against the scheduled end time).
                }

                // 4️⃣ HEURES SUPP EN FIN DE JOURNÉE
                TimeSpan actualLeave = TimeSpan.Zero;

                // FIX: Prioritize afternoon exit (last departure of the day) over morning exit
                if (!string.IsNullOrEmpty(presence.Presortamidiup) && actualAfternoonEnd != TimeSpan.Zero)
                {
                    actualLeave = actualAfternoonEnd;
                }
                else if (!string.IsNullOrEmpty(presence.Presortmatup))
                {
                    actualLeave = actualMorningEnd;
                }

                // FIX: Handle both cases — with and without evening session
                TimeSpan scheduledEnd = hasEveningSession ? eveningEnd : morningEnd;

                if (actualLeave != TimeSpan.Zero)
                {
                    int scheduledEndMinutes = (int)scheduledEnd.TotalMinutes;
                    int actualLeaveMinutes = (int)actualLeave.TotalMinutes;

                    if (actualLeaveMinutes > (scheduledEndMinutes + SortieTolerance))
                    {
                        int SupEvening = actualLeaveMinutes - scheduledEndMinutes;
                        nbHeurSupp += SupEvening;
                    }
                    // Sortie anticipée : ne pas muter Tothre. CalcNbHeure reflète déjà le temps
                    // réellement travaillé (entrée → sortie réelle).
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
    }
}