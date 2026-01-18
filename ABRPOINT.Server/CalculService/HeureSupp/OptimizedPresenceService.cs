using ABRPOINT.Helper;
using ABRPOINT.Server.CalculService.Conge;
using ABRPOINT.Server.CalculService.HeureAbsences;
using ABRPOINT.Server.CalculService.HeureRetard;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using AutoMapper;
using Microsoft.EntityFrameworkCore;
using System.Threading.Tasks;
using static System.Runtime.InteropServices.JavaScript.JSType;

namespace ABRPOINT.Server.CalculService.HeureSupp
{
    public class OptimizedPresenceService : IOptimizedPresenceService
    {
        private readonly ApplicationDbContext _dbContext;
        private readonly IParametreRepository _parametreRepository;
        private readonly IEmployeRepository _employeRepository;
        private readonly ICongeRepository _congeRepository;
        private readonly IJourFerieRepository _jourFerierRepository;
        private readonly ISanctionRepository _sanctionRepository;
        private readonly IPosteRepository _posteRepository;
        private readonly IautoriserRepository _autorisationRepository;
        private readonly IHeureAbsencesService _heureabsenceService;
        private readonly ICongeCalculationService _congeCalculationService;
        private readonly IHeureRetardService _retardService;
        private readonly IAllaitementRepository _allaitementRepository;
        private readonly IMapper _mapper;

        public OptimizedPresenceService(ApplicationDbContext dbContext, IParametreRepository parametreRepository, IEmployeRepository employeRepository,
            ICongeRepository congeRepository, IJourFerieRepository ferieRepository, ISanctionRepository sanctionRepository, IPosteRepository posteRepository,
            IautoriserRepository autoriserRepository, IHeureAbsencesService heureabscenceRepository, ICongeCalculationService congeCalculationService, IHeureRetardService heureRetardService,
            IAllaitementRepository allaitementRepository, IMapper mapper)
        {
            _dbContext = dbContext;
            _parametreRepository = parametreRepository;
            _employeRepository = employeRepository;
            _congeRepository = congeRepository;
            _posteRepository = posteRepository;
            _jourFerierRepository = ferieRepository;
            _sanctionRepository = sanctionRepository;
            _autorisationRepository = autoriserRepository;
            _heureabsenceService = heureabscenceRepository;
            _congeCalculationService = congeCalculationService;
            _retardService = heureRetardService;
            _allaitementRepository = allaitementRepository;
            _mapper = mapper;
        }

