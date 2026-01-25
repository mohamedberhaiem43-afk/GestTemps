using ABRPOINT.Helper;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.CalculService.HeureRetard
{
    public class HeureRetardService : IHeureRetardService
    {
        private readonly ApplicationDbContext _dbContext;
        private readonly IPosteRepository _posteRepository;
        public HeureRetardService(ApplicationDbContext dbContext,IPosteRepository posteRepository)
        {
            _dbContext = dbContext;
            _posteRepository = posteRepository;
        }
        private int ApplySanction(int retard, int min, int bonus)
        {
            return (min > 0 && retard >= min) ? bonus : 0;
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

            if (poste == null)
            {
                string codpost = await _posteRepository.GetEmpPoste(
                    presence.Soccod, presence.Empcod, presence.Predat);
                poste = await _posteRepository.GetPoste(presence.Soccod, codpost);
            }

            var (morningStartTime, morningEndTime, eveningStartTime, eveningEndTime) =
                GenericMethodes.GetStartsWorkDay(presence.Dmdate, poste);

            if (string.IsNullOrEmpty(morningStartTime) || string.IsNullOrEmpty(presence.Preentmatup))
                return 0;

            string? empretard = await _dbContext.Employes
                .Where(e => e.Soccod == presence.Soccod && e.Empcod == presence.Empcod)
                .Select(e => e.Empretard)
                .SingleOrDefaultAsync();

            if (string.IsNullOrEmpty(empretard) || empretard == "1")
                return 0;

            TimeSpan morningStart = TimeSpan.Parse(morningStartTime);
            TimeSpan morningEnd = TimeSpan.Parse(morningEndTime);

            TimeSpan actualMorningArrival = TimeSpan.Parse(presence.Preentmatup);
            TimeSpan actualMorningDeparture =
                !string.IsNullOrEmpty(presence.Presortmatup)
                    ? TimeSpan.Parse(presence.Presortmatup)
                    : TimeSpan.Zero;

            TimeSpan eveningStart =
                !string.IsNullOrEmpty(eveningStartTime) ? TimeSpan.Parse(eveningStartTime) : TimeSpan.Zero;
            TimeSpan eveningEnd =
                !string.IsNullOrEmpty(eveningEndTime) ? TimeSpan.Parse(eveningEndTime) : TimeSpan.Zero;

            TimeSpan actualEveningArrival =
                !string.IsNullOrEmpty(presence.Preentamidiup)
                    ? TimeSpan.Parse(presence.Preentamidiup)
                    : TimeSpan.Zero;

            TimeSpan actualEveningDeparture =
                !string.IsNullOrEmpty(presence.Presortamidiup)
                    ? TimeSpan.Parse(presence.Presortamidiup)
                    : TimeSpan.Zero;

            bool isSingleSession =
                eveningStart == TimeSpan.Zero || eveningEnd == TimeSpan.Zero;

            int toleranceEntree = poste.Apresent ?? 0;
            int toleranceSortie = poste.Avantsort ?? 0;

            // =======================
            // ⏰ Entrée matin
            // =======================
            int retardMatin = (int)(actualMorningArrival - morningStart).TotalMinutes;

            if (retardMatin > toleranceEntree &&
                !IsInAutorisation(actualMorningArrival, autoisation) &&
                retardMatin / 60 < 3)
            {
                nbRetard += retardMatin;
                nbRetard += ApplySanction(retardMatin, poste.Retmin ?? 0, poste.Retsanc ?? 0);
            }

            // =======================
            // 🚪 Sortie matin
            // =======================
            if (actualMorningDeparture != TimeSpan.Zero)
            {
                int sortieMatin = (int)(morningEnd - actualMorningDeparture).TotalMinutes;

                if (sortieMatin > toleranceSortie &&
                    !IsInAutorisation(actualMorningDeparture, autoisation) &&
                    sortieMatin / 60 < 3)
                {
                    nbRetard += sortieMatin;
                    nbRetard += ApplySanction(sortieMatin, poste.Avamn ?? 0, poste.Avabon ?? 0);
                }
            }

            if (!isSingleSession)
            {
                // =======================
                // 🌆 Entrée après-midi
                // =======================
                if (actualEveningArrival != TimeSpan.Zero)
                {
                    int retardAm = (int)(actualEveningArrival - eveningStart).TotalMinutes;

                    if (retardAm > toleranceSortie &&
                        !IsInAutorisation(actualEveningArrival, autoisation) &&
                        retardAm / 60 < 3)
                    {
                        nbRetard += retardAm;
                        nbRetard += ApplySanction(
                            retardAm,
                            poste.Retminam ?? poste.Retmin ?? 0,
                            poste.Retsancam ?? poste.Retsanc ?? 0);
                    }
                }

                // =======================
                // 🌙 Sortie après-midi
                // =======================
                if (actualEveningDeparture != TimeSpan.Zero)
                {
                    int sortieAm = (int)(eveningEnd - actualEveningDeparture).TotalMinutes;

                    if (sortieAm > toleranceSortie &&
                        !IsInAutorisation(actualEveningDeparture, autoisation) &&
                        sortieAm / 60 < 3)
                    {
                        nbRetard += sortieAm;
                        nbRetard += ApplySanction(
                            sortieAm,
                            poste.Avamnam ?? poste.Avamn ?? 0,
                            poste.Avabonam ?? poste.Avabon ?? 0);
                    }
                }
            }

            return nbRetard;
        }
    }

}
