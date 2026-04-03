using ABRPOINT.Helper;
using ABRPOINT.Server.CalculService.CalcTotHeures;
using ABRPOINT.Server.CalculService.HeureAbsences;
using ABRPOINT.Server.CalculService.HeureSupp;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using AutoMapper;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Repository
{
    public class PointageOptimizer : IPointageOptimizerService
    {
        private readonly ApplicationDbContext _context;
        private readonly IParametreRepository _parametreRepository;
        private readonly ICalcTotHeuresService _heuresService;
        private readonly IHeureSuppService _heuresSuppService;
        private readonly IHeureAbsencesService _heuresAbsenceService;
        private readonly IautoriserRepository _autorisationRepository;
        private readonly IPosteRepository _posteRepository;
        private readonly IMapper _mapper;

        public PointageOptimizer(ApplicationDbContext context,IParametreRepository parametreRepository,ICalcTotHeuresService heuresService,IMapper mapper,
            IHeureAbsencesService heureAbsencesService,IHeureSuppService heureSuppService,IautoriserRepository autorisationRepository,IPosteRepository posteRepository)
        {
            _context = context;
            _parametreRepository = parametreRepository;
            _heuresService = heuresService;
            _heuresSuppService = heureSuppService;
            _heuresAbsenceService = heureAbsencesService;
            _autorisationRepository = autorisationRepository;
            _posteRepository = posteRepository;
            _mapper = mapper;
        }

        public async Task OptimizePointage(string soccod, string empMat, DateTime dateDeb, DateTime dateFin)
        {
            var wdatopt = new DateTime(2000, 1, 1);

            try
            {
                var parametre = await _context.Parametres
                    .FirstOrDefaultAsync(p => p.Soccod == soccod);

                if (parametre?.Optimise != null)
                    wdatopt = parametre.Optimise.Value;

                // Cas optimisation globale
                if (empMat == "*")
                {
                    var employeesToUpdate = await _context.Employes
                        .Where(e => e.Empoptim == null && e.Soccod == soccod)
                        .ToListAsync();

                    foreach (var emp in employeesToUpdate)
                    {
                        emp.Empoptim = wdatopt;
                    }

                    await _context.SaveChangesAsync();
                }

                // 🔹 Chargement des présences selon période
                var presences = await (
                    from presence in _context.Presences
                    join emp in _context.Employes on presence.Empcod equals emp.Empcod
                    where presence.Soccod == soccod &&
                          (
                              empMat != "*"
                                  ? presence.Empcod == empMat &&
                                    presence.Predat >= dateDeb.Date &&
                                    presence.Predat <= dateFin.Date
                                  : presence.Predat >= wdatopt &&
                                    (emp.Empoptim == null || emp.Empoptim >= wdatopt)
                          )
                    orderby presence.Empcod, presence.Predat
                    select presence
                ).ToListAsync();

                // 🔹 Charger tous les postes une seule fois
                var allPostes = await _context.Postes
                    .Where(p => p.Soccod == soccod)
                    .ToListAsync();

                var nuitparam = await _parametreRepository
                    .GetParametresNuitAsync(soccod);

                // 🔹 Décaler si première entrée vide
                foreach (var item in presences)
                {
                    //var lpoint = await _context.Lpointjours
                    //    .FirstOrDefaultAsync(lp =>
                    //        lp.Soccod == soccod &&
                    //        lp.Empcod == item.Empcod &&
                    //        lp.Saljour == item.Predat);

                    //if (lpoint != null)
                    //    continue;

                    if (string.IsNullOrEmpty(item.Preentmatup))
                    {
                        item.Preentmatup = item.Presortmatup;
                        item.Presortmatup = item.Preentamidiup;
                        item.Preentamidiup = item.Presortamidiup;
                        item.Presortamidiup = null;
                    }
                }

                // 🔹 Gestion des shifts de nuit
                for (int i = 0; i < presences.Count; i++)
                {
                    var item = presences[i];

                    //var lpoint = await _context.Lpointjours
                    //    .FirstOrDefaultAsync(lp =>
                    //        lp.Soccod == soccod &&
                    //        lp.Empcod == item.Empcod &&
                    //        lp.Saljour == item.Predat);

                    //if (lpoint != null)
                    //    continue;
                    item.Optimise = "O";
                    bool isNuitMatin =
                        !string.IsNullOrEmpty(item.Preentmatup) &&
                        GenericMethodes.ConvertTimeToDecimal(item.Preentmatup) >=
                        GenericMethodes.ConvertTimeToDecimal(nuitparam.Nuitdeb) &&
                        string.IsNullOrEmpty(item.Presortmatup);

                    bool isNuitAprem =
                        !string.IsNullOrEmpty(item.Preentamidiup) &&
                        GenericMethodes.ConvertTimeToDecimal(item.Preentamidiup) >=
                        GenericMethodes.ConvertTimeToDecimal(nuitparam.Nuitdeb) &&
                        string.IsNullOrEmpty(item.Presortamidiup);

                    if (isNuitAprem || isNuitMatin)
                    {
                        var nextDayItem = presences
                            .Skip(i + 1)
                            .FirstOrDefault(x =>
                                x.Empcod == item.Empcod &&
                                x.Predat > item.Predat);

                        if (nextDayItem != null &&
                            !string.IsNullOrEmpty(nextDayItem.Preentmatup))
                        {
                            if (string.IsNullOrEmpty(item.Presortmatup))
                                item.Presortmatup = nextDayItem.Preentmatup;
                            else if (string.IsNullOrEmpty(item.Presortamidiup))
                                item.Presortamidiup = nextDayItem.Preentamidiup;

                            // Vider l'entrée du jour suivant
                            nextDayItem.Preentmatup = null;
                        }
                    }

                    // 🔹 NOUVEAU : Déterminer le poste le plus proche
                    var closestPoste = await FindClosestPoste(item, allPostes);
                    if (closestPoste != null)
                    {
                        item.Codposte = closestPoste.Codposte;
                        var presenceDto = _mapper.Map<Presence, PresenceDto>(item);
                        item.Tothsup = GenericMethodes.ConvertDoubleToHHmm((float?)await _heuresSuppService
                            .CalculateHeureSuppOptimise(presenceDto, allPostes.Where(p => p.Soccod == soccod && p.Codposte == closestPoste.Codposte).First()));
                        var hretrav = await _heuresService.CalcHreTravOptimise(presenceDto);
                        item.Tothre = hretrav;
                        AutDto autorisation = await _autorisationRepository.GetAutLib(soccod, item.Empcod, (DateTime)item.Predat);
                        item.Tothabs = GenericMethodes.ConvertDoubleToHHmm(await _heuresAbsenceService.CalculateHeureAbsences(item, soccod, item.Codposte, item.Predat, autorisation,GenericMethodes.ConvertHHmmToDouble(hretrav)));
                    }
                }

                // 🔹 Un seul SaveChanges
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                throw new Exception("Optimization failed: " + ex.Message, ex);
            }
        }

        // 🔹 NOUVELLE MÉTHODE : Trouver le poste le plus proche en utilisant GetStartsWorkDay
        private async Task<Poste> FindClosestPoste(Presence presence, List<Poste> postes)
        {
            if (postes == null || !postes.Any() || presence?.Predat == null)
                return null;

            TimeSpan? presenceEntreeMatin = null;
            TimeSpan? presenceEntreeAmidi = null;

            if (!string.IsNullOrEmpty(presence.Preentmatup) &&
                TimeSpan.TryParse(presence.Preentmatup, out TimeSpan entMat))
                presenceEntreeMatin = entMat;

            if (!string.IsNullOrEmpty(presence.Preentamidiup) &&
                TimeSpan.TryParse(presence.Preentamidiup, out TimeSpan entAm))
                presenceEntreeAmidi = entAm;

            // ─── PRIORITÉ 1 : Affectation par plage de tolérance (dematin/fematin, deamidi/feamidi) ───
            foreach (var poste in postes)
            {
                var (deMatinDeb, deMatinFin, deAmidiDeb, deAmidiFin) =
                    GetTolerancePlages(presence.Predat, poste);

                // Entrée matin dans la plage tolérance matin du poste
                if (presenceEntreeMatin.HasValue &&
                    deMatinDeb.HasValue && deMatinFin.HasValue &&
                    presenceEntreeMatin.Value >= deMatinDeb.Value &&
                    presenceEntreeMatin.Value <= deMatinFin.Value)
                {
                    return poste;
                }

                // Entrée amidi dans la plage tolérance amidi du poste
                if (presenceEntreeAmidi.HasValue &&
                    deAmidiDeb.HasValue && deAmidiFin.HasValue &&
                    presenceEntreeAmidi.Value >= deAmidiDeb.Value &&
                    presenceEntreeAmidi.Value <= deAmidiFin.Value)
                {
                    return poste;
                }
            }

            // ─── PRIORITÉ 2 : Fallback → poste le plus proche (logique existante) ────
            TimeSpan? presenceEntree = presenceEntreeMatin ?? presenceEntreeAmidi;
            TimeSpan? presenceSortie = GetLastExitTime(presence);

            if (!presenceEntree.HasValue || !presenceSortie.HasValue)
            {
                string? codpost = await _posteRepository.GetEmpPoste(
                    presence.Soccod, presence.Empcod, presence.Predat, presence.Catcod);
                return await _posteRepository.GetPoste(presence.Soccod, codpost);
            }

            Poste closestPoste = null;
            double minDifference = double.MaxValue;

            foreach (var poste in postes)
            {
                var (morningStart, morningEnd, eveningStart, eveningEnd) =
                    GenericMethodes.GetStartsWorkDay(presence.Predat, poste);

                TimeSpan? posteEntree = null;
                TimeSpan? posteSortie = null;

                if (!string.IsNullOrEmpty(morningStart) &&
                    TimeSpan.TryParse(morningStart, out TimeSpan entMatF))
                    posteEntree = entMatF;
                else if (!string.IsNullOrEmpty(eveningStart) &&
                         TimeSpan.TryParse(eveningStart, out TimeSpan entAmF))
                    posteEntree = entAmF;

                if (!string.IsNullOrEmpty(eveningEnd) &&
                    TimeSpan.TryParse(eveningEnd, out TimeSpan sortAmF))
                    posteSortie = sortAmF;
                else if (!string.IsNullOrEmpty(morningEnd) &&
                         TimeSpan.TryParse(morningEnd, out TimeSpan sortMatF))
                    posteSortie = sortMatF;

                if (!posteEntree.HasValue || !posteSortie.HasValue)
                    continue;

                double diffEntree = Math.Abs((presenceEntree.Value - posteEntree.Value).TotalMinutes);
                double diffSortie = Math.Abs((presenceSortie.Value - posteSortie.Value).TotalMinutes);
                double totalDifference = diffEntree + diffSortie;

                if (totalDifference < minDifference)
                {
                    minDifference = totalDifference;
                    closestPoste = poste;
                }
            }

            return closestPoste;
        }

        // ─── HELPER : Extraire les plages de tolérance selon le jour de la semaine ───
        private (TimeSpan? deMatinDeb, TimeSpan? deMatinFin, TimeSpan? deAmidiDeb, TimeSpan? deAmidiFin)
            GetTolerancePlages(DateTime? predat, Poste poste)
        {
            if (predat == null) return (null, null, null, null);

            string? rawDeMatinDeb = null, rawDeMatinFin = null;
            string? rawDeAmidiDeb = null, rawDeAmidiFin = null;

            switch (predat.Value.DayOfWeek)
            {
                case DayOfWeek.Monday:
                    rawDeMatinDeb = poste.Lunhdematin; rawDeMatinFin = poste.Lunhfematin;
                    rawDeAmidiDeb = poste.Lunhdeamidi; rawDeAmidiFin = poste.Lunhfeamidi;
                    break;
                case DayOfWeek.Tuesday:
                    rawDeMatinDeb = poste.Marhdematin; rawDeMatinFin = poste.Marhfematin;
                    rawDeAmidiDeb = poste.Marhdeamidi; rawDeAmidiFin = poste.Marhfeamidi;
                    break;
                case DayOfWeek.Wednesday:
                    rawDeMatinDeb = poste.Merhdematin; rawDeMatinFin = poste.Merhfematin;
                    rawDeAmidiDeb = poste.Merhdeamidi; rawDeAmidiFin = poste.Merhfeamidi;
                    break;
                case DayOfWeek.Thursday:
                    rawDeMatinDeb = poste.Jeuhdematin; rawDeMatinFin = poste.Jeuhfematin;
                    rawDeAmidiDeb = poste.Jeuhdeamidi; rawDeAmidiFin = poste.Jeuhfeamidi;
                    break;
                case DayOfWeek.Friday:
                    rawDeMatinDeb = poste.Venhdematin; rawDeMatinFin = poste.Venhfematin;
                    rawDeAmidiDeb = poste.Venhdeamidi; rawDeAmidiFin = poste.Venhfeamidi;
                    break;
                case DayOfWeek.Saturday:
                    rawDeMatinDeb = poste.Samhdematin; rawDeMatinFin = poste.Samhfematin;
                    rawDeAmidiDeb = poste.Samhdeamidi; rawDeAmidiFin = poste.Samhfeamidi;
                    break;
                case DayOfWeek.Sunday:
                    rawDeMatinDeb = poste.Dimhdematin; rawDeMatinFin = poste.Dimhfematin;
                    rawDeAmidiDeb = poste.Dimhdeamidi; rawDeAmidiFin = poste.Dimhfeamidi;
                    break;
            }

            TimeSpan? Parse(string? raw) =>
                !string.IsNullOrEmpty(raw) && TimeSpan.TryParse(raw, out var ts) ? ts : null;

            return (Parse(rawDeMatinDeb), Parse(rawDeMatinFin),
                    Parse(rawDeAmidiDeb), Parse(rawDeAmidiFin));
        }
        // 🔹 HELPER : Récupérer la première heure d'entrée de la présence
        private TimeSpan? GetFirstEntryTime(Presence presence)
        {
            if (!string.IsNullOrEmpty(presence.Preentmatup) &&
                TimeSpan.TryParse(presence.Preentmatup, out TimeSpan entmat))
                return entmat;

            if (!string.IsNullOrEmpty(presence.Preentamidiup) &&
                TimeSpan.TryParse(presence.Preentamidiup, out TimeSpan entam))
                return entam;

            return null;
        }

        // 🔹 HELPER : Récupérer la dernière heure de sortie de la présence
        private TimeSpan? GetLastExitTime(Presence presence)
        {
            if (!string.IsNullOrEmpty(presence.Presortmatup) &&
                TimeSpan.TryParse(presence.Presortmatup, out TimeSpan sortmat))
                return sortmat;

            if (!string.IsNullOrEmpty(presence.Presortamidiup) &&
                TimeSpan.TryParse(presence.Presortamidiup, out TimeSpan sortam))
                return sortam;


            return null;
        }

    }
}