        // Method 1: Get presence data (OPTIMIZED)
        public async Task<PresenceSemaineData> GetPresenceSemaineDataOptimized(
            string soccod, string empcod, string mois, string annee, string semaine, string emppanier)
        {
            try
            {
                // Validate inputs
                if (string.IsNullOrEmpty(soccod) || string.IsNullOrEmpty(empcod) ||
                    string.IsNullOrEmpty(mois) || string.IsNullOrEmpty(annee))
                    return null;

                if (!int.TryParse(mois, out int month) || !int.TryParse(annee, out int year))
                    return null;

                // Get parameters once
                var parametreMoisPointage = await _parametreRepository.GetParametreMoisPointage(soccod);
                if (parametreMoisPointage == null) return null;

                var parametreNuit = await _parametreRepository.GetParametresNuitAsync(soccod);

                // Calculate date range - USE THE SAME LOGIC AS GetNbHeuresParSemaineWithDates
                var (startDate, endDate) = CalculateDateRange(parametreMoisPointage, month, year, semaine);
                var allDates = GenerateDateList(startDate, endDate);

                // LOAD ALL DATA UPFRONT (batch queries)
                var dataCache = await LoadAllDataAsync(soccod, empcod, startDate, endDate, allDates);

                // Initialize result accumulators
                var result = new PresenceSemaineData
                {
                    WeekDetails = new Dictionary<string, string>()
                };

                var accumulators = InitializeAccumulators();
                var countedSanctions = new HashSet<string>();
                var countedConges = new HashSet<string>();

                // Process each day
                foreach (var date in allDates)
                {
                    await ProcessDay(
                        date,
                        dataCache,
                        parametreMoisPointage,
                        parametreNuit,
                        emppanier,
                        accumulators,
                        countedSanctions,
                        countedConges,
                        result.WeekDetails,
                        soccod,
                        empcod
                    );
                }


                // Map accumulators to result
                MapAccumulatorsToResult(accumulators, result);

                if (result.NbJours < 0) result.NbJours = 0;

                return result;
            }
            catch (Exception)
            {
                throw;
            }
        }
        private async Task<DataCache> LoadAllDataAsync(
           string soccod, string empcod, DateTime startDate, DateTime endDate, List<DateTime> allDates)
        {
            var cache = new DataCache();

            // Load all presences for the period
            var presences = await _dbContext.Presences
                .Where(p => p.Soccod == soccod &&
                           p.Empcod == empcod &&
                           p.Predat >= startDate &&
                           p.Predat <= endDate)
                .ToListAsync();

            cache.PresencesByDate = presences
                .Where(p => p.Predat.HasValue)
                .ToDictionary(p => p.Predat.Value.Date);

            // Load all sanctions for the period
            List<SanctionDto> sanctions = await _sanctionRepository.GetSanctionsByPeriod(soccod, empcod, startDate, endDate);
            cache.SanctionsByDate = sanctions.ToDictionary(s => (DateTime)s.Condat);

            // Load all conges for the period
            List<CongeDto> conges = await _congeRepository.GetCongesByPeriod(soccod, empcod, startDate, endDate);
            cache.CongesByDate = conges
            .Where(c => c.Condat.HasValue)
            .GroupBy(c => c.Condat!.Value.Date)
            .ToDictionary(
                g => g.Key,
                g => g.First()
            );


            // Load all feriers for the period
            List<Ferier> feriers = await _jourFerierRepository.GetFeriersByPeriod(soccod, startDate, endDate);
            cache.FerierDates = new HashSet<DateTime>(feriers.Select(f => (DateTime)f.Ferdate));

            // Load all postes for employee in period
            Dictionary<DateTime, string> postes = await _employeRepository.GetEmpPostesByPeriod(soccod, empcod, startDate, endDate);
            cache.PostesByDate = postes;

            // Load all autorisations for period
            List<AutDto> autorisations = await _autorisationRepository.GetAutorisationsByPeriod(soccod, empcod, startDate, endDate);
            //cache.AutorisationsByDate = autorisations.ToDictionary();
            cache.AutorisationsByDate = autorisations
                .Where(a => a.Condat.HasValue)
                .GroupBy(a => a.Condat!.Value.Date)
                .ToDictionary(
                    g => g.Key,
                    g => g.First()
                );





            // Load all allaitement hours
            Dictionary<DateTime, float> allaitements = await _allaitementRepository.GetAllaitementsByPeriod(soccod, empcod, startDate, endDate);
            cache.AllaitementByDate = allaitements;

            // Load repos days
            Dictionary<DateTime, bool> reposDays = await _parametreRepository.GetReposDaysByPeriod(soccod, empcod, allDates);
            cache.ReposByDate = reposDays;

            // Load poste hours for ferier days
            Dictionary<DateTime, float> ferierHours = await _posteRepository.GetJourHeuresByPeriod(soccod, cache.FerierDates.ToList(), cache.PostesByDate);
            cache.FerierHoursByDate = ferierHours;

            return cache;
        }
        private async Task ApplyCongeImpact(DateTime date,CongeDto conge,string poste,Accumulators acc,HashSet<string> countedConges,string soccod,string empcod)
        {
            var nombreConge = await _congeCalculationService
                .CalculerNbJourAndHreCongePaye(soccod, empcod, date, poste);

            if (nombreConge.Concod == null ||
                countedConges.Contains(nombreConge.Concod) ||
                nombreConge.nbJourConge == 0)
                return;

            var nbhConge = await _parametreRepository.GetNbhConge(soccod);
            float congeHours = conge.Connbjour == 0.5 ? nbhConge.Value / 2 : nbhConge.Value;

            // 🔹 Compteurs généraux
            acc.NbJourCngPaye += nombreConge.nbJourConge;
            acc.NbHeureConge += congeHours;
            acc.NbJours -= nombreConge.nbJourConge;

            countedConges.Add(nombreConge.Concod);

            // 🔹 Typage du congé
            switch (conge.Abscng)
            {
                case "1": // CSF
                    acc.CSF += conge.Connbjour;
                    acc.HCSF += congeHours;
                    break;

                case "5": // CSS
                    acc.CSS += conge.Connbjour;
                    break;

                case "4": // MAP
                    acc.MAP += conge.Connbjour;
                    break;

                case "6": // FM
                    acc.FM += conge.Connbjour;
                    acc.Deplacement += conge.Connbjour;
                    break;

                case "8": // ACT
                    acc.ACT += conge.Connbjour;
                    break;

                case "9": // Maladie
                    acc.Maladie += conge.Connbjour;
                    break;

                case "A": // CT
                    acc.CT += conge.Connbjour;
                    break;
            }
        }

