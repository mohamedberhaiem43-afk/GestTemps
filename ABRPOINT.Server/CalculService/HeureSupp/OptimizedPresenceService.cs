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
        public async Task<PresenceSemaineData> GetPresenceSemaineDataOptimized(string soccod, string empcod, string mois, string annee, string semaine)
        {
            try
            {
                // Validate inputs
                if (string.IsNullOrEmpty(soccod) || string.IsNullOrEmpty(empcod) ||
                    string.IsNullOrEmpty(mois) || string.IsNullOrEmpty(annee))
                    return null;

                var parametreMoisPointage = await _parametreRepository.GetParametreMoisPointageAsync(soccod);
                if (parametreMoisPointage == null) return null;

                if (!int.TryParse(mois, out int month) || !int.TryParse(annee, out int year))
                    return null;

                // 🆕 Fetch employee's embauche and sortie dates + default Poscod (fallback)
                var employe = await _dbContext.Employes
                    .Where(e => e.Soccod == soccod && e.Empcod == empcod)
                    .Select(e => new { e.Empemb, e.Empsort, e.Empferepos, e.Poscod })
                    .FirstOrDefaultAsync();

                DateTime? empemb = employe?.Empemb;
                DateTime? empsort = employe?.Empsort;
                string? empferepos = employe?.Empferepos ?? "0";
                string? defaultPoscod = employe?.Poscod;

                // 🆕 NOUVEAU : Charger les paramètres de BASE de l'employé
                var empparamBase = await _employeRepository.GetEmpparam(
                    soccod,
                    empcod,
                    DateTime.Now,
                    null
                );

                DateTime debutReelDate = CalculateDebutReelDate(parametreMoisPointage, month, year);
                var parametreNuit = await _parametreRepository.GetParametresNuitAsync(soccod);

                // Calculate date range
                var (startDate, endDate) = CalculateDateRange(parametreMoisPointage, month, year, semaine);
                var allDates = GenerateDateList(startDate, endDate);

                // LOAD ALL DATA UPFRONT (batch queries)
                var dataCache = await LoadAllDataAsync(soccod, empcod, startDate, endDate, allDates, empemb, empsort, defaultPoscod);

                // Initialize result accumulators
                var result = new PresenceSemaineData
                {
                    WeekDetails = new Dictionary<string, string>(),
                    // Surface missing-poste dates to the response so the UI can warn the user
                    MissingPosteDates = dataCache.MissingPosteDates
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
                        empparamBase,
                        accumulators,
                        countedSanctions,
                        countedConges,
                        result.WeekDetails,
                        soccod,
                        empcod,
                        debutReelDate,
                        empemb,
                        empsort,
                        empferepos
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
        private DateTime CalculateDebutReelDate(ParametreMoisPointageDto param, int month, int year)
        {
            DateTime debutReelDate;

            if (param.Moisdeb == "P") // Mois précédent
            {
                int previousMonth = month == 1 ? 12 : month - 1;
                int previousYear = month == 1 ? year - 1 : year;
                debutReelDate = MakeDate(previousYear, previousMonth, param.DebutReel);
            }
            else // Mois courant
            {
                debutReelDate = MakeDate(year, month, param.DebutReel);
            }

            return debutReelDate;
        }
        private async Task<DataCache> LoadAllDataAsync(string soccod, string empcod, DateTime startDate, DateTime endDate, List<DateTime> allDates,
            DateTime? empemb, DateTime? empsort, string? defaultPoscod)
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
            List<SanctionDto> sanctions = await _sanctionRepository.GetSanctionsByPeriodAsync(soccod, empcod, startDate, endDate);
            cache.SanctionsByDate = sanctions.ToDictionary(s => (DateTime)s.Condat);

            // Load all conges for the period
            List<CongeDto> conges = await _congeRepository.GetCongesByPeriodAsync(soccod, empcod, startDate, endDate);
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

            // Fallback resolution mirrors PostesController.GetEmployePoste: when Lcategories doesn't
            // resolve a poste for a date, use the Presence's own Codposte, then employee's default Poscod.
            // Dates still unresolved (within employment period) are reported via MissingPosteDates so the UI
            // can warn the user instead of crashing IsReposAsync with a null codposte.
            var missingPosteDates = new List<DateTime>();
            foreach (var d in allDates)
            {
                var dateKey = d.Date;
                if (postes.TryGetValue(dateKey, out var existing) && !string.IsNullOrEmpty(existing))
                    continue;
                if (empemb.HasValue && dateKey < empemb.Value.Date) continue;
                if (empsort.HasValue && dateKey >= empsort.Value.Date) continue;

                if (cache.PresencesByDate.TryGetValue(dateKey, out var pres) && !string.IsNullOrEmpty(pres.Codposte))
                    postes[dateKey] = pres.Codposte;
                else if (!string.IsNullOrEmpty(defaultPoscod))
                    postes[dateKey] = defaultPoscod;
                else
                    missingPosteDates.Add(dateKey);
            }

            cache.PostesByDate = postes;
            cache.MissingPosteDates = missingPosteDates;
            var postesCodes = postes.Values.Distinct().Where(p => !string.IsNullOrEmpty(p)).ToList();
            if (postesCodes.Any())
            {
                cache.PostesObjects = await _dbContext.Postes
                    .Where(p => p.Soccod == soccod && postesCodes.Contains(p.Codposte))
                    .ToDictionaryAsync(p => p.Codposte);
            }
            else
            {
                cache.PostesObjects = new Dictionary<string, Poste>();
            }
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
            Dictionary<DateTime, float> allaitements = await _allaitementRepository.GetAllaitementsByPeriodAsync(soccod, empcod, startDate, endDate);
            cache.AllaitementByDate = allaitements;

            // Load repos days
            Dictionary<DateTime, bool> reposDays = await _parametreRepository.GetReposDaysByPeriodAsync(soccod, empcod, allDates);
            cache.ReposByDate = reposDays;

            // Load poste hours for ferier days
            Dictionary<DateTime, float> ferierHours = await _posteRepository.GetJourHeuresByPeriod(soccod, cache.FerierDates.ToList(), cache.PostesByDate);
            cache.FerierHoursByDate = ferierHours;

            return cache;
        }
        private EmpparamPointageMois EnrichEmpparamWithPoste(EmpparamPointageMois baseParam,DateTime date,string codPoste,Dictionary<string, Poste> postesCache)
        {
            // Cloner les paramètres de base
            var enriched = new EmpparamPointageMois
            {
                Emppanier = baseParam.Emppanier,
                Empmaxhre = baseParam.Empmaxhre,
                Empmaxjour = baseParam.Empmaxjour,
                Empminhjour = baseParam.Empminhjour
            };

            // Enrichir avec les paramètres du poste si disponible
            if (!string.IsNullOrEmpty(codPoste) &&
                postesCache.TryGetValue(codPoste, out var poste))
            {
                var dayOfWeek = date.DayOfWeek;

                switch (dayOfWeek)
                {
                    case DayOfWeek.Monday:
                        enriched.PosteMaxhre = poste.Maxhrelun;
                        enriched.PosteMinhJour = poste.Minhjourlun;
                        enriched.PosteMinhDemiJour = poste.Minhdemijourlun;
                        break;
                    case DayOfWeek.Tuesday:
                        enriched.PosteMaxhre = poste.Maxhremar;
                        enriched.PosteMinhJour = poste.Minhjourmar;
                        enriched.PosteMinhDemiJour = poste.Minhdemijourmar;
                        break;
                    case DayOfWeek.Wednesday:
                        enriched.PosteMaxhre = poste.Maxhremer;
                        enriched.PosteMinhJour = poste.Minhjourmer;
                        enriched.PosteMinhDemiJour = poste.Minhdemijourmer;
                        break;
                    case DayOfWeek.Thursday:
                        enriched.PosteMaxhre = poste.Maxhrejeu;
                        enriched.PosteMinhJour = poste.Minhjourjeu;
                        enriched.PosteMinhDemiJour = poste.Minhdemijourjeu;
                        break;
                    case DayOfWeek.Friday:
                        enriched.PosteMaxhre = poste.Maxhreven;
                        enriched.PosteMinhJour = poste.Minhjourven;
                        enriched.PosteMinhDemiJour = poste.Minhdemijourven;
                        break;
                    case DayOfWeek.Saturday:
                        enriched.PosteMaxhre = poste.Maxhresam;
                        enriched.PosteMinhJour = poste.Minhjoursam;
                        enriched.PosteMinhDemiJour = poste.Minhdemijoursam;
                        break;
                    case DayOfWeek.Sunday:
                        enriched.PosteMaxhre = poste.Maxhredim;
                        enriched.PosteMinhJour = poste.Minhjourdim;
                        enriched.PosteMinhDemiJour = poste.Minhdemijourdim;
                        break;
                }
            }

            return enriched;
        }
        private async Task ApplyCongeImpact(DateTime date,CongeDto conge,string poste,Accumulators acc,HashSet<string> countedConges,string soccod,string empcod,bool isAfterDebutReel,EmpparamPointageMois empparam)
        {
            var nombreConge = await _congeCalculationService
                .CalculerNbJourAndHreCongePaye(soccod, empcod, date, poste);

            if (nombreConge.Concod == null ||
                countedConges.Contains(nombreConge.Concod) ||
                nombreConge.nbJourConge == 0)
                return;
            var nbhConge = await _parametreRepository.GetNbhCongeAsync(soccod);
            float congeHours = conge.Connbjour == 0.5 ? nbhConge.Value / 2 : nbhConge.Value;
            acc.NbHeuresDebutCalcul += congeHours;
            // 🔹 Compteurs généraux
            acc.NbJourCngPaye += nombreConge.nbJourConge;
            acc.NbHeureConge += congeHours;

            // 🔹 MODIFIER : Incrémenter NbJours seulement si >= DebutReel
            if (isAfterDebutReel)
            {
                acc.NbJourPointer += (float)GenericMethodes.journeeTime((float)conge.Connbjour, empparam);
                if(conge.Connbjour == 0.5)
                    acc.NbJours += conge.Connbjour;
            }

            countedConges.Add(nombreConge.Concod);

            // Typage du congé (reste inchangé)
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
        private async Task ProcessDay(DateTime date,DataCache cache,ParametreMoisPointageDto paramMois,ParametreNuitDto paramNuit,EmpparamPointageMois empparamBase,
    Accumulators acc,HashSet<string> countedSanctions,HashSet<string> countedConges,IDictionary<string, string> weekDetails,string soccod,string empcod,
    DateTime debutReelDate,DateTime? empemb, DateTime? empsort, string? empferepos = "0")
        {
            // 🆕 Skip future dates entirely — un jour qui n'est pas encore arrivé ne peut
            // pas compter comme une absence (ni dans nbJours, ni dans totalAbsence,
            // ni dans absnj/absnp). On n'ajoute même pas l'entrée weekDetails pour que
            // l'UI n'affiche pas la journée future comme « Absent ».
            if (date.Date > DateTime.Today)
                return;

            // 🆕 Helper function to check if date is within employment period
            bool IsWithinEmploymentPeriod(DateTime checkDate)
            {
                if (empemb.HasValue && checkDate < empemb.Value) return false;
                if (empsort.HasValue && checkDate >= empsort.Value) return false;
                return true;
            }

            // 🆕 Skip days outside employment period — un employé non encore embauché
            // ou déjà sorti ne peut pas être compté comme absent. Cela évite que les
            // mois antérieurs à la date d'embauche / postérieurs à la date de sortie
            // génèrent des absences fictives en base et dans l'UI.
            if (!IsWithinEmploymentPeriod(date))
                return;

            cache.PresencesByDate.TryGetValue(date.Date, out var presence);

            // 🆕 Apply employment period filter to absences
            SanctionDto? sanction = null;
            if (IsWithinEmploymentPeriod(date) && cache.SanctionsByDate.TryGetValue(date.Date, out var sanctionValue))
                sanction = sanctionValue;

            CongeDto? conge = null;
            if (IsWithinEmploymentPeriod(date) && cache.CongesByDate.TryGetValue(date.Date, out var congeValue))
                conge = congeValue;

            AutDto? autorisation = null;
            if (IsWithinEmploymentPeriod(date) && cache.AutorisationsByDate.TryGetValue(date.Date, out var autorisationValue))
                autorisation = autorisationValue;

            bool isFerier = cache.FerierDates.Contains(date.Date);
            bool isRepos = cache.ReposByDate.TryGetValue(date.Date, out var r) && r;
            string? poste = cache.PostesByDate.TryGetValue(date.Date, out var p) ? p : null;
            bool isAfterDebutReel = date.Date >= debutReelDate.Date;
            // Skip IsReposAsync when poste couldn't be resolved (employee outside employment period
            // or missing Lcategories/Poscod). Calling it with a null codposte throws ArgumentException.
            bool repos = !string.IsNullOrEmpty(poste)
                ? await _parametreRepository.IsReposAsync(soccod, date, poste)
                : false;

            // 🆕 ENRICHIR empparamBase avec les paramètres du poste de ce jour
            var empparam = EnrichEmpparamWithPoste(empparamBase, date, poste, cache.PostesObjects);

            weekDetails.Add(
                date.ToString("yyyy-MM-dd"),
                GetWeekDetails(presence, date, sanction, conge, isFerier, isRepos)
            );

            // 1️⃣ SANCTION (indépendant)
            if (sanction != null)
            {
                await ProcessSanction(sanction, countedSanctions, acc, paramMois, isAfterDebutReel);
            }

            // 2️⃣ CONGÉ (prioritaire)
            if (conge != null)
            {
                await ApplyCongeImpact(
                    date, conge, poste, acc,
                    countedConges, soccod, empcod, isAfterDebutReel, empparam
                );
                return;
            }

            // 3️⃣ FÉRIÉ
            if (isFerier)
            {
                await ProcessFerierDay(date, presence, cache, acc, soccod, empcod, isAfterDebutReel, empparam);
                return;
            }

            // 4️⃣ ABSENCE (jour ouvrable sans présence)
            if ((presence == null || GenericMethodes.NotPresent(presence)) && !isRepos)
            {
                float? hreAbs = await _heureabsenceService
                    .CalculateHeureAbsences(presence, soccod, poste, date, autorisation,
                        GenericMethodes.ConvertHHmmToDouble(presence?.Tothre));

                if (presence != null)
                {
                    if (presence.Totcmp == null) presence.Totcmp = 0;
                    acc.NbHeuresDebutCalcul += GenericMethodes.ConvertHHmmToDouble(presence.Tothre) + presence.Totcmp;
                }

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
                if (presence.Totcmp == null) presence.Totcmp = 0;

                float heuresLimitees = (float)GenericMethodes.CalculateHoursWithLimits(presence, empparam);
                acc.NbHeuresDebutCalcul += heuresLimitees + presence.Totcmp.Value;

                await ProcessPresenceDetails(
                    presence, date, isFerier, null, isRepos, repos,
                    poste, empparam,
                    paramMois, paramNuit,
                    cache, acc, countedConges, autorisation, // ✅ Pass filtered autorisation
                    soccod, empcod, true, isAfterDebutReel, empferepos
                );
            }
        }
        private async Task ProcessFerierDay(DateTime date,Presence presence,DataCache cache,Accumulators acc,string soccod,string empcod,bool isAfterDebutReel,EmpparamPointageMois empparam)
        {
            if (cache.FerierHoursByDate.TryGetValue(date, out var ferierHours))
            {
                if (isAfterDebutReel)
                    acc.NbJourPointer += (float)GenericMethodes.journeeTime(ferierHours, empparam);
                acc.NbHeuresDebutCalcul += ferierHours;
                acc.NbhFerier += ferierHours;
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
        private async Task ProcessPresenceDetails(Presence presence,DateTime date,bool isFerier,CongeDto conge,bool isRepos,bool repos,string poste,EmpparamPointageMois empparam,
    ParametreMoisPointageDto paramMois,ParametreNuitDto paramNuit,DataCache cache,Accumulators acc,HashSet<string> countedConges,AutDto autorisation,string soccod,string empcod,
    bool isWorkingDay,bool isAfterDebutReel,string? empferepos = "0")
        {
            // Only calculate panier for non-conge, non-ferier days with presence
            if (!isFerier && conge == null)
            {
                CalculatePanier(presence, date, empparam.Emppanier, paramMois, acc);
            }
            float dayworkhours = 0;
            if(!string.IsNullOrEmpty(presence.Tothre))
                dayworkhours = (float)GenericMethodes.ConvertTimeToDecimal(presence.Tothre);

            // Check if worked on Saturday
            if (presence.Predat.Value.DayOfWeek == DayOfWeek.Saturday &&
                GenericMethodes.ConvertHHmmToDouble(presence.Tothre) > 0)
            {
                acc.JourSamediTrv += (float)GenericMethodes.journeeTime(dayworkhours, empparam);

               float heuresSamedi = (float)GenericMethodes.CalculateHoursWithLimits(presence, empparam);

                acc.ResHreSamediTrv += heuresSamedi;
                if (isRepos)
                    acc.HreSamediTrv += heuresSamedi;
            }

            // Check if worked on Sunday
            if (presence.Predat.Value.DayOfWeek == DayOfWeek.Sunday && GenericMethodes.ConvertHHmmToDouble(presence.Tothre) > 0)
            {
                // Appliquer la limite empmaxhre aux heures dimanche
                float heuresDimanche = (float) GenericMethodes.CalculateHoursWithLimits(presence, empparam);
                acc.HreDimTrv += heuresDimanche;
            }

            // Calculate night hours
            CalculateNightHours(presence, date, paramNuit, acc);
            if (string.IsNullOrEmpty(presence.Codposte))
                presence.Codposte = await _posteRepository.GetEmpPoste(soccod, empcod, date,presence.Catcod);
            // Calculate delays
            if (isWorkingDay && isAfterDebutReel && !string.IsNullOrWhiteSpace(presence.Codposte))
            {
                var posteObj = await _posteRepository.GetPoste(soccod, presence.Codposte);
                var presenceDto = _mapper.Map<Presence, PresenceDto>(presence);
                var retard = await _retardService.CalculateHeureRetard(presenceDto, posteObj, autorisation);
                acc.Retards += retard.Item1;
            }
            //_dbContext.Employes.ge
            // 🔹 MODIFIER : Compter les jours seulement si >= DebutReel
            if (isAfterDebutReel)
            {
                acc.NbJourPointer += (float)GenericMethodes.journeeTime(dayworkhours,empparam);

                // Count regular working days (not repos, not ferier)
                if (!repos && !isRepos && conge == null && !isFerier && isWorkingDay)
                {
                    acc.NbJours++;
                }
                // ✅ Count rest days worked based on empferepos setting
                else if ((repos || isRepos) && conge == null && !isFerier && isWorkingDay)
                {
                    var dayOfWeek = date.DayOfWeek;
                    bool shouldCountRepos = false;

                    // empferepos: "1"=All repos, "2"=Saturday only, "3"=Sunday only, "0"=None
                    switch (empferepos)
                    {
                        case "1": // Count all repos worked
                            shouldCountRepos = true;
                            break;
                        case "2": // Count only Saturday repos worked
                            shouldCountRepos = dayOfWeek == DayOfWeek.Saturday;
                            break;
                        case "3": // Count only Sunday repos worked
                            shouldCountRepos = dayOfWeek == DayOfWeek.Sunday;
                            break;
                        default: // "0" or null = don't count repos worked
                            shouldCountRepos = false;
                            break;
                    }

                    if (shouldCountRepos)
                        acc.NbJours++;
                }
            }

            // Add allaitement hours
            if (cache.AllaitementByDate.TryGetValue(date, out var allaitementHours))
            {
                acc.NbhAllaitement += allaitementHours;
            }

            // Process total hours and repos
            if (!string.IsNullOrEmpty(presence.Tothre) &&
                TimeSpan.TryParseExact(presence.Tothre, "hh\\:mm", null, out TimeSpan hours) && isAfterDebutReel)
            {
                float heuresLimitees = (float)GenericMethodes.CalculateHoursWithLimits(presence, empparam);
                acc.TotalHours += heuresLimitees;
                if (presence.Totcmp != null)
                   acc.TotalHours += presence.Totcmp.Value;

                if (presence.Prerepos == "1" && isRepos)
                {
                    acc.HeureRepos += heuresLimitees;
                    acc.JourRepos++;
                }
            }
        }

        private async Task ProcessSanction(SanctionDto sanction,HashSet<string> countedSanctions,Accumulators acc,ParametreMoisPointageDto paramMois,bool isAfterDebutReel)
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
                        float? nbhConge = await _parametreRepository.GetNbhCongeAsync(sanction.Soccod);
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
            if (!string.IsNullOrEmpty(sanction?.Concod) && !countedSanctions.Contains(sanction.Concod))
            {
                if (sanction.Abspaye == "N" && isAfterDebutReel)
                {
                    acc.NbJours -= sanction.Connbjour;
                }
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
                var paramMois = await _parametreRepository.GetParametreMoisPointageAsync(soccod);
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
                // ⚠ MakeDate clamp le jour ([1, DaysInMonth]) pour éviter
                // ArgumentOutOfRangeException quand DebutReel/DebutCalc/Joufin > nb de jours
                // du mois (typiquement 31 sur février → throw avant AdjustDayToMonth).
                if (paramMois.Moisdeb == "P")
                {
                    int pm = month == 1 ? 12 : month - 1;
                    int py = month == 1 ? year - 1 : year;
                    startMonthReal = MakeDate(py, pm, paramMois.DebutReel);
                }
                else
                {
                    startMonthReal = MakeDate(year, month, paramMois.DebutCalc);
                }

                // ---- Jour calcul (peut être déplacé au lundi)
                startMonthCalc = startMonthReal;

                if (paramMois.Sochsup == "L")
                {
                    int delta = ((int)startMonthCalc.DayOfWeek + 6) % 7;
                    startMonthCalc = startMonthCalc.AddDays(-delta);
                }

                // ---- Fin mois
                int joufin = int.TryParse(paramMois.Joufin, out var jf) ? jf : 31;
                if (paramMois.Moisfin == "P")
                {
                    int pm = month == 1 ? 12 : month - 1;
                    int py = month == 1 ? year - 1 : year;
                    endMonth = MakeDate(py, pm, joufin);
                }
                else
                {
                    endMonth = MakeDate(year, month, joufin);
                }
                // AdjustDayToMonth devient redondant (MakeDate clamp déjà), conservé pour
                // les cas où startMonthCalc a été décalé négativement (théoriquement non,
                // car AddDays(-delta) reste dans le mois courant ou recule au mois précédent
                // qui a son propre nombre de jours valide).
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
                var conges = await _congeRepository.GetCongesByPeriodAsync(
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
                var nbhFerier = await _parametreRepository.GetNbhFerierAsync(soccod);
                var nbhConge = await _parametreRepository.GetNbhCongeAsync(soccod);

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

                // [HS DIAG INNER] Dump per-day breakdown post-mutation (à retirer une fois validé).
                Console.WriteLine($"[HS DIAG INNER] semaine={weekNumber} caltype={type} nbhFerier={nbhFerier} nbhConge={nbhConge}");
                foreach (var d in selectedWeek)
                {
                    var dt = d.CalDate?.Date;
                    bool isF = dt.HasValue && ferierSet.Contains(dt.Value);
                    bool isC = dt.HasValue && congesByDate.ContainsKey(dt.Value);
                    Console.WriteLine($"[HS DIAG INNER]   {dt:MM-dd}({dt?.DayOfWeek.ToString().Substring(0,3)}) CalNbh={d.CalNbh} ferier={isF} conge={isC}");
                }
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
        private void CalculatePanier(Presence presence,DateTime date,string emppanier,ParametreMoisPointageDto paramMois,Accumulators acc)
        {
            if (!string.IsNullOrEmpty(presence.Tothre) &&
                TimeSpan.TryParseExact(presence.Tothre, "hh\\:mm", null, out TimeSpan h))
            {
                float nbHeuresJour = (float)h.TotalHours;

                DateTime startMonthReal = date.Month == 1
                    ? MakeDate(date.Year - 1, 12, paramMois.DebutReel)
                    : MakeDate(date.Year, date.Month - 1, paramMois.DebutReel);
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
            public Dictionary<string, Poste> PostesObjects { get; set; }
            public Dictionary<DateTime, Presence> PresencesByDate { get; set; }
            public Dictionary<DateTime, SanctionDto> SanctionsByDate { get; set; }
            public Dictionary<DateTime, CongeDto> CongesByDate { get; set; }
            public HashSet<DateTime> FerierDates { get; set; }
            public Dictionary<DateTime, string> PostesByDate { get; set; }
            public Dictionary<DateTime, AutDto> AutorisationsByDate { get; set; }
            public Dictionary<DateTime, float> AllaitementByDate { get; set; }
            public Dictionary<DateTime, bool> ReposByDate { get; set; }
            public Dictionary<DateTime, float> FerierHoursByDate { get; set; }
            public List<DateTime> MissingPosteDates { get; set; } = new();
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
            public float? NbJourPointer { get; set; } = 0;
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
            public float? ResHreSamediTrv { get; set; } = 0;
            public float? HreDimTrv { get; set; } = 0;
            public float? NbHeuresDebutCalcul { get; set; } = 0;
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
            result.ResHreSamediTrv = acc.ResHreSamediTrv;
            result.HreDimTrv = acc.HreDimTrv;
            result.NbHeuresDebutCalcul = acc.NbHeuresDebutCalcul;
        }

        private (DateTime startDate, DateTime endDate) CalculateDateRange(
           ParametreMoisPointageDto param, int month, int year, string semaine)
        {
            DateTime startDate, endDate;

            // For the start date — MakeDate clamp à DaysInMonth, idem ci-dessus.
            if (param.Moisdeb == "P") // Previous month
            {
                var previousMonth = month == 1 ? 12 : month - 1;
                var previousYear = month == 1 ? year - 1 : year;
                startDate = MakeDate(previousYear, previousMonth, param.DebutCalc);
            }
            else // Current month
            {
                startDate = MakeDate(year, month, param.DebutCalc);
            }

            // For the end date
            int joufin = int.TryParse(param.Joufin, out var jf) ? jf : 31;
            if (param.Moisfin == "P") // Previous month
            {
                var previousMonth = month == 1 ? 12 : month - 1;
                var previousYear = month == 1 ? year - 1 : year;
                endDate = MakeDate(previousYear, previousMonth, joufin);
            }
            else // Current month
            {
                endDate = MakeDate(year, month, joufin);
            }

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

        /// <summary>
        /// Construit un DateTime en clampant le jour à [1, DaysInMonth(y, m)].
        /// Sans ce wrapper, `new DateTime(2026, 2, 31)` (DebutCalc=31 sur février) lève
        /// ArgumentOutOfRangeException avant qu'AdjustDayToMonth n'ait pu corriger.
        /// </summary>
        private static DateTime MakeDate(int year, int month, int day)
        {
            int dim = DateTime.DaysInMonth(year, month);
            int safeDay = day < 1 ? 1 : (day > dim ? dim : day);
            return new DateTime(year, month, safeDay);
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
                details.Add($"Sanction[{sanction.Abscod}]: {sanction.Abslib}");

            if (conge != null)
                details.Add($"Congé[{conge.Abscod}]: {conge.Concod}");

            if (isFerier)
                details.Add("Férié");

            if (isRepos)
                details.Add("Repos");

            return string.Join(" | ", details);
        }
    }
}