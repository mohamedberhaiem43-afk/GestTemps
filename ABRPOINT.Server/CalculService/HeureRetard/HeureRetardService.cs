using ABRPOINT.Helper;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.CalculService.HeureRetard
{
    public class HeureRetardService : IHeureRetardService
    {
        private readonly ApplicationDbContext _dbContext;
        public HeureRetardService(ApplicationDbContext dbContext)
        {
            _dbContext = dbContext;
        }
        private bool IsInAutorisation(TimeSpan time, AutDto autorisation)
        {
            TimeSpan? autorisationStart = autorisation?.Condep?.TimeOfDay;
            TimeSpan? autorisationEnd = autorisation?.Conret?.TimeOfDay;

            if (autorisationStart == null || autorisationEnd == null)
                return false;

            TimeSpan t = new TimeSpan(time.Hours, time.Minutes, 0);
            TimeSpan start = new TimeSpan(autorisationStart.Value.Hours, autorisationStart.Value.Minutes, 0);
            TimeSpan end = new TimeSpan(autorisationEnd.Value.Hours, autorisationEnd.Value.Minutes, 0);

            return t >= start && t <= end;
        }

        public async Task<int> CalculateHeureRetard(PresenceDto presence, Poste poste, AutDto autoisation)
        {
            int nbRetard = 0;
            var dayOfWeek = presence.Dmdate?.DayOfWeek ?? DateTime.Now.DayOfWeek;

            var (morningStartTime, morningEndTime, eveningStartTime, eveningEndTime) = GenericMethodes.GetStartsWorkDay(presence.Dmdate, poste);

            if (string.IsNullOrEmpty(morningStartTime) || string.IsNullOrEmpty(presence.Preentmatup))
                return 0;

            string? empretard = await _dbContext.Employes
                .Where(emp => emp.Soccod == presence.Soccod && emp.Empcod == presence.Empcod)
                .Select(emp => emp.Empretard)
                .SingleOrDefaultAsync();

            if (string.IsNullOrEmpty(empretard) || empretard == "1")
                return 0;

            TimeSpan morningStart = TimeSpan.Parse(morningStartTime);
            TimeSpan morningEnd = TimeSpan.Parse(morningEndTime);
            TimeSpan actualMorningArrival = TimeSpan.Parse(presence.Preentmatup);
            TimeSpan actualMorningDepartre = !string.IsNullOrEmpty(presence.Presortmatup) ? TimeSpan.Parse(presence?.Presortmatup) : TimeSpan.Zero;
            TimeSpan eveningStart = !string.IsNullOrEmpty(eveningStartTime) ? TimeSpan.Parse(eveningStartTime) : TimeSpan.Zero;
            TimeSpan eveningEnd = !string.IsNullOrEmpty(eveningEndTime) ? TimeSpan.Parse(eveningEndTime) : TimeSpan.Zero;
            TimeSpan actualEveningDeparture = !string.IsNullOrEmpty(presence.Presortamidiup) ? TimeSpan.Parse(presence?.Presortamidiup) : TimeSpan.Zero;

            if (eveningEnd == TimeSpan.Zero)
                eveningEnd = morningEnd;
            if (actualEveningDeparture == TimeSpan.Zero)
                actualEveningDeparture = actualMorningDepartre;

            if (actualMorningDepartre == TimeSpan.Zero)
                eveningEnd = TimeSpan.Zero;

            TimeSpan actualEveningArrival = !string.IsNullOrEmpty(presence.Preentamidiup) ? TimeSpan.Parse(presence?.Preentamidiup) : TimeSpan.Zero;

            int morningStartMinutes = (int)morningStart.TotalMinutes;
            int actualArrivalMinutes = (int)actualMorningArrival.TotalMinutes;
            int retardTolerance = poste.Apresent ?? 0;

            int eveningEndMinutes = (int)eveningEnd.TotalMinutes;
            int actualEveningDepartureMinutes = (int)actualEveningDeparture.TotalMinutes;
            int retardToleranceAm = poste.Apressort ?? 0;

            int eveningStartTimeMinutes = (int)eveningStart.TotalMinutes;
            int actualEveningArrivalMinutes = (int)actualEveningArrival.TotalMinutes;
            int entreeEveningTolerance = poste.Avantsort ?? 0;

            // Midi/Soir - Retard au départ (quitter trop tôt)
            if (actualEveningDepartureMinutes < (eveningEndMinutes - retardToleranceAm) && !IsInAutorisation(actualEveningDeparture, autoisation))
            {
                int retardEvening = eveningEndMinutes - actualEveningDepartureMinutes;
                if (retardEvening / 60 < 3)
                    nbRetard += retardEvening;
            }

            // Matin - Retard à l'arrivée
            if (actualArrivalMinutes > (morningStartMinutes - retardTolerance) && !IsInAutorisation(actualMorningArrival, autoisation))
            {
                int retardMorning = actualArrivalMinutes - morningStartMinutes;
                if (retardMorning / 60 < 3)
                    nbRetard += retardMorning;
            }

            

            // Après-midi - Retard à l'entrée
            if (actualEveningArrivalMinutes > (eveningStartTimeMinutes - entreeEveningTolerance) && !IsInAutorisation(actualEveningArrival, autoisation))
            {
                int retardEvening = actualEveningArrivalMinutes - eveningStartTimeMinutes;
                nbRetard += retardEvening;
            }
            // Cas spécial : l'employé est autorisé à sortir mais ne revient pas après la fin de l'autorisation
            if (autoisation?.Condep != null && autoisation?.Conret != null)
            {
                DateTime conret = autoisation.Conret.Value;

                // Heure prévue de reprise après autorisation (ex: 14:30)
                TimeSpan conretTime = new TimeSpan(conret.Hour, conret.Minute, 0);

                // Si l'employé n'est jamais revenu l'après-midi
                if (actualEveningArrival == TimeSpan.Zero || actualEveningArrival > conretTime.Add(TimeSpan.FromMinutes(10))) // 10 min de tolérance ?
                {
                    // Fin de journée théorique
                    TimeSpan endOfDay = eveningEnd;

                    // Calcul du retard injustifié après la fin d'autorisation jusqu'à fin de journée
                    if (conretTime < endOfDay)
                    {
                        TimeSpan unjustifiedAbsence = endOfDay - conretTime;
                        nbRetard += (int)unjustifiedAbsence.TotalMinutes;
                    }
                }
            }

            return nbRetard;
        }

    }
}