        private async Task ProcessDay(
    DateTime date,
    DataCache cache,
    ParametreMoisPointageDto paramMois,
    ParametreNuitDto paramNuit,
    string emppanier,
    Accumulators acc,
    HashSet<string> countedSanctions,
    HashSet<string> countedConges,
    IDictionary<string, string> weekDetails,
    string soccod,
    string empcod)
        {
            cache.PresencesByDate.TryGetValue(date.Date, out var presence);
            cache.SanctionsByDate.TryGetValue(date.Date, out var sanction);
            cache.CongesByDate.TryGetValue(date.Date, out var conge);
            cache.AutorisationsByDate.TryGetValue(date.Date, out var autorisation);

            bool isFerier = cache.FerierDates.Contains(date.Date);
            bool isRepos = cache.ReposByDate.TryGetValue(date.Date, out var r) && r;
            string poste = cache.PostesByDate.TryGetValue(date.Date, out var p) ? p : null;

            weekDetails.Add(
                date.ToString("yyyy-MM-dd"),
                GetWeekDetails(presence, date, sanction, conge, isFerier, isRepos)
            );

            // 1️⃣ SANCTION (indépendant)
            if (sanction != null)
            {
                await ProcessSanction(sanction, countedSanctions, acc, paramMois);
            }

            // 2️⃣ CONGÉ (prioritaire)
            if (conge != null)
            {
                await ApplyCongeImpact(
                    date, conge, poste, acc,
                    countedConges, soccod, empcod
                );
                return;
            }

            // 3️⃣ FÉRIÉ
            if (isFerier)
            {
                await ProcessFerierDay(date, presence, cache, acc, soccod, empcod);
                return;
            }
            
            // 4️⃣ ABSENCE (jour ouvrable sans présence)
            if ((presence == null || GenericMethodes.NotPresent(presence)) && !isRepos)
            {
                float? hreAbs = await _heureabsenceService
                    .CalculateHeureAbsences(presence, soccod, poste, date, autorisation);
                bool repos = await _parametreRepository.IsRepos(soccod, date, poste);
                if (hreAbs > 0 && !repos)
                {
                    acc.TotalAbsence += hreAbs;
                    acc.Absnp++;
                    acc.Absnj++;
                }
                return;
            }

            // 5️⃣ PRÉSENCE
            if (presence != null && GenericMethodes.IsValid(presence))
            {
                await ProcessPresenceDetails(
                    presence, date, isFerier, null, isRepos,
                    poste, emppanier, paramMois, paramNuit,
                    cache, acc, countedConges, autorisation,
                    soccod, empcod, true
                );
            }
        }

        // NEW: Process ferier days
        private async Task ProcessFerierDay(DateTime date,Presence presence,DataCache cache,Accumulators acc,string soccod,string empcod)
        {
            if (cache.FerierHoursByDate.TryGetValue(date, out var ferierHours))
            {
                acc.NbhFerier += ferierHours;
                acc.NbJours--; // Adjust days count for ferier
                // If working on ferier day
                if (presence != null && !string.IsNullOrEmpty(presence.Tothre))
                {
                    acc.NbJourFerier++;
                    var hreFerierTrav = await _jourFerierRepository.GetHeureFerieTrav(soccod, presence.Predat, presence.Tothre);
                    acc.NbhFerierTrv += hreFerierTrav;
                }
            }
        }


