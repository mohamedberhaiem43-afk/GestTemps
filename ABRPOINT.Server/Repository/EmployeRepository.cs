using ABRPOINT.Helper;
using ABRPOINT.Server.CalculService.HeureRetard;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using AutoMapper;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;

namespace ABRPOINT.Server.Repository
{
    public class EmployeRepository : IEmployeRepository
    {
        private readonly ApplicationDbContext _dbContext;
        private readonly ISiteRepository _siteRepository;
        private readonly ICalendrierRepository _calendrierRepository;
        private readonly IParametreRepository _parametreRepository;
        private readonly ICongeRepository _congeRepository;
        private readonly IJourFerieRepository _ferierRepository;
        private readonly IHeureRetardService _retardService;
        private readonly IUtilisateurRepository _utilisateurRepository;
        private readonly IPosteRepository _posteRepository;
        private readonly IautoriserRepository _autorisationRepository;
        private readonly IMapper _mapper;
        private readonly ILogger _logger;   
        public EmployeRepository(ApplicationDbContext dbContext, ISiteRepository siteRepository, ICalendrierRepository icalendrierRepository,
            IParametreRepository parametreRepository, ICongeRepository congeRepository, IMapper mapper, ILogger<EmployeRepository> logger,
            IHeureRetardService retardService,IPosteRepository posteRepository,IJourFerieRepository ferierRepository,
            IUtilisateurRepository utilisateurRepository,IautoriserRepository autorisationRepository)
        {
            _dbContext = dbContext;
            _siteRepository = siteRepository;
            _calendrierRepository = icalendrierRepository;
            _parametreRepository = parametreRepository;
            _congeRepository = congeRepository;
            _posteRepository = posteRepository;
            _retardService = retardService;
            _utilisateurRepository = utilisateurRepository;
            _ferierRepository = ferierRepository;
            _autorisationRepository = autorisationRepository;
            _mapper = mapper;
            _logger = logger;

        }
        public void Add(Employe employe)
        {
            _dbContext.Employes.Add(employe);
            _dbContext.SaveChanges();
        }
        public async Task AddAsync(Employe employe)
        {
            try
            {
                if (!string.IsNullOrEmpty(employe.Soccod))
                {
                    short? longbdg = await _parametreRepository.GetLongbdg(employe.Soccod);

                    // Parse longbdg to get the required number of digits
                    if (longbdg > 0)
                    {
                        employe.Empmat = GenericMethodes.FormatEmpmat(employe.Empmat, longbdg);
                    }
                    await _dbContext.Employes.AddAsync(employe);
                    await _dbContext.SaveChangesAsync();
                }
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<Dictionary<string?, EmployeStat>> GetStatistics(string soccod)
        {
            try
            {
                var result = await _dbContext.Employes
                                .Where(e => e.Soccod == soccod)
                                .GroupBy(e => e.Empniv ?? "Inconnu")
                                .Select(g => new
                                {
                                    Empniv = g.Key,
                                    Stats = new EmployeStat
                                    {
                                        TotalCount = g.Count(),
                                        Horaire = g.Count(e => e.Empreg == "H"),
                                        Mensuelle = g.Count(e => e.Empreg == "M")
                                    }
                                })
                                .ToDictionaryAsync(x => x.Empniv, x => x.Stats);

                return result;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<Dictionary<string, int>> GetEmployeeCountBySexAsync(string soccod)
        {
            try
            {
                var result = await _dbContext.Employes
                    .Where(e => e.Soccod == soccod)
                    .GroupBy(e => e.Empsexe ?? "Unknown")
                    .Select(g => new
                    {
                        Gender = g.Key,
                        Count = g.Count()
                    })
                    .ToDictionaryAsync(g => g.Gender, g => g.Count);
                return result;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<IEnumerable<EmpHoraireDto>> GetEmployesHoraire(string soccod, string empcod)
        {
            try
            {
                var empHoraires = await _dbContext.Employes
                    .Where(emp => emp.Empcod == empcod)
                    .Join(_dbContext.Lcategories,
                        emp => emp.Catcod,
                        lcat => lcat.Catcod,
                        (emp, lcat) => new { emp, lcat })
                    .Join(_dbContext.Postes,
                        combined => combined.lcat.Codposte,
                        p => p.Codposte,
                        (combined, p) => p)
                .Distinct()
                .ToListAsync();


                return _mapper.Map<List<EmpHoraireDto>>(empHoraires);
            }
            catch (Exception e)
            {
                _logger.LogCritical("Problème de récupération des horaires d'employés: {Exception}", e);
                return Enumerable.Empty<EmpHoraireDto>();
            }
        }


        public void Delete(Employe employe)
        {
            if (employe != null)
            {
                _dbContext.Employes.Remove(employe);
                _dbContext.SaveChanges();
            }
        }

        public IEnumerable<Employe> GetAll()
        {
            return _dbContext.Employes.ToList();
        }
        public async Task<(TimeSpan? Debut, TimeSpan? Fin)> GetEmpNuitIntervalle(string soccod, string empcod)
        {
            try
            {
                string? empnuit = await _dbContext.Employes.Where(emp => emp.Soccod == soccod && emp.Empcod == empcod)
                    .Select(emp=> emp.Empnuit)
                    .SingleOrDefaultAsync();
                if(empnuit == null || empnuit == "9")
                    return (null,null);
                var result = await (from emp in _dbContext.Employes
                                    where emp.Empcod == empcod && emp.Soccod == soccod
                                    join param in _dbContext.Parametres
                                    on emp.Soccod equals param.Soccod
                                    select new
                                    {
                                        NuitDeb = emp.Empnuit == "0" ? param.Nuitdeb :
                                                  emp.Empnuit == "9" ? param.Nuitsdeb : null,
                                        NuitFin = emp.Empnuit == "0" ? param.Nuitfin :
                                                  emp.Empnuit == "9" ? param.Nuitsfin : null
                                    }).SingleOrDefaultAsync();

                if (result == null)
                    return (null, null);

                // Convertir string en TimeSpan?
                TimeSpan? debut = TimeSpan.TryParse(result.NuitDeb, out var d) ? d : (TimeSpan?)null;
                TimeSpan? fin = TimeSpan.TryParse(result.NuitFin, out var f) ? f : (TimeSpan?)null;

                return (debut, fin);
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<decimal> GetTotRetards(string empcod, DateTime dateDeb, DateTime dateFin,string soccod)
        {
            try
            {
                var presences = await _dbContext.Presences
                    .Where(p => p.Empcod == empcod && p.Dmdate >= dateDeb && p.Dmdate <= dateFin && p.Soccod == soccod)
                    .ToListAsync();


                decimal totalMinutes = 0;

                foreach (var p in presences)
                {
                    string codpost = await _posteRepository.GetEmpPoste(p.Soccod, p.Empcod, p.Predat);
                    var poste = await _posteRepository.GetPoste(p.Soccod, codpost);

                    PresenceDto presence = _mapper.Map<Presence, PresenceDto>(p);

                    if (presence.Dmdate == null)
                    {
                        _logger.LogWarning($"Dmdate est null pour la présence de l'employé {empcod}");
                        continue;
                    }

                    AutDto autorisation = await _autorisationRepository.GetAutLib(
                        presence.Soccod,
                        presence.Empcod,
                        presence.Dmdate.Value
                    );

                    var retard = await _retardService.CalculateHeureRetard(presence, poste, autorisation);
                    totalMinutes += retard;
                }
                return totalMinutes;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors du calcul des retards pour l'employé {empcod}");
                throw;
            }
        }


        public async Task<Dictionary<string, int>> GetTotRetardsBatch(List<string> empcods, DateTime? dateDeb, DateTime? dateFin, string soccod)
        {
            if (empcods == null || !empcods.Any())
                return new Dictionary<string, int>();

            if (!dateDeb.HasValue || !dateFin.HasValue)
                throw new ArgumentException("dateDeb et dateFin sont obligatoires");

            // =====================================
            // 1️⃣ Chargement des présences
            // =====================================
            var presences = await _dbContext.Presences
                .Where(p =>
                    empcods.Contains(p.Empcod) &&
                    p.Soccod == soccod &&
                    p.Dmdate.HasValue &&
                    p.Dmdate.Value >= dateDeb.Value &&
                    p.Dmdate.Value <= dateFin.Value)
                .ToListAsync();

            if (!presences.Any())
                return new Dictionary<string, int>();

            // =====================================
            // 2️⃣ Charger les congés (batch)
            // =====================================
            var demandesConge = presences
                .Select(p => (p.Soccod, p.Empcod, p.Dmdate!.Value.Date))
                .Distinct()
                .ToList();

            // ✅ Utiliser la nouvelle signature qui retourne (Abslib, Connbjour)
            Dictionary<(string Soccod, string Empcod, DateTime Date), (string? Abslib, float? Connbjour)> conges =
                await _congeRepository.GetCongeLibBatch(demandesConge);

            // =====================================
            // 3️⃣ Charger les postes (batch)
            // =====================================
            var empdates = presences
                .Select(p => (p.Empcod, p.Dmdate!.Value.Date))
                .Distinct()
                .ToList();

            // Charger tous les postes nécessaires en batch
            var postesEmp = new Dictionary<(string Empcod, DateTime Date), string?>();
            foreach (var (empcod, date) in empdates)
            {
                var posteEmp = await _posteRepository.GetEmpPoste(soccod, empcod, date);
                postesEmp[(empcod, date)] = posteEmp;
            }

            // Charger tous les détails des postes en batch
            var posteCodes = postesEmp.Values
                .Where(p => !string.IsNullOrEmpty(p))
                .Distinct()
                .ToList();

            var postes = new Dictionary<string, Poste>(); // Remplacer 'object' par le type réel de Poste
            foreach (var posteCod in posteCodes)
            {
                var poste = await _posteRepository.GetPoste(soccod, posteCod);
                if (poste != null)
                    postes[posteCod!] = poste;
            }

            // =====================================
            // 4️⃣ Autorisations (batch)
            // =====================================
            var demandesAut = presences
                .Select(p => (p.Empcod, p.Dmdate!.Value.Date))
                .Distinct()
                .ToList();

            Dictionary<(string Empcod, DateTime Date), AutDto> autorisations =
                await _autorisationRepository.GetAutLibBatch(soccod, demandesAut);

            // =====================================
            // 5️⃣ Calcul des retards
            // =====================================
            var result = new Dictionary<string, int>();

            foreach (var p in presences)
            {
                var date = p.Dmdate!.Value.Date;
                var congeKey = (p.Soccod, p.Empcod, date);

                // ❌ Skip if employee is on congé
                if (conges.TryGetValue(congeKey, out var congeData) &&
                    !string.IsNullOrEmpty(congeData.Abslib))
                    continue;

                // ✅ Récupérer le poste depuis le dictionnaire
                if (!postesEmp.TryGetValue((p.Empcod, date), out var postEmp))
                    continue;

                // ✅ Récupérer les détails du poste depuis le dictionnaire
                if (string.IsNullOrEmpty(postEmp) || !postes.TryGetValue(postEmp, out var poste))
                    continue;

                var presenceDto = _mapper.Map<PresenceDto>(p);

                autorisations.TryGetValue(
                    (p.Empcod, date),
                    out var autorisation);

                int retard = await _retardService
                    .CalculateHeureRetard(presenceDto, poste, autorisation);

                if (retard <= 0)
                    continue;

                if (!result.ContainsKey(p.Empcod))
                    result[p.Empcod] = 0;

                result[p.Empcod] += retard;
            }

            return result;
        }

        public async Task<IEnumerable<EmployeDto>> GetAllAsync(string soccod, string uticod)
        {
            try
            {
                var employes = await _dbContext.Employes
                    .Where(e => e.Soccod == soccod &&
                           _dbContext.Socusers.Any(s => s.Soccod == soccod &&
                                                        s.Uticod == uticod &&
                                                        s.Sitcod == e.Sitcod))
                    .ToListAsync();

                return _mapper.Map<IEnumerable<EmployeDto>>(employes);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur lors de la récupération des employés");
                throw;
            }
        }
        public IEnumerable<Employe> GetAll(string soccod, string uticod)
        {
            // Check if soccod and uticod have values
            if (!string.IsNullOrEmpty(soccod) && !string.IsNullOrEmpty(uticod))
            {
                // Retrieve the list of sitcods associated with the provided soccod and uticod
                List<string> sitcods = _dbContext.Socusers
                   .Where(s => s.Soccod == soccod && s.Uticod == uticod)
                   .Select(s => s.Sitcod)
                   .ToList();

                // Filter Employes based on soccod and sitcods list
                return _dbContext.Employes
                    .Where(e => e.Soccod == soccod && sitcods.Contains(e.Sitcod))
                    .ToList();
            }

            // If soccod or uticod is null/empty, return all Employes
            return GetAll();
        }


        public async Task<Employe> GetByEmpcod(string soccod, string empcod)
        {
            try
            {
                var employe = await _dbContext.Employes.FirstOrDefaultAsync(s => s.Soccod == soccod && s.Empcod == empcod);
                return employe;
            }
            catch (Exception)
            {
                throw;
            }
        }


        public async Task<Dictionary<string, string>> GetEmpLibs(string soccod, string uticod)
        {
            try
            {
                var employes = await (from e in _dbContext.Employes
                                      join su in _dbContext.Socusers
                                          on new { e.Soccod, e.Sitcod } equals new { su.Soccod, su.Sitcod }
                                      where e.Soccod == soccod
                                            && e.Actif == "A"
                                            && su.Uticod == uticod
                                      select new { e.Empcod, e.Emplib })
                                     .Distinct()
                                     .ToListAsync();

                var res = employes.ToDictionary(e => e.Empcod, e => e.Emplib);

                return res;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur lors de la récupération des libellés employés");
                throw;
            }
        }

        public async Task<Dictionary<string, string>> GetFemmeLibs(string soccod, string uticod)
        {
            try
            {
                // Utiliser une jointure avec Socusers au lieu de Contains
                var employes = await (
                    from e in _dbContext.Employes
                    join su in _dbContext.Socusers
                        on new { e.Soccod, e.Sitcod } equals new { su.Soccod, su.Sitcod }
                    where e.Soccod == soccod
                        && e.Empsexe == "F"
                        && (e.Empsitfam == "M" || e.Empsitfam == "D")
                        && su.Uticod == uticod
                    select new { e.Empcod, e.Emplib }
                ).ToListAsync();

                // Conversion en dictionnaire en mémoire
                var result = employes.ToDictionary(e => e.Empcod, e => e.Emplib);

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur lors de la récupération des libellés des employées");
                throw;
            }
        }

        public void Update(Employe employe)
        {
            if (employe != null)
            {
                _dbContext.Employes.Update(employe);
                _dbContext.SaveChanges();
            }
        }
        private string SumTimeSpans(List<string> timeSpans)
        {
            var total = TimeSpan.Zero;
            foreach (var ts in timeSpans.Where(t => !string.IsNullOrEmpty(t)))
            {
                if (TimeSpan.TryParse(ts, out var parsed))
                    total += parsed;
            }
            return total.ToString(@"hh\:mm\:ss");
        }

        public async Task<IList<EmployeePresenceDto>> GetBySitcodAndDircod(string soccod, string uticod, string site, List<string>? empcods = null, string? empreg = null, string? service = null,
    DateTime? debut = null, DateTime? fin = null)
        {
            try
            {
                if (!debut.HasValue || !fin.HasValue)
                    throw new ArgumentException("debut et fin sont obligatoires");

                if (empcods != null && empcods.Count == 0)
                {
                    return new List<EmployeePresenceDto>();
                }

                // 🔹 Récupérer le paramètre d'arrondi
                var param = await _parametreRepository.GetEtatPeriodiqueParamAsync(soccod);
                float arrondi = param?.Arrondi ?? 0f;

                var empcodsList = empcods?.ToList();

                // ==========================
                // 1️⃣ Requête principale SQL
                // ==========================
                var baseQuery =
                    from e in _dbContext.Employes
                    join su in (
                        _dbContext.Socusers
                            .Where(s => s.Uticod == uticod && s.Soccod == soccod)
                            .Select(s => new { s.Soccod, s.Sitcod })
                            .Distinct()
                    ) on new { e.Soccod, e.Sitcod } equals new { su.Soccod, su.Sitcod }
                    join p in _dbContext.Presences
                        .Where(p => p.Predat >= debut.Value && p.Predat <= fin.Value && p.Soccod == soccod)
                        on e.Empcod equals p.Empcod
                    where e.Soccod == soccod
                          && e.Sitcod == site
                          && e.Actif == "A"
                          && (string.IsNullOrEmpty(empreg) || e.Empreg == empreg)
                          && (string.IsNullOrEmpty(service) || e.Sercod == service)
                    orderby e.Empcod, p.Predat, p.Tothre descending
                    select new
                    {
                        e.Empcod,
                        e.Emplib,
                        p.Predat,
                        p.Tothre,
                        p.Dmdate
                    };

                if (empcodsList != null && empcodsList.Any())
                {
                    baseQuery = baseQuery.Where(x => empcodsList.Contains(x.Empcod));
                }

                // ================================
                // 2️⃣ Matérialiser et dédupliquer
                // ================================
                var rawData = await baseQuery.ToListAsync();

                var presenceDataRaw = rawData
                    .GroupBy(x => new { x.Empcod, x.Predat })
                    .Select(g => new
                    {
                        g.Key.Empcod,
                        Emplib = g.First().Emplib,
                        g.Key.Predat,
                        Dmdate = g.First().Dmdate,
                        MinutesArrondies = g.Sum(x =>
                        {
                            if (TimeSpan.TryParse(x.Tothre ?? "", out var t))
                            {
                                int minutes = (int)t.TotalMinutes;
                                return minutes;
                            }
                            return 0;
                        })
                    })
                    .OrderBy(x => x.Empcod)
                    .ThenBy(x => x.Predat)
                    .ToList();

                if (!presenceDataRaw.Any())
                    return new List<EmployeePresenceDto>();

                var empList = presenceDataRaw.Select(x => x.Empcod).Distinct().ToList();

                // ================================
                // 3️⃣ Récupérer les jours fériés
                // ================================
                var feriers = await _ferierRepository.GetByFerdateBatch(soccod, debut.Value, fin.Value);
                var ferierDates = feriers.Keys.ToHashSet();

                // ================================
                // 4️⃣ Récupérer TOUS les congés pour la période
                // ================================
                // ✅ Créer une liste de TOUTES les dates de la période pour chaque employé
                var allDatesInPeriod = new List<(string Soccod, string Empcod, DateTime Date)>();

                foreach (var emp in empList)
                {
                    for (DateTime date = debut.Value.Date; date <= fin.Value.Date; date = date.AddDays(1))
                    {
                        allDatesInPeriod.Add((soccod, emp, date));
                    }
                }

                // ✅ Récupérer tous les congés pour toutes les dates
                var conges = await _congeRepository.GetCongeLibBatch(allDatesInPeriod);
                var nbhconge = await _parametreRepository.GetNbhConge(soccod) ?? 0;

                // ================================
                // 5️⃣ Calcul des heures de congés par employé
                // ================================
                // ✅ Calculer pour TOUTES les dates de congé, pas seulement celles dans presenceDataRaw
                var congeMinutesParEmp = allDatesInPeriod
                    .GroupBy(x => x.Empcod)
                    .ToDictionary(
                        g => g.Key,
                        g => g.Sum(x =>
                        {
                            var key = (x.Soccod, x.Empcod, x.Date);
                            if (conges.TryGetValue(key, out var congeData) &&
                                !string.IsNullOrEmpty(congeData.Abslib))
                            {
                                float heuresConge = (congeData.Connbjour.HasValue && congeData.Connbjour.Value == 0.5f)
                                    ? nbhconge * 0.5f
                                    : nbhconge;

                                return (int)TimeSpan.FromHours(heuresConge).TotalMinutes;
                            }
                            return 0;
                        })
                    );

                // ================================
                // 6️⃣ Calcul des heures fériées travaillées
                // ================================
                var ferierTravailleParEmp = presenceDataRaw
                    .Where(x => x.MinutesArrondies > 0 && ferierDates.Contains(x.Predat.Value.Date))
                    .GroupBy(x => x.Empcod)
                    .ToDictionary(
                        g => g.Key,
                        g => g.Sum(x => x.MinutesArrondies)
                    );

                // ================================
                // 7️⃣ Calcul des heures fériées non travaillées
                // ================================
                float ferierHeure = await _ferierRepository.GetTotheureFerierParPeriode(soccod, debut, fin) ?? 0;
                int ferierMinutesGlobal = (int)TimeSpan.FromHours(ferierHeure).TotalMinutes;

                // ================================
                // 8️⃣ Agrégation par employé (heures normales)
                // ================================
                var presenceData = presenceDataRaw
                    .GroupBy(x => new { x.Empcod, x.Emplib })
                    .Select(g => new
                    {
                        g.Key.Empcod,
                        g.Key.Emplib,
                        TotalMinutes = g.Sum(x => x.MinutesArrondies)
                    })
                    .OrderBy(x => x.Empcod)
                    .ToList();

                if (!presenceData.Any())
                    return new List<EmployeePresenceDto>();

                // ================================
                // 9️⃣ Données batch complémentaires
                // ================================
                var nbJours = await GetNbJoursBatch(empList, debut, fin, soccod);
                var retards = await GetTotRetardsBatch(empList, debut, fin, soccod);

                // ================================
                // 🔟 Assemblage final
                // ================================
                return presenceData.Select(x =>
                {
                    int ferierTravMinutes = ferierTravailleParEmp.GetValueOrDefault(x.Empcod);
                    int congeMinutes = congeMinutesParEmp.GetValueOrDefault(x.Empcod);

                    return new EmployeePresenceDto
                    {
                        Empcod = x.Empcod,
                        Emplib = x.Emplib,

                        // ✅ heures normales + heures fériées travaillées + heures fériées non travaillées + heures de congés
                        TotalMinutes = x.TotalMinutes + ferierTravMinutes + ferierMinutesGlobal + congeMinutes,

                        NbJours = nbJours.GetValueOrDefault(x.Empcod),
                        TotalRetards = retards.GetValueOrDefault(x.Empcod)
                    };
                }).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur GetBySitcodAndDircod");
                throw;
            }
        }

        public async Task<float?> GetNbJours(string empcod, DateTime? dateDeb, DateTime? dateFin)
        {
            try
            {
                float? nbJours = 0;
                var presences = await _dbContext.Presences
                    .Where(p => p.Empcod == empcod && p.Dmdate >= dateDeb && p.Dmdate <= dateFin)
                    .ToListAsync();

                foreach (var p in presences)
                {
                    var conge = await _congeRepository.GetCongeLib(p.Soccod, p.Empcod, (DateTime)p.Dmdate);
                    if (GenericMethodes.IsValid1(p) && string.IsNullOrEmpty(conge) && !GenericMethodes.NotPresent(p))
                        nbJours++;
                }

                return nbJours;
            }
            catch (Exception)
            {
                throw;
            }
        }


        public async Task<Dictionary<string, float>> GetNbJoursBatch(List<string> empcods, DateTime? dateDeb, DateTime? dateFin, string soccod)
        {
            if (empcods == null || !empcods.Any())
                return new Dictionary<string, float>();

            if (!dateDeb.HasValue || !dateFin.HasValue)
                throw new ArgumentException("dateDeb et dateFin sont obligatoires");

            // =====================================
            // 1️⃣ Charger les présences (1 requête)
            // =====================================
            var presences = await _dbContext.Presences
                .Where(p =>
                    empcods.Contains(p.Empcod) &&
                    p.Dmdate.HasValue &&
                    p.Dmdate.Value >= dateDeb.Value &&
                    p.Dmdate.Value <= dateFin.Value
                    && p.Soccod == soccod)
                .GroupBy(p => new
                {
                    p.Empcod,
                    Date = p.Dmdate!.Value.Date
                })
                .Select(g => new
                {
                    g.Key.Empcod,
                    g.Key.Date,
                    Presence = g.First()
                })
                .ToListAsync();

            if (!presences.Any())
                return new Dictionary<string, float>();

            // =====================================
            // 2️⃣ Charger les congés (batch)
            // =====================================
            var demandesConge = presences
                .Select(p => (p.Presence.Soccod, p.Empcod, p.Date))
                .Distinct()
                .ToList();

            var conges = await _congeRepository.GetCongeLibBatch(demandesConge);

            // =====================================
            // 3️⃣ Calcul NbJours
            // =====================================
            var result = new Dictionary<string, float>();

            foreach (var p in presences)
            {
                var key = (p.Presence.Soccod, p.Empcod, p.Date);
                var (abslib, connbjour) = conges.GetValueOrDefault(key);

                bool isValid =
                    GenericMethodes.IsPresent(p.Presence) &&
                    string.IsNullOrEmpty(abslib) &&
                    !GenericMethodes.NotPresent(p.Presence);

                if ((!isValid && connbjour == null) || connbjour == 1)
                    continue;

                if (!result.ContainsKey(p.Empcod))
                    result[p.Empcod] = 0;

                // ✅ Si Connbjour = 0.5, ajouter 0.5, sinon ajouter 1
                float journeeValue = (connbjour.HasValue && connbjour.Value == 0.5f) ? 0.5f : 1f;
                result[p.Empcod] += journeeValue;
            }

            return result;
        }

        double CustomRound(double value)
        {
            double fraction = value - Math.Floor(value);

            if (Math.Abs(fraction - 0.5) < 0.000001)
            {
                return Math.Round(value, 2); // conserve 13.5 → 13.5
            }
            else if (fraction < 0.5)
            {
                return Math.Round(Math.Floor(value), 2); // 13.2 → 13.00
            }
            else
            {
                return Math.Round(Math.Ceiling(value), 2); // 13.6 → 14.00
            }
        }

        public async Task<EmpEtatConge> GetEmpEtatConge(string soccod, string empcod, string moisdeb,string moisfin,string annee)
        {
            try
            {
                dynamic result = await Calc_solde_conge(soccod, empcod, moisdeb, moisfin, annee);

                EmpEtatConge empEtatConge = new EmpEtatConge(CustomRound((double)result.cm),(int)Math.Round((double)result.anciente),
                    CustomRound((double)result.droitConge),CustomRound((double)result.sa));

                return empEtatConge;
            }
            catch (Exception ex)
            {
                throw new Exception("Erreur innatendu: ", ex);
            }
        }

        private async Task<Object> Calc_solde_conge(string soccod, string empcod, string moisdeb,string moisfin,string annee)
        {
            double droitConge = 0;
            double nbheuret = 208;
            double nbjourt = 26;
            double nbheurejour = 8;
            double droitmensuelle = 0;
            double nbtravmois = 0;
            double sa = 0;
            int anciente = 0;
            float congeRecue = 0;
            int parecart = 5;
            Calendsoc calendsoc = null;
            Employe employe = await GetByEmpcod(soccod, empcod);
            if (employe == null || employe.Empemb == null)
                throw new ArgumentNullException("Employee data or hire date is null");
            string caltype = employe.Caltype;
            Site site = _siteRepository.GetBySitcod(soccod, employe.Sitcod);
            if (site == null)
                throw new ArgumentNullException("Site data is null");


            double cm = site.Sitconge.HasValue ? (double)site.Sitconge.Value / 12 : 0;

            //sans anciente si sitsancm=1
            if ((site.Sitsancm == "1" && employe.Empreg == "M") ||
                (site.Sitsanch == "1" && employe.Empreg == "H"))
                    anciente = 0;
            else
            {
                anciente = int.Parse(annee) - employe.Empemb.Value.Year;
                // Adjust if the current date is before the anniversary of the hire date
                if (employe.Empemb.HasValue && employe.Empemb.Value.AddYears(anciente) > new DateTime(int.Parse(annee), 1, 1))
                    anciente--;
            }
            if (anciente != 0)
                parecart = await _parametreRepository.GetParancemp(soccod);
                droitConge += Math.Floor((double)anciente / parecart);

            for (int i = 0; i < int.Parse(moisfin.TrimStart('0')); i++) // Remove leading zero from moisfin
            {
                string currentMonth = (i + 1).ToString("D2"); // Convert month to "01", "02", ..., "12" format
                calendsoc = await _calendrierRepository.GetCalendrier(soccod, annee, currentMonth, caltype);
                congeRecue += await _congeRepository.GetNbCongeRecue(soccod, empcod,annee,currentMonth);

                if (calendsoc != null)
                {
                    nbheuret = (double)calendsoc.CalNbh;
                    nbjourt = (double)calendsoc.CalTrav;
                    nbheurejour = (double)calendsoc.CalHjour;
                    // nbtravmois = nbjourt - (les absences != (abscng));
                    nbtravmois = nbjourt - calc_absences_par_mois(soccod, currentMonth, annee, empcod);
                    if(employe.Empreg == "M")
                        droitmensuelle += (nbtravmois * cm) / nbjourt;
                    else if(employe.Empreg == "H")
                        droitmensuelle += (nbtravmois * nbheurejour * cm) / nbheuret;

                }
            }
            if (anciente < parecart)
                anciente = 0;
            droitConge += droitmensuelle;
            sa = droitConge - congeRecue;
            return new { anciente, cm,droitConge,sa };
        }
        private double calc_absences_par_mois(string soccod, string mois, string annee, string empcod)
        {
            double nbjabsence = 0;
            int anneeInt = int.Parse(annee);
            int moisInt = int.Parse(mois);
            DateTime wcng_deb = new DateTime(anneeInt, moisInt, 1); // Début du mois
            DateTime wcng_fin = wcng_deb.AddMonths(1).AddDays(-1); // Fin du mois

            var result = _dbContext.Sanctions
                .Join(
                    _dbContext.Absences,
                    conge => new { conge.Soccod, conge.Abscod },
                    absence => new { absence.Soccod, absence.Abscod },
                    (conge, absence) => new { Conge = conge, Absence = absence }
                )
                .Where(joined =>
                    joined.Conge.Empcod == empcod &&
                    (
                        (joined.Conge.Condep.HasValue && joined.Conge.Condep.Value >= wcng_deb && joined.Conge.Condep.Value <= wcng_fin) ||
                        (joined.Conge.Conret.HasValue && joined.Conge.Conret.Value >= wcng_deb && joined.Conge.Conret.Value <= wcng_fin)
                    ) &&
                    joined.Absence.Soccod == soccod &&
                    (joined.Absence.Abscng == "8" || joined.Absence.Abscng == "9" || joined.Absence.Abscng == "A")
                    )
                .Select(joined => joined.Conge)
                .ToList();

            // Calculer le nombre de jours pour chaque absence
            foreach (var absence in result)
            {
                DateTime absdeb = absence.Condep.Value; // Date de début de l'absence
                DateTime absfin = absence.Conret.Value; // Date de fin de l'absence
                // Limiter les dates au mois en cours
                if (absdeb < wcng_deb)
                    absdeb = wcng_deb;
                if (absfin > wcng_fin)
                    absfin = wcng_fin;
                if ((absence.Conamdep == "1" && absence.Conamret == "1") || (absence.Conamdep == "0" && absence.Conamret == "0"))
                    nbjabsence += (absfin - absdeb).TotalDays + 1; // Ajouter les jours (inclure le jour de départ)

                else
                    nbjabsence += (absfin - absdeb).TotalDays + 0.5;
            }
            return nbjabsence;
        }
        private double calc_conge_par_mois(string soccod, string mois, string annee, string empcod)
        {
            double nbjconge = 0;
            int anneeInt = int.Parse(annee);
            int moisInt = int.Parse(mois);
            DateTime wcng_deb = new DateTime(anneeInt, moisInt, 1); // Début du mois
            DateTime wcng_fin = wcng_deb.AddMonths(1).AddDays(-1); // Fin du mois

            var result = _dbContext.Conges
                .Join(
                    _dbContext.Absences,
                    conge => new { conge.Soccod, conge.Abscod },
                    absence => new { absence.Soccod, absence.Abscod },
                    (conge, absence) => new { Conge = conge, Absence = absence }
                )
                .Where(joined =>
                    joined.Conge.Empcod == empcod &&
                    (
                        (joined.Conge.Condep.HasValue && joined.Conge.Condep.Value >= wcng_deb && joined.Conge.Condep.Value <= wcng_fin) ||
                        (joined.Conge.Conret.HasValue && joined.Conge.Conret.Value >= wcng_deb && joined.Conge.Conret.Value <= wcng_fin)
                    ) &&
                    joined.Absence.Soccod == soccod &&
                    joined.Absence.Abscng == "0" && // Condition: abscng = '0'
                    joined.Absence.Abspayer == "O" // Condition: abspayer = 'O'
                )
                .Select(joined => joined.Conge)
                .ToList();

            // Calculer le nombre de jours pour chaque congé
            foreach (var conge in result)
            {
                if (conge.Condep.HasValue && conge.Conret.HasValue)
                {
                    DateTime condep = conge.Condep.Value; // Date de début du congé
                    DateTime conret = conge.Conret.Value; // Date de retour du congé

                    // Limiter les dates au mois en cours
                    if (condep < wcng_deb)
                        condep = wcng_deb;
                    if (conret > wcng_fin)
                        conret = wcng_fin;
                    if ((conge.Conamdep == "1" && conge.Conamret == "1") || (conge.Conamdep == "0" && conge.Conamret == "0"))
                        nbjconge += (conret - condep).TotalDays + 1; // Ajouter les jours (inclure le jour de départ)
                    else
                        nbjconge += (conret - condep).TotalDays + 0.5;
                }
            }

            return nbjconge;
        }

        public async Task<string> GetEmpReg(string soccod, string empcod)
        {
            try
            {
                string? empreg = await _dbContext.Employes
                    .Where(e => e.Soccod == soccod && e.Empcod == empcod)
                    .Select(e => e.Empreg)
                    .SingleOrDefaultAsync();
                return empreg;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<EmpRegNiveau> GetEmpRegNiveau(string soccod, string empcod)
        {
            try
            {
                EmpRegNiveau? empRegNiveau = await _dbContext.Employes
                .Where(e => e.Soccod == soccod && e.Empcod == empcod)
                .Select(e => new EmpRegNiveau
                {
                    EmpReg = e.Empreg,
                    EmpNiveau = e.Empniv
                })
                .SingleOrDefaultAsync();

                    return empRegNiveau;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<string?> GetEmpPoste(string soccod, string empcod, DateTime? date)
        {
            try
            {
                if (date == null)
                    return null;

                // Step 1: Get employee's category
                string? catcod = await _dbContext.Employes
                    .Where(emp => emp.Soccod == soccod && emp.Empcod == empcod)
                    .Select(emp => emp.Catcod)
                    .FirstOrDefaultAsync();

                if (string.IsNullOrEmpty(catcod))
                    return null;

                // Step 2: Get all valid poste ranges for the exact date
                var dateMonth = date.Value.Month;
                var dateDay = date.Value.Day;
                var matchingPostes = await _dbContext.Lcategories
                    .Where(c => c.Soccod == soccod &&
                                c.Catcod == catcod &&
                                c.Catdu.Value.Month <= dateMonth &&
                                c.Catau.Value.Month >= dateMonth)
                    .ToListAsync();

                var dateYear = date.Value.Year;
                if(!matchingPostes.Any(mp => mp.Catdu.Value.Year == dateYear || mp.Catau.Value.Year == dateYear))
                {
                    matchingPostes = matchingPostes.Where(mp => mp.Catfixe == "1").ToList();
                }
                if (!matchingPostes.Any())
                    return null;

                int targetMonth = date.Value.Month;

                Lcategorie posteWithMonthMatch = matchingPostes[0];
                foreach (var lcat in matchingPostes)
                {
                    if (targetMonth >= lcat.Catdu.Value.Month && targetMonth <= lcat.Catau.Value.Month
                        && posteWithMonthMatch.Catdu <= date && posteWithMonthMatch.Catau >= date)
                        posteWithMonthMatch = lcat;
                }
                // If found, return it
                if (posteWithMonthMatch != null)
                    return posteWithMonthMatch.Codposte;

                // Else, fall back to the first valid match
                return matchingPostes.First().Codposte;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<bool> GetEmpRetard(string? soccod, string? empcod)
        {
            try
            {
                string? empretard = await _dbContext.Employes
                    .Where(emp => emp.Soccod == soccod && emp.Empcod == empcod)
                    .Select(emp => emp.Empretard)
                    .SingleOrDefaultAsync();
                if (string.IsNullOrEmpty(empretard) || empretard == "1")  
                    return false;
                return true;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task AddMultipleEmploye(List<Employe> employe)
        {
            try
            {
                if(employe.Count != 0)
                {
                    await _dbContext.AddRangeAsync(employe);
                    await _dbContext.SaveChangesAsync();
                }
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<List<EmpDepassMxHre>> GetEmployesDepassantMaxHeure(string soccod, string uticod)
        {
            try
            {
                var sitcods = await _utilisateurRepository.GetSitcodsAccess(soccod, uticod);
                DateTime yesterday = DateTime.Today.AddDays(-1);
                DateTime today = DateTime.Today;

                var result = (from p in _dbContext.Presences
                              join e in _dbContext.Employes
                                  on p.Empcod equals e.Empcod into empJoin
                              from e in empJoin.DefaultIfEmpty() // LEFT JOIN
                              where p.Soccod == soccod &&
                                    p.Predat >= yesterday &&
                                    p.Predat < today&&
                                    sitcods.Contains(e.Sitcod)
                              select new { Presence = p, Employe = e })
                             .AsEnumerable() // switch to client-side evaluation
                             .Where(x => GenericMethodes.IsValidHHmm(x.Presence.Tothre)) // optional
                             .Select(x => new EmpDepassMxHre
                             {
                                 Empcod = x.Presence.Empcod!,
                                 Soccod = x.Presence.Soccod!,
                                 Sitcod = x.Presence.Sitcod!,
                                 Empmat = x.Presence.Empmat,
                                 Emplib = x.Employe?.Emplib ?? "---", // handles null (LEFT JOIN)
                                 Date = x.Presence.Predat,
                                 Heure = (float?)GenericMethodes.ConvertHHmmToDouble(x.Presence.Tothre)
                             })
                             .Where(x => x.Heure >= 12)
                             .ToList();
                return result;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<Employe> UpdateAsync(Employe employe)
        {
            try
            {
                var existing = await _dbContext.Employes
                                .FirstOrDefaultAsync(e => e.Empcod == employe.Empcod
                           && e.Soccod == employe.Soccod
                           && e.Sitcod == employe.Sitcod);

                if (existing != null)
                {
                    _dbContext.Entry(existing).CurrentValues.SetValues(employe);
                    await _dbContext.SaveChangesAsync();
                    return existing;
                }
                return new Employe();
                ;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<string> GetByEmpMat(string user_id)
        {
            try
            {
                string? emplib = await _dbContext.Employes.Where(e => e.Empmat == user_id).Select(e=>e.Emplib).FirstOrDefaultAsync();
                return emplib;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<(bool Success, string Message)> DeleteAsync(Employe employe)
        {
            try
            {
                // Check if employee has presence records
                bool inPresence = await _dbContext.Presences
                    .AnyAsync(p => p.Empcod == employe.Empcod && p.Soccod == employe.Soccod);

                if (inPresence)
                {
                    return (false, "Impossible de supprimer l'employé : il existe des enregistrements de présence associés.");
                }

                // Check if employee has contracts
                bool hasContract = await _dbContext.Contrats
                    .AnyAsync(p => p.Empcod == employe.Empcod && p.Soccod == employe.Soccod);

                if (hasContract)
                {
                    return (false, "Impossible de supprimer l'employé : il existe des contrats associés.");
                }

                // Delete the employee
                _dbContext.Employes.Remove(employe);
                await _dbContext.SaveChangesAsync();

                return (true, "Employé supprimé avec succès.");
            }
            catch (Exception ex)
            {
                return (false, $"Erreur lors de la suppression : {ex.Message}");
            }
        }

        public async Task<string?> GetEmpPanier(string soccod,string empcod)
        {
            try
            {
                var emppanier = await _dbContext.Employes.Where(e => e.Soccod == soccod && e.Empcod == empcod)
                    .Select(e => e.Emppanier)
                    .FirstOrDefaultAsync();
                return emppanier;
            }
            catch (Exception)
            {
                throw;
            }
        }
        public async Task<Dictionary<DateTime, string>> GetEmpPostesByPeriod(string soccod, string empcod, DateTime startDate, DateTime endDate)
        {
            try
            {
                // Get employee's category
                string? catcod = await _dbContext.Employes
                    .Where(emp => emp.Soccod == soccod && emp.Empcod == empcod)
                    .Select(emp => emp.Catcod)
                    .FirstOrDefaultAsync();

                if (string.IsNullOrEmpty(catcod))
                    return new Dictionary<DateTime, string>();

                // Get all lcategories for this employee's category
                var lcategories = await _dbContext.Lcategories
                    .Where(l => l.Soccod == soccod && l.Catcod == catcod)
                    .ToListAsync();

                if (!lcategories.Any())
                    return new Dictionary<DateTime, string>();

                // Build dictionary for each date in range
                var result = new Dictionary<DateTime, string>();
                DateTime currentDate = startDate.Date;

                while (currentDate <= endDate.Date)
                {
                    var month = currentDate.Month;
                    var year = currentDate.Year;

                    // Filter by month
                    var validMonth = lcategories
                        .Where(l => l.Catdu.HasValue && l.Catau.HasValue &&
                                   l.Catdu.Value.Month <= month &&
                                   l.Catau.Value.Month >= month)
                        .ToList();

                    // Filter by year or fixed categories
                    if (!validMonth.Any(l => l.Catdu!.Value.Year == year || l.Catau!.Value.Year == year))
                    {
                        validMonth = validMonth.Where(l => l.Catfixe == "1").ToList();
                    }

                    if (validMonth.Any())
                    {
                        // Select best match
                        var selected = validMonth.First();
                        foreach (var l in validMonth)
                        {
                            if (currentDate >= l.Catdu && currentDate <= l.Catau)
                            {
                                selected = l;
                                break;
                            }
                        }

                        if (!string.IsNullOrEmpty(selected.Codposte))
                        {
                            result[currentDate] = selected.Codposte;
                        }
                    }

                    currentDate = currentDate.AddDays(1);
                }

                return result;
            }
            catch (Exception)
            {
                throw;
            }
        }
    }
}
