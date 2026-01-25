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
using System.Threading.Tasks;

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
                    var lpoint = await _context.Lpointjours
                        .FirstOrDefaultAsync(lp =>
                            lp.Soccod == soccod &&
                            lp.Empcod == item.Empcod &&
                            lp.Saljour == item.Predat);

                    if (lpoint != null)
                        continue;

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
                        var hretrav = await _heuresService.CalcHreTrav(presenceDto);
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

            // Extraire les heures d'entrée et de sortie de la présence
            TimeSpan? presenceEntree = GetFirstEntryTime(presence);
            TimeSpan? presenceSortie = GetLastExitTime(presence);

            if (!presenceEntree.HasValue || !presenceSortie.HasValue)
            {
                string? codpost = await _posteRepository.GetEmpPoste(presence.Soccod, presence.Empcod, presence.Predat);
                Poste? poste = await _posteRepository.GetPoste(presence.Soccod,codpost);
                return poste;
            }

            Poste closestPoste = null;
            double minDifference = double.MaxValue;

            foreach (var poste in postes)
            {
                // 🔹 Utiliser GetStartsWorkDay pour obtenir les horaires du poste selon le jour
                var (morningStart, morningEnd, eveningStart, eveningEnd) =
                    GenericMethodes.GetStartsWorkDay(presence.Predat, poste);

                // Parser les heures du poste
                TimeSpan? posteEntree = null;
                TimeSpan? posteSortie = null;

                // Déterminer l'entrée du poste (matin prioritaire)
                if (!string.IsNullOrEmpty(morningStart) &&
                    TimeSpan.TryParse(morningStart, out TimeSpan entMat))
                {
                    posteEntree = entMat;
                }
                else if (!string.IsNullOrEmpty(eveningStart) &&
                         TimeSpan.TryParse(eveningStart, out TimeSpan entAm))
                {
                    posteEntree = entAm;
                }

                // Déterminer la sortie du poste (après-midi prioritaire)
                if (!string.IsNullOrEmpty(eveningEnd) &&
                    TimeSpan.TryParse(eveningEnd, out TimeSpan sortAm))
                {
                    posteSortie = sortAm;
                }
                else if (!string.IsNullOrEmpty(morningEnd) &&
                         TimeSpan.TryParse(morningEnd, out TimeSpan sortMat))
                {
                    posteSortie = sortMat;
                }

                // Si on n'a pas trouvé d'horaires valides, passer au poste suivant
                if (!posteEntree.HasValue || !posteSortie.HasValue)
                    continue;

                // Calculer la différence totale (entrée + sortie)
                double diffEntree = Math.Abs((presenceEntree.Value - posteEntree.Value).TotalMinutes);
                double diffSortie = Math.Abs((presenceSortie.Value - posteSortie.Value).TotalMinutes);
                double totalDifference = diffEntree + diffSortie;

                // Garder le poste avec la plus petite différence
                if (totalDifference < minDifference)
                {
                    minDifference = totalDifference;
                    closestPoste = poste;
                }
            }

            return closestPoste;
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
            if (!string.IsNullOrEmpty(presence.Presortamidiup) &&
                TimeSpan.TryParse(presence.Presortamidiup, out TimeSpan sortam))
                return sortam;

            if (!string.IsNullOrEmpty(presence.Presortmatup) &&
                TimeSpan.TryParse(presence.Presortmatup, out TimeSpan sortmat))
                return sortmat;

            return null;
        }

    }
}