        // UPDATED: Process presence details (now only for calculations that require presence)
        private async Task ProcessPresenceDetails(
            Presence presence,
            DateTime date,
            bool isFerier,
            CongeDto conge,
            bool isRepos,
            string poste,
            string emppanier,
            ParametreMoisPointageDto paramMois,
            ParametreNuitDto paramNuit,
            DataCache cache,
            Accumulators acc,
            HashSet<string> countedConges,
            AutDto autorisation,
            string soccod,
            string empcod,
            bool isWorkingDay)
        {
            // Only calculate panier for non-conge, non-ferier days with presence
            if (!isFerier && conge == null)
            {
                CalculatePanier(presence, date, emppanier, paramMois, acc);
            }

            // Check if worked on Saturday
            if (presence.Predat.Value.DayOfWeek == DayOfWeek.Saturday &&
                GenericMethodes.ConvertHHmmToDouble(presence.Tothre) > 0 &&
                isRepos)
            {
                acc.JourSamediTrv++;
                acc.HreSamediTrv += GenericMethodes.ConvertHHmmToDouble(presence.Tothre);
            }

            // Calculate night hours
            CalculateNightHours(presence, date, paramNuit, acc);

            // Calculate delays (only for working days)
            if (isWorkingDay && presence.Prerepos == "0" && !string.IsNullOrWhiteSpace(presence.Codposte))
            {
                var posteObj = await _posteRepository.GetPoste(soccod, presence.Codposte);
                var presenceDto = _mapper.Map<Presence, PresenceDto>(presence);
                acc.Retards += await _retardService.CalculateHeureRetard(presenceDto, posteObj, autorisation);
            }

            // Count working days (only if not conge/ferier)
            if (isWorkingDay && conge == null && !isFerier)
            {
                acc.NbJourPointer++;
            }

            // Add allaitement hours
            if (cache.AllaitementByDate.TryGetValue(date, out var allaitementHours))
            {
                acc.NbhAllaitement += allaitementHours;
            }

            // Process total hours and repos
            if (!string.IsNullOrEmpty(presence.Tothre) &&
                TimeSpan.TryParseExact(presence.Tothre, "hh\\:mm", null, out TimeSpan hours))
            {
                acc.TotalHours += (float)hours.TotalHours;

                if (presence.Prerepos == "1" && isRepos)
                {
                    acc.HeureRepos += (float)hours.TotalHours;
                    acc.JourRepos++;
                }
            }
        }
        private async Task ProcessSanction(SanctionDto sanction, HashSet<string> countedSanctions, Accumulators acc, ParametreMoisPointageDto paramMois)
        {
            // Always process absnp if not paid
            if (sanction.Abspaye == "N")
                acc.Absnp += sanction.Connbjour;

            // Process based on sanction type
            switch (sanction.Abscng)
            {
                case "6": // Deplacement/FM
                    acc.Deplacement = sanction.Connbjour;
                    acc.FM = sanction.Connbjour;
                    break;
                case "1": // CSF
                    acc.CSF += sanction.Connbjour;
                    if (paramMois.Nbhconge != 0)
                        acc.HCSF += paramMois.Nbhconge;
                    else
                    {
                        float? nbhConge = await _parametreRepository.GetNbhConge(sanction.Soccod);
                        acc.HCSF += sanction.Connbjour == 0.5 ? nbhConge / 2 : nbhConge;
                    }
                    break;
                case "5": // CSS
                    acc.CSS += sanction.Connbjour;
                    break;
                case "4": // MAP
                    acc.MAP += sanction.Connbjour;
                    break;
                case "3": // Absence non justifiée
                    acc.Absnj += sanction.Connbjour;
                    break;
                case "2": // Absence justifiée
                    acc.Absj += sanction.Connbjour;
                    break;
                case "8": // ACT
                    acc.ACT += sanction.Connbjour;
                    break;
                case "9": // Maladie
                    if (sanction.Abslib?.ToLower() == "maladie")
                        acc.Maladie += sanction.Connbjour;
                    break;
                case "A": // CT
                    acc.CT += sanction.Connbjour;
                    break;
            }

            // Adjust days count for unpaid sanctions
            if (!string.IsNullOrEmpty(sanction?.Concod) && !countedSanctions.Contains(sanction.Concod))
            {
                if (sanction.Abspaye == "N")
                    acc.NbJours -= sanction.Connbjour;
                countedSanctions.Add(sanction.Concod);
            }
        }


