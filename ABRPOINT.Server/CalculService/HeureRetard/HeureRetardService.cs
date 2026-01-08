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
            TimeSpan actualEveningArrival = !string.IsNullOrEmpty(presence.Preentamidiup) ? TimeSpan.Parse(presence?.Preentamidiup) : TimeSpan.Zero;
            TimeSpan actualEveningDeparture = !string.IsNullOrEmpty(presence.Presortamidiup) ? TimeSpan.Parse(presence?.Presortamidiup) : TimeSpan.Zero;

            // Determine if this is a single-session day (no separate evening session)
            bool isSingleSession = eveningStart == TimeSpan.Zero || eveningEnd == TimeSpan.Zero || string.IsNullOrEmpty(eveningStartTime) || string.IsNullOrEmpty(eveningEndTime);

            int retardTolerance = poste.Apresent ?? 0;
            int retardToleranceAm = poste.Apressort ?? 0;
            int entreeEveningTolerance = poste.Avantsort ?? 0;

            // Morning arrival delay
            int morningStartMinutes = (int)morningStart.TotalMinutes;
            int actualArrivalMinutes = (int)actualMorningArrival.TotalMinutes;

            if (actualArrivalMinutes > (morningStartMinutes + retardTolerance) && !IsInAutorisation(actualMorningArrival, autoisation))
            {
                int retardMorning = actualArrivalMinutes - morningStartMinutes;
                if (retardMorning / 60 < 3)
                    nbRetard += retardMorning;
            }

            if (isSingleSession)
            {
                // For single-session days, only check if they left early from the single session
                if (actualMorningDepartre != TimeSpan.Zero)
                {
                    int morningEndMinutes = (int)morningEnd.TotalMinutes;
                    int actualDepartureMinutes = (int)actualMorningDepartre.TotalMinutes;

                    if (actualDepartureMinutes < (morningEndMinutes - retardToleranceAm) && !IsInAutorisation(actualMorningDepartre, autoisation))
                    {
                        int retardDeparture = morningEndMinutes - actualDepartureMinutes;
                        if (retardDeparture / 60 < 3)
                            nbRetard += retardDeparture;
                    }
                }
            }
            else
            {
                // Two-session day: check morning departure and evening arrival/departure

                // Morning session - leaving too early
                if (actualMorningDepartre != TimeSpan.Zero)
                {
                    int morningEndMinutes = (int)morningEnd.TotalMinutes;
                    int actualMorningDepartureMinutes = (int)actualMorningDepartre.TotalMinutes;

                    if (actualMorningDepartureMinutes < (morningEndMinutes - retardToleranceAm) && !IsInAutorisation(actualMorningDepartre, autoisation))
                    {
                        int retardMorning = morningEndMinutes - actualMorningDepartureMinutes;
                        if (retardMorning / 60 < 3)
                            nbRetard += retardMorning;
                    }
                }

                // Evening session - late arrival
                if (actualEveningArrival != TimeSpan.Zero)
                {
                    int eveningStartMinutes = (int)eveningStart.TotalMinutes;
                    int actualEveningArrivalMinutes = (int)actualEveningArrival.TotalMinutes;

                    if (actualEveningArrivalMinutes > (eveningStartMinutes + entreeEveningTolerance) && !IsInAutorisation(actualEveningArrival, autoisation))
                    {
                        int retardEvening = actualEveningArrivalMinutes - eveningStartMinutes;
                        if (retardEvening / 60 < 3)
                            nbRetard += retardEvening;
                    }
                }

                // Evening session - leaving too early
                if (actualEveningDeparture != TimeSpan.Zero)
                {
                    int eveningEndMinutes = (int)eveningEnd.TotalMinutes;
                    int actualEveningDepartureMinutes = (int)actualEveningDeparture.TotalMinutes;

                    if (actualEveningDepartureMinutes < (eveningEndMinutes - retardToleranceAm) && !IsInAutorisation(actualEveningDeparture, autoisation))
                    {
                        int retardEvening = eveningEndMinutes - actualEveningDepartureMinutes;
                        if (retardEvening / 60 < 3)
                            nbRetard += retardEvening;
                    }
                }
            }

            // Special case: employee has authorization but doesn't return after it expires
            if (autoisation?.Condep != null && autoisation?.Conret != null)
            {
                DateTime conret = autoisation.Conret.Value;
                TimeSpan conretTime = new TimeSpan(conret.Hour, conret.Minute, 0);

                // Determine the expected end time based on session type
                TimeSpan endOfDay = isSingleSession ? morningEnd : eveningEnd;

                // Check if employee didn't return or returned very late
                TimeSpan actualReturnTime = isSingleSession ? actualMorningDepartre : actualEveningArrival;

                if (actualReturnTime == TimeSpan.Zero || actualReturnTime > conretTime.Add(TimeSpan.FromMinutes(10)))
                {
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
