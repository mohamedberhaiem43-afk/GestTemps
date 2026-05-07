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

        public HeureRetardService(ApplicationDbContext dbContext, IPosteRepository posteRepository)
        {
            _dbContext = dbContext;
            _posteRepository = posteRepository;
        }

        // Conservé pour les sanctions de SORTIE ANTICIPÉE (Avabon/Avabonam) qui
        // n'ont pas changé de sémantique : si on quitte plus de `min` minutes
        // avant l'heure prévue, on ajoute `bonus` minutes flat.
        private int ApplySanction(int retard, int min, int bonus)
        {
            return (min > 0 && retard >= min) ? bonus : 0;
        }

        /// <summary>
        /// Sanction par <b>coefficient multiplicateur</b> appliquée au retard à
        /// l'entrée (matin et après-midi). Quand le retard dépasse <paramref name="seuilMin"/>
        /// minutes, on multiplie le retard brut par <paramref name="coef"/>.
        /// </summary>
        /// <remarks>
        /// Le retard brut est déjà ajouté à <c>nbRetard</c> côté appelant
        /// (<c>nbRetard += retardMatinNet</c>), donc cette méthode renvoie
        /// uniquement le <b>supplément</b> dû au coefficient :
        /// <c>retard × (coef − 1)</c>.
        ///
        /// Exemple : retard = 60 min, seuilMin = 30, coef = 2
        ///   → retour = 60 × (2 − 1) = 60 min
        ///   → total décompté = 60 (brut) + 60 (sanction) = 120 min (= 2 h)
        ///
        /// Si <paramref name="coef"/> ≤ 1 ou si le retard est sous le seuil,
        /// aucune sanction n'est ajoutée.
        /// </remarks>
        private int ApplyRetardMultiplier(int retard, int seuilMin, int coef)
        {
            if (seuilMin <= 0 || retard < seuilMin || coef <= 1) return 0;
            return retard * (coef - 1);
        }

        /// <summary>
        /// Retourne le nombre de minutes de chevauchement entre la plage [rangeStart, rangeEnd] et la plage
        /// d'autorisation. Sert à neutraliser la portion de retard qui tombe dans une autorisation.
        /// </summary>
        private int OverlapMinutes(TimeSpan rangeStart, TimeSpan rangeEnd, AutDto autorisation)
        {
            if (autorisation?.Condep == null || autorisation?.Conret == null) return 0;
            if (rangeEnd <= rangeStart) return 0;

            var authStart = autorisation.Condep.Value.TimeOfDay;
            var authEnd = autorisation.Conret.Value.TimeOfDay;
            if (authEnd <= authStart) return 0;

            var overlapStart = rangeStart > authStart ? rangeStart : authStart;
            var overlapEnd = rangeEnd < authEnd ? rangeEnd : authEnd;
            if (overlapEnd <= overlapStart) return 0;

            return (int)(overlapEnd - overlapStart).TotalMinutes;
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

        public async Task<(int nbRetard, DateTime? Preretame, DateTime? Preretameup, DateTime? Preretmate, DateTime? Preretmateup, DateTime? Preretmats, DateTime? Preretmatsup, DateTime? Preretams, DateTime? Preretamsup)> CalculateHeureRetard(PresenceDto presence, Poste poste, AutDto autoisation)
        {
            int nbRetard = 0;

            if (poste == null)
            {
                string? codpost = await _posteRepository.GetEmpPoste(presence.Soccod, presence.Empcod, presence.Predat, presence.Catcod);
                if (string.IsNullOrEmpty(codpost))
                    return (0, null, null, null, null, null, null, null, null);

                poste = await _posteRepository.GetPoste(presence.Soccod, codpost);
            }

            if (poste == null)
                return (0, null, null, null, null, null, null, null, null);

            var (morningStartTime, morningEndTime, eveningStartTime, eveningEndTime) =
                GenericMethodes.GetStartsWorkDay(presence.Dmdate, poste);

            if (string.IsNullOrEmpty(morningStartTime) || string.IsNullOrEmpty(presence.Preentmatup))
                return (0, null, null, null, null, null, null, null, null);

            string? empretard = await _dbContext.Employes
                .Where(e => e.Soccod == presence.Soccod && e.Empcod == presence.Empcod)
                .Select(e => e.Empretard)
                .SingleOrDefaultAsync();

            if (string.IsNullOrEmpty(empretard) || empretard == "1")
                return (0, null, null, null, null, null, null, null, null);

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

            // Soustraire la portion de retard couverte par une autorisation : si l'autorisation chevauche
            // [morningStart, actualArrival], cette intersection est "autorisée" et ne doit pas être comptée.
            int retardCouvertParAutorisation = OverlapMinutes(morningStart, actualMorningArrival, autoisation);
            int retardMatinNet = Math.Max(0, retardMatin - retardCouvertParAutorisation);

            if (retardMatinNet > toleranceEntree &&
                retardMatinNet / 60 < 3)
            {
                nbRetard += retardMatinNet;
                // Coefficient multiplicateur (cf. PosteTravailModern → "Sanctions de retard")
                nbRetard += ApplyRetardMultiplier(retardMatinNet, poste.Retmin ?? 0, poste.Retsanc ?? 0);

                presence.Preretmateup = ToRetardDate(TimeSpan.FromMinutes(retardMatinNet));
                if (presence.Preretmate == null)
                    presence.Preretmate = ToRetardDate(TimeSpan.FromMinutes(retardMatinNet));
            }

            // =======================
            // 🚪 Sortie matin
            // =======================
            if (actualMorningDeparture != TimeSpan.Zero)
            {
                int sortieMatin = (int)(morningEnd - actualMorningDeparture).TotalMinutes;
                int sortieMatinNet = Math.Max(0, sortieMatin - OverlapMinutes(actualMorningDeparture, morningEnd, autoisation));

                if (sortieMatinNet > toleranceSortie &&
                    sortieMatinNet / 60 < 3)
                {
                    nbRetard += sortieMatinNet;
                    nbRetard += ApplySanction(sortieMatinNet, poste.Avamn ?? 0, poste.Avabon ?? 0);

                    presence.Preretameup = ToRetardDate(TimeSpan.FromMinutes(sortieMatinNet));
                    if (presence.Preretame == null)
                        presence.Preretame = ToRetardDate(TimeSpan.FromMinutes(sortieMatinNet));
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
                    int retardAmNet = Math.Max(0, retardAm - OverlapMinutes(eveningStart, actualEveningArrival, autoisation));

                    if (retardAmNet > toleranceSortie &&
                        retardAmNet / 60 < 3)
                    {
                        nbRetard += retardAmNet;
                        // Coefficient multiplicateur (fallback sur les valeurs matin si non définies pour l'AM)
                        nbRetard += ApplyRetardMultiplier(
                            retardAmNet,
                            poste.Retminam ?? poste.Retmin ?? 0,
                            poste.Retsancam ?? poste.Retsanc ?? 0);

                        presence.Preretameup = ToRetardDate(TimeSpan.FromMinutes(retardAmNet));
                        if (presence.Preretame == null)
                            presence.Preretame = ToRetardDate(TimeSpan.FromMinutes(retardAmNet));
                    }
                }

                // =======================
                // 🌙 Sortie après-midi
                // =======================
                if (actualEveningDeparture != TimeSpan.Zero)
                {
                    int sortieAm = (int)(eveningEnd - actualEveningDeparture).TotalMinutes;
                    int sortieAmNet = Math.Max(0, sortieAm - OverlapMinutes(actualEveningDeparture, eveningEnd, autoisation));

                    if (sortieAmNet > toleranceSortie &&
                        sortieAmNet / 60 < 3)
                    {
                        nbRetard += sortieAmNet;
                        nbRetard += ApplySanction(
                            sortieAmNet,
                            poste.Avamnam ?? poste.Avamn ?? 0,
                            poste.Avabonam ?? poste.Avabon ?? 0);

                        presence.Preretamsup = ToRetardDate(TimeSpan.FromMinutes(sortieAmNet));
                        if (presence.Preretams == null)
                            presence.Preretams = ToRetardDate(TimeSpan.FromMinutes(sortieAmNet));
                    }
                }
            }

            return (nbRetard, presence.Preretame, presence.Preretameup, presence.Preretmate,
                presence.Preretmateup, presence.Preretmats, presence.Preretmatsup, presence.Preretams, presence.Preretamsup);
        }

        private static DateTime ToRetardDate(TimeSpan retard)
        {
            return new DateTime(1900, 1, 1)
                .AddHours(retard.Hours)
                .AddMinutes(retard.Minutes);
        }
    }
}