        // Method 2: Get calendar hours with dates (FROM ORIGINAL)
        public async Task<(string? calend, float? hours, DateTime? startDate, DateTime? endDate, int? jourferier, float? heuresferier)>
    GetNbHeuresParSemaineWithDates(string soccod, string mois, string annee, string semaine, string empcod)
        {
            try
            {
                #region Validation
                if (string.IsNullOrEmpty(soccod) ||
                    string.IsNullOrEmpty(mois) ||
                    string.IsNullOrEmpty(annee) ||
                    string.IsNullOrEmpty(semaine) ||
                    string.IsNullOrEmpty(empcod))
                {
                    return ("0", 0, null, null, 0, 0);
                }
                #endregion

                #region Type calendrier
                string? type = await _dbContext.Employes
                    .Where(e => e.Empcod == empcod)
                    .Select(e => e.Caltype)
                    .FirstOrDefaultAsync();

                if (string.IsNullOrEmpty(type))
                    return ("0", 0, null, null, 0, 0);
                #endregion

                #region Paramètres mois
                var paramMois = await _parametreRepository.GetParametreMoisPointage(soccod);
                if (paramMois == null)
                    return ("0", 0, null, null, 0, 0);
                #endregion

                #region Parsing
                if (!int.TryParse(mois, out int month) ||
                    !int.TryParse(annee, out int year) ||
                    !int.TryParse(semaine, out int weekNumber))
                {
                    return ("0", 0, null, null, 0, 0);
                }
                #endregion

                #region Début / fin mois (RÉEL vs CALCUL)
                DateTime startMonthReal;
                DateTime startMonthCalc;
                DateTime endMonth;

                // ---- Jour réel (Joudeb)
                if (paramMois.Moisdeb == "P")
                {
                    int pm = month == 1 ? 12 : month - 1;
                    int py = month == 1 ? year - 1 : year;
                    startMonthReal = new DateTime(py, pm, paramMois.DebutReel);
                }
                else
                {
                    startMonthReal = new DateTime(year, month, paramMois.DebutCalc);
                }

                // ---- Jour calcul (peut être déplacé au lundi)
                startMonthCalc = startMonthReal;

                if (paramMois.Sochsup == "L")
                {
                    int delta = ((int)startMonthCalc.DayOfWeek + 6) % 7;
                    startMonthCalc = startMonthCalc.AddDays(-delta);
                }

                // ---- Fin mois
                if (paramMois.Moisfin == "P")
                {
                    int pm = month == 1 ? 12 : month - 1;
                    int py = month == 1 ? year - 1 : year;
                    endMonth = new DateTime(py, pm, int.Parse(paramMois.Joufin));
                }
                else
                {
                    endMonth = new DateTime(year, month, int.Parse(paramMois.Joufin));
                }

                startMonthReal = AdjustDayToMonth(startMonthReal);
                startMonthCalc = AdjustDayToMonth(startMonthCalc);
                endMonth = AdjustDayToMonth(endMonth);
                #endregion

                #region Chargement calendrier
                var monthDays = await _dbContext.Lcalendsocs
                    .Where(c => c.Soccod == soccod &&
                                c.Caltype == type &&
                                c.CalDate >= startMonthCalc &&
                                c.CalDate <= endMonth)
                    .OrderBy(c => c.CalDate)
                    .ToListAsync();

                if (!monthDays.Any())
                    return ("0", 0, null, null, 0, 0);
                #endregion

                #region Découpage en semaines - OPTIMIZED
                var weeks = new List<List<Lcalendsoc>>();
                var currentWeek = new List<Lcalendsoc>();

                // 🔹 BATCH 1: Load ALL feriers for the period at once
                var minDate = monthDays.Min(d => d.CalDate.Value);
                var maxDate = monthDays.Max(d => d.CalDate.Value);

                var ferierDates = await _jourFerierRepository
                    .GetFeriersByPeriod(soccod, minDate, maxDate);
                var ferierSet = new HashSet<DateTime>(ferierDates.Select(f => f.Ferdate.Value.Date));

                // 🔹 BATCH 2: Load ALL conges for employee in this period
                var conges = await _congeRepository.GetCongesByPeriod(
                    soccod,
                    empcod,
                    minDate,
                    maxDate
                );

                // Create lookup dictionary: Date -> Conge
                var congesByDate = new Dictionary<DateTime, CongeDto>();
                foreach (var c in conges.Where(c => c.Condep.HasValue && c.Conret.HasValue))
                {
                    var current = c.Condep.Value.Date;
                    var end = c.Conret.Value.Date;

                    while (current <= end)
                    {
                        if (!congesByDate.ContainsKey(current))
                        {
                            congesByDate[current] = c;
                        }
                        current = current.AddDays(1);
                    }
                }

                // 🔹 BATCH 3: Get parameter values once
                var nbhFerier = await _parametreRepository.GetNbhFerier(soccod);
                var nbhConge = await _parametreRepository.GetNbhConge(soccod);

                // 🔹 Process each day with cached data (NO MORE N+1 QUERIES!)
                foreach (var day in monthDays)
                {
                    var date = day.CalDate.Value.Date;

                    // Check ferier from cache
                    bool isFerier = ferierSet.Contains(date);

                    // Check conge from cache
                    congesByDate.TryGetValue(date, out var conge);

                    if (isFerier)
                    {
                        day.CalNbh = nbhFerier;
                    }
                    else if (conge != null)
                    {
                        day.CalNbh = conge.Connbjour == 0.5 ? nbhConge / 2 : nbhConge;
                    }

                    currentWeek.Add(day);

                    if (day.CalDate.Value.DayOfWeek == DayOfWeek.Sunday ||
                        day == monthDays.Last())
                    {
                        weeks.Add(currentWeek);
                        currentWeek = new List<Lcalendsoc>();
                    }
                }
                #endregion

                string? calend = await _dbContext.Employes
                    .Where(e => e.Empcod == empcod && e.Soccod == soccod)
                    .Select(e => e.Caltype)
                    .FirstOrDefaultAsync();

                #region TOTAL (semaine = 0)
                if (weekNumber == 0)
                {
                    var allDays = weeks.SelectMany(w => w).ToList();

                    float totalHours = allDays.Sum(d => d.CalNbh ?? 0);
                    DateTime? start = allDays.First().CalDate;
                    DateTime? end = allDays.Last().CalDate;

                    int jourFerier = 0;
                    float heuresFerier = 0;

                    foreach (var day in allDays)
                    {
                        var date = day.CalDate.Value.Date;

                        // Use cached data
                        bool isFerier = ferierSet.Contains(date);
                        congesByDate.TryGetValue(date, out var conge);

                        if (isFerier)
                        {
                            jourFerier++;
                            heuresFerier += day.CalNbh ?? 0;
                            continue;
                        }

                        if (conge != null)
                            continue;
                    }

                    return (calend, totalHours, start, end, jourFerier, heuresFerier);
                }
                #endregion

                #region Semaine précise
                if (weekNumber < 1 || weekNumber > weeks.Count)
                    return (calend, 0, null, null, 0, 0);

                var selectedWeek = weeks[weekNumber - 1];

                float weekHours = selectedWeek.Sum(d => d.CalNbh ?? 0);
                DateTime? weekStart = selectedWeek.First().CalDate;
                DateTime? weekEnd = selectedWeek.Last().CalDate;

                int jourFerierWeek = 0;
                float heuresFerierWeek = 0;

                foreach (var day in selectedWeek)
                {
                    var date = day.CalDate.Value.Date;

                    // Use cached data
                    bool isFerier = ferierSet.Contains(date);
                    congesByDate.TryGetValue(date, out var conge);

                    if (isFerier)
                    {
                        jourFerierWeek++;
                        heuresFerierWeek += day.CalNbh ?? 0;
                        continue;
                    }

                    if (conge != null)
                        continue;

                    if (day.CalDate < startMonthReal)
                        continue;
                }

                return (calend, weekHours, weekStart, weekEnd, jourFerierWeek, heuresFerierWeek);
                #endregion
            }
            catch
            {
                throw;
            }
        }
        private void CalculatePanier(
            Presence presence,
            DateTime date,
            string emppanier,
            ParametreMoisPointageDto paramMois,
            Accumulators acc)
        {
            if (!string.IsNullOrEmpty(presence.Tothre) &&
                TimeSpan.TryParseExact(presence.Tothre, "hh\\:mm", null, out TimeSpan h))
            {
                float nbHeuresJour = (float)h.TotalHours;

                DateTime startMonthReal = date.Month == 1
                    ? new DateTime(date.Year - 1, 12, paramMois.DebutReel)
                    : new DateTime(date.Year, date.Month - 1, paramMois.DebutReel);

                if (startMonthReal <= presence.Dmdate)
                {
                    if ((emppanier == "1" && nbHeuresJour >= 7) || (emppanier == "2" && nbHeuresJour >= 6))
                        acc.Panier++;
                }
            }
        }

