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

                // 🛌 JOUR DE REPOS — toute heure pointée est par définition supplémentaire,
                // puisque l'employé n'avait aucun poste prévu. On retombe sur le total
                // travaillé (Tothre déjà calculé en amont) plutôt que de dérouler des
                // comparaisons morning/evening qui n'ont aucun sens un dimanche/jour férié.
                // ⚠ Tothre peut être négatif si une donnée corrompue (ancienne version du calcul
                // qui retranchait le repas sans clamp, ou pointage incomplet) a été persistée :
                // sur un jour de repos, des HS négatives n'ont aucun sens — on plancheà 0.
                if (presence.Prerepos == "1")
                {
                    var t = GenericMethodes.ConvertHHmmToDouble(presence.Tothre) ?? 0;
                    return t > 0 ? t : 0;
                }

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

                // 2️⃣ SORTIE MATIN TARDIVE — l'employé a continué de bosser pendant tout ou
                // partie de la pause déjeuner. On ne déclenche que si :
                //   - une session du soir existe (sinon il n'y a pas de "pause" à enjamber)
                //   - l'employé était bien présent AVANT morningEnd (sinon il n'a jamais
                //     touché à la pause — bug observé : entrée 17:53 / sortie 21:04 ajoutait
                //     12:00→14:00 = 2h alors qu'il n'était pas là à ce moment).
                if (hasEveningSession
                    && actualMorningEnd > morningEnd
                    && actualMorningArrival != TimeSpan.Zero
                    && actualMorningArrival <= morningEnd)
                {
                    int morningEndMinutes = (int)morningEnd.TotalMinutes;
                    int actualMorningEndMinutes = (int)actualMorningEnd.TotalMinutes;
                    int eveningStartMinutes = (int)eveningStart.TotalMinutes;

                    int upperBound = Math.Min(actualMorningEndMinutes, eveningStartMinutes);
                    if (upperBound > morningEndMinutes)
                        nbHeurSupp += upperBound - morningEndMinutes;
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
                }

                // 4️⃣ HEURES SUPP EN FIN DE JOURNÉE
                TimeSpan actualLeave = TimeSpan.Zero;
                TimeSpan effectiveEntry = TimeSpan.Zero;

                if (!string.IsNullOrEmpty(presence.Presortamidiup) && actualAfternoonEnd != TimeSpan.Zero)
                {
                    actualLeave = actualAfternoonEnd;
                    effectiveEntry = actualAfternoonArrival != TimeSpan.Zero
                        ? actualAfternoonArrival
                        : actualMorningArrival;
                }
                else if (!string.IsNullOrEmpty(presence.Presortmatup))
                {
                    actualLeave = actualMorningEnd;
                    effectiveEntry = actualMorningArrival;
                }

                TimeSpan scheduledEnd = hasEveningSession ? eveningEnd : morningEnd;

                if (actualLeave != TimeSpan.Zero)
                {
                    int scheduledEndMinutes = (int)scheduledEnd.TotalMinutes;
                    int actualLeaveMinutes = (int)actualLeave.TotalMinutes;
                    int effectiveEntryMinutes = (int)effectiveEntry.TotalMinutes;

                    if (actualLeaveMinutes > (scheduledEndMinutes + SortieTolerance))
                    {
                        // FIX : si l'employé est arrivé APRÈS la fin de plage (ex 17:53 alors
                        // que scheduledEnd = 17:00), tout son temps sur site est H.Sup. Le
                        // calcul d'origine (actualLeave - scheduledEnd) supposait à tort qu'il
                        // était déjà présent depuis le matin et générait 4h+ d'H.Sup fantômes.
                        int overtimeStart = Math.Max(scheduledEndMinutes, effectiveEntryMinutes);
                        int SupEvening = actualLeaveMinutes - overtimeStart;
                        if (SupEvening > 0) nbHeurSupp += SupEvening;
                    }
                }

                // Garde-fou : les H.Sup ne peuvent jamais excéder le temps réellement travaillé.
                // Tothre est en "HH:mm" — ConvertHHmmToDouble retourne des heures décimales.
                var totalWorkedHours = GenericMethodes.ConvertHHmmToDouble(presence.Tothre) ?? 0;
                if (totalWorkedHours > 0)
                {
                    int totalWorkedMinutes = (int)Math.Round(totalWorkedHours * 60);
                    if (nbHeurSupp > totalWorkedMinutes) nbHeurSupp = totalWorkedMinutes;
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

                // 🛌 JOUR DE REPOS — cf. CalculateHeureSuppOptimise plus haut. Plancher à 0
                // pour neutraliser un Tothre négatif issu d'un ancien calcul.
                if (presence.Prerepos == "1")
                {
                    var t = GenericMethodes.ConvertHHmmToDouble(presence.Tothre) ?? 0;
                    return t > 0 ? t : 0;
                }

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

                // 2️⃣ SORTIE MATIN TARDIVE — cf. CalculateHeureSuppOptimise pour le détail.
                // On exige actualMorningArrival ≤ morningEnd pour ne pas générer de pause-
                // déjeuner fantôme quand l'employé arrive après 12:00.
                if (hasEveningSession
                    && actualMorningEnd > morningEnd
                    && actualMorningArrival != TimeSpan.Zero
                    && actualMorningArrival <= morningEnd)
                {
                    int morningEndMinutes = (int)morningEnd.TotalMinutes;
                    int actualMorningEndMinutes = (int)actualMorningEnd.TotalMinutes;
                    int eveningStartMinutes = (int)eveningStart.TotalMinutes;

                    int upperBound = Math.Min(actualMorningEndMinutes, eveningStartMinutes);
                    if (upperBound > morningEndMinutes)
                        nbHeurSupp += upperBound - morningEndMinutes;
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
                }

                // 4️⃣ HEURES SUPP EN FIN DE JOURNÉE
                TimeSpan actualLeave = TimeSpan.Zero;
                TimeSpan effectiveEntry = TimeSpan.Zero;

                if (!string.IsNullOrEmpty(presence.Presortamidiup) && actualAfternoonEnd != TimeSpan.Zero)
                {
                    actualLeave = actualAfternoonEnd;
                    effectiveEntry = actualAfternoonArrival != TimeSpan.Zero
                        ? actualAfternoonArrival
                        : actualMorningArrival;
                }
                else if (!string.IsNullOrEmpty(presence.Presortmatup))
                {
                    actualLeave = actualMorningEnd;
                    effectiveEntry = actualMorningArrival;
                }

                TimeSpan scheduledEnd = hasEveningSession ? eveningEnd : morningEnd;

                if (actualLeave != TimeSpan.Zero)
                {
                    int scheduledEndMinutes = (int)scheduledEnd.TotalMinutes;
                    int actualLeaveMinutes = (int)actualLeave.TotalMinutes;
                    int effectiveEntryMinutes = (int)effectiveEntry.TotalMinutes;

                    if (actualLeaveMinutes > (scheduledEndMinutes + SortieTolerance))
                    {
                        // FIX : si l'employé est arrivé APRÈS scheduledEnd, on part de son
                        // arrivée réelle pour calculer l'H.Sup, pas de scheduledEnd.
                        int overtimeStart = Math.Max(scheduledEndMinutes, effectiveEntryMinutes);
                        int SupEvening = actualLeaveMinutes - overtimeStart;
                        if (SupEvening > 0) nbHeurSupp += SupEvening;
                    }
                }

                // Garde-fou : H.Sup ≤ temps réellement travaillé (Tothre).
                var totalWorkedHours = GenericMethodes.ConvertHHmmToDouble(presence.Tothre) ?? 0;
                if (totalWorkedHours > 0)
                {
                    int totalWorkedMinutes = (int)Math.Round(totalWorkedHours * 60);
                    if (nbHeurSupp > totalWorkedMinutes) nbHeurSupp = totalWorkedMinutes;
                }

                // FIX: cast en double pour ne plus tronquer les minutes (entier/entier en C#
                // = division entière). 197 min → 197/60 = 3.28h, pas 3.
                return (double)nbHeurSupp / 60;
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