        private void CalculateNightHours(Presence presence, DateTime date, ParametreNuitDto paramNuit, Accumulators acc)
        {
            TimeSpan? heureDebutNuit = TimeSpan.TryParse(paramNuit.Nuitdeb, out var debut) ? debut : null;
            TimeSpan? heureFinNuit = TimeSpan.TryParse(paramNuit.Nuitfin, out var fin) ? fin : null;

            if (!heureDebutNuit.HasValue || !heureFinNuit.HasValue) return;

            TimeSpan? heureEntree = TimeSpan.TryParse(presence.Preentmatup, out var ent) ? ent :
                                   TimeSpan.TryParse(presence.Preentamidiup, out var ent2) ? ent2 : null;

            TimeSpan? heureSortie = TimeSpan.TryParse(presence.Presortamidiup, out var sort) ? sort :
                                   TimeSpan.TryParse(presence.Presortmatup, out var sort2) ? sort2 : null;

            if (!heureEntree.HasValue || !heureSortie.HasValue) return;

            DateTime dateDebut = date.Date;
            DateTime entree = dateDebut.Add(heureEntree.Value);
            DateTime sortie = dateDebut.Add(heureSortie.Value);
            DateTime debutNuit = dateDebut.Add(heureDebutNuit.Value);
            DateTime finNuit = heureFinNuit > heureDebutNuit
                ? dateDebut.Add(heureFinNuit.Value)
                : dateDebut.AddDays(1).Add(heureFinNuit.Value);

            if (sortie < entree) sortie = sortie.AddDays(1);

            DateTime overlapStart = entree > debutNuit ? entree : debutNuit;
            DateTime overlapEnd = sortie < finNuit ? sortie : finNuit;

            if (overlapEnd > overlapStart)
            {
                var heuresNuit = (float)(overlapEnd - overlapStart).TotalHours;
                acc.HreNuits += heuresNuit;
                acc.NbNuits++;
            }
        }

        // Helper classes
        private class DataCache
        {
            public Dictionary<DateTime, Presence> PresencesByDate { get; set; }
            public Dictionary<DateTime, SanctionDto> SanctionsByDate { get; set; }
            public Dictionary<DateTime, CongeDto> CongesByDate { get; set; }
            public HashSet<DateTime> FerierDates { get; set; }
            public Dictionary<DateTime, string> PostesByDate { get; set; }
            public Dictionary<DateTime, AutDto> AutorisationsByDate { get; set; }
            public Dictionary<DateTime, float> AllaitementByDate { get; set; }
            public Dictionary<DateTime, bool> ReposByDate { get; set; }
            public Dictionary<DateTime, float> FerierHoursByDate { get; set; }
        }

        private class Accumulators
        {
            public float? NbhFerierTrv { get; set; } = 0;
            public int NbNuits { get; set; } = 0;
            public float? HreNuits { get; set; } = 0;
            public float? Retards { get; set; } = 0;
            public float? TotalAbsence { get; set; } = 0;
            public float? NbhFerier { get; set; } = 0;
            public float? HeureRepos { get; set; } = 0;
            public int NbJourFerier { get; set; } = 0;
            public float? TotalHours { get; set; } = 0;
            public float? NbJours { get; set; } = 0;
            public float? Maladie { get; set; } = 0;
            public int NbJourPointer { get; set; } = 0;
            public float? NbJourCngPaye { get; set; } = 0;
            public float? NbHeureConge { get; set; } = 0;
            public int JourRepos { get; set; } = 0;
            public float? Deplacement { get; set; } = 0;
            public float? NbhAllaitement { get; set; } = 0;
            public float? CSF { get; set; } = 0;
            public float? HCSF { get; set; } = 0;
            public float? CSS { get; set; } = 0;
            public float? MAP { get; set; } = 0;
            public float? FM { get; set; } = 0;
            public float? Absnj { get; set; } = 0;
            public float? Absj { get; set; } = 0;
            public float? Absnp { get; set; } = 0;
            public float? CT { get; set; } = 0;
            public float? ACT { get; set; } = 0;
            public int Panier { get; set; } = 0;
            public float? JourSamediTrv { get; set; } = 0;
            public float? HreSamediTrv { get; set; } = 0;
        }

        private Accumulators InitializeAccumulators() => new Accumulators();

        private void MapAccumulatorsToResult(Accumulators acc, PresenceSemaineData result)
        {
            result.NbhFerierTrv = acc.NbhFerierTrv;
            result.NbNuits = acc.NbNuits;
            result.HreNuits = acc.HreNuits;
            result.TotalRetards = acc.Retards;
            result.TotalAbsence = acc.TotalAbsence;
            result.HreFerier = acc.NbhFerier;
            result.HeureRepos = acc.HeureRepos;
            result.NbJourFerier = acc.NbJourFerier;
            result.TotalHours = acc.TotalHours;
            result.NbJours = acc.NbJours;
            result.Maladie = acc.Maladie;
            result.NbJourPointer = acc.NbJourPointer;
            result.NbJourCngPaye = acc.NbJourCngPaye;
            result.NbHeureConge = acc.NbHeureConge;
            result.JourRepos = acc.JourRepos;
            result.Deplacement = acc.Deplacement;
            result.NbhAllaitement = acc.NbhAllaitement;
            result.CSF = acc.CSF;
            result.HCSF = acc.HCSF;
            result.CSS = acc.CSS;
            result.MAP = acc.MAP;
            result.FM = acc.FM;
            result.Absnj = acc.Absnj;
            result.Absj = acc.Absj;
            result.Absnp = acc.Absnp;
            result.CT = acc.CT;
            result.ACT = acc.ACT;
            result.Panier = acc.Panier;
            result.JourSamediTrv = acc.JourSamediTrv;
            result.HreSamediTrv = acc.HreSamediTrv;
        }

        private (DateTime startDate, DateTime endDate) CalculateDateRange(
           ParametreMoisPointageDto param, int month, int year, string semaine)
        {
            DateTime startDate, endDate;

            // For the start date
            if (param.Moisdeb == "P") // Previous month
            {
                var previousMonth = month == 1 ? 12 : month - 1;
                var previousYear = month == 1 ? year - 1 : year;
                startDate = new DateTime(previousYear, previousMonth, param.DebutCalc);
            }
            else // Current month
            {
                startDate = new DateTime(year, month, param.DebutCalc);
            }

            // For the end date
            if (param.Moisfin == "P") // Previous month
            {
                var previousMonth = month == 1 ? 12 : month - 1;
                var previousYear = month == 1 ? year - 1 : year;
                endDate = new DateTime(previousYear, previousMonth, int.Parse(param.Joufin));
            }
            else // Current month
            {
                endDate = new DateTime(year, month, int.Parse(param.Joufin));
            }

            // Adjust for month boundaries
            startDate = AdjustDayToMonth(startDate);
            endDate = AdjustDayToMonth(endDate);

            // If specific week requested, calculate week boundaries
            if (semaine != "0" && int.TryParse(semaine, out int weekNumber) && weekNumber > 0)
            {
                DateTime weekStart, weekEnd;

                if (weekNumber == 1)
                {
                    weekStart = startDate;
                    weekEnd = weekStart;
                    while (weekEnd.DayOfWeek != DayOfWeek.Sunday && weekEnd < endDate)
                    {
                        weekEnd = weekEnd.AddDays(1);
                    }
                    endDate = weekEnd;
                }
                else
                {
                    int sundaysFound = 0;
                    DateTime currentDay = startDate;

                    while (sundaysFound < weekNumber - 1 && currentDay <= endDate)
                    {
                        if (currentDay.DayOfWeek == DayOfWeek.Sunday)
                        {
                            sundaysFound++;
                        }
                        currentDay = currentDay.AddDays(1);
                    }

                    weekStart = currentDay;
                    while (weekStart.DayOfWeek != DayOfWeek.Monday && weekStart <= endDate)
                    {
                        weekStart = weekStart.AddDays(1);
                    }

                    weekEnd = weekStart;
                    while (weekEnd.DayOfWeek != DayOfWeek.Sunday && weekEnd < endDate)
                    {
                        weekEnd = weekEnd.AddDays(1);
                    }

                    weekEnd = weekEnd > endDate ? endDate : weekEnd;

                    if (weekStart <= endDate && weekEnd >= startDate && weekStart <= weekEnd)
                    {
                        startDate = weekStart;
                        endDate = weekEnd;
                    }
                }
            }

            return (startDate, endDate);
        }
        private DateTime AdjustDayToMonth(DateTime date)
        {
            int daysInMonth = DateTime.DaysInMonth(date.Year, date.Month);
            if (date.Day > daysInMonth)
            {
                return new DateTime(date.Year, date.Month, daysInMonth);
            }
            return date;
        }

       
        private List<DateTime> GenerateDateList(DateTime start, DateTime end)
        {
            var dates = new List<DateTime>();
            DateTime current = start;
            while (current <= end)
            {
                dates.Add(current);
                current = current.AddDays(1);
            }
            return dates;
        }

        private string GetWeekDetails(Presence presence, DateTime date, SanctionDto sanction,
                                     CongeDto conge, bool isFerier, bool isRepos)
        {
            // Build detailed string showing all info for the day
            var details = new List<string>();

            if (presence != null)
                details.Add($"Présent: {presence.Tothre}");
            else
                details.Add("Absent");

            if (sanction != null)
                details.Add($"Sanction: {sanction.Abslib}");

            if (conge != null)
                details.Add($"Congé: {conge.Concod}");

            if (isFerier)
                details.Add("Férié");

            if (isRepos)
                details.Add("Repos");

            return string.Join(" | ", details);
        }
    }
}