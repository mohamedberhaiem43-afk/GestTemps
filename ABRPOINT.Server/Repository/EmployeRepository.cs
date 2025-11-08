using ABRPOINT.Helper;
using ABRPOINT.Server.CalculService.HeureRetard;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using AutoMapper;
using AutoMapper.QueryableExtensions;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Repository
{
    public class EmployeRepository : IEmployeRepository
    {
        private readonly ApplicationDbContext _dbContext;
        private readonly ISiteRepository _siteRepository;
        private readonly ICalendrierRepository _calendrierRepository;
        private readonly IParametreRepository _parametreRepository;
        private readonly ICongeRepository _congeRepository;
        private readonly IHeureRetardService _retardService;
        private readonly IUtilisateurRepository _utilisateurRepository;
        private readonly IPosteRepository _posteRepository;
        private readonly IautoriserRepository _autorisationRepository;
        private readonly IMapper _mapper;
        private readonly ILogger _logger;   
        public EmployeRepository(ApplicationDbContext dbContext, ISiteRepository siteRepository, ICalendrierRepository icalendrierRepository,
            IParametreRepository parametreRepository, ICongeRepository congeRepository, IMapper mapper, ILogger<EmployeRepository> logger,
            IHeureRetardService retardService,IPosteRepository posteRepository,
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

        public async Task<decimal> GetTotRetards(string empcod, DateTime dateDeb, DateTime dateFin)
        {
            try
            {
                var presences = await _dbContext.Presences
                    .Where(p => p.Empcod == empcod && p.Dmdate >= dateDeb && p.Dmdate <= dateFin)
                    .ToListAsync();
                decimal totalMinutes = 0;

                foreach (var p in presences)
                {
                    var poste = await _posteRepository.GetPoste(p.Soccod, p.Codposte);
                    PresenceDto presence = _mapper.Map<Presence, PresenceDto>(p);
                    AutDto autorisation = await _autorisationRepository.GetAutLib(presence.Soccod, presence.Empcod, (DateTime)presence.Dmdate);
                    var retard = await _retardService.CalculateHeureRetard(presence, poste,autorisation);
                    //if(retard<=165 || p.Prerepos =="1")
                    totalMinutes += retard;
                }

                return totalMinutes;
            }
            catch (Exception)
            {
                throw;
            }
        }
        

        public async Task<IEnumerable<EmployeDto>> GetAllAsync(string soccod,string uticod)
        {
            try
            {
                List<string> sitcods = await _dbContext.Socusers
                   .Where(s => s.Soccod == soccod && s.Uticod == uticod)
                   .Select(s => s.Sitcod)
                   .ToListAsync();

                var employes = await _dbContext.Employes
                    .Where(e => e.Soccod == soccod && sitcods.Contains(e.Sitcod))
                    .ProjectTo<EmployeDto>(_mapper.ConfigurationProvider)
                    .ToListAsync();

                return employes;

            }
            catch (Exception ex)
            {
                _logger.LogError(ex.Message);
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
                List<string> sitcods = await _dbContext.Socusers
                      .Where(s => s.Soccod == soccod && s.Uticod == uticod)
                      .Select(s => s.Sitcod)
                      .ToListAsync();
                return await _dbContext.Employes
                                    .Where(e=>e.Soccod == soccod && e.Actif == "A" && sitcods.Contains(e.Sitcod))
                                   .ToDictionaryAsync(abs => abs.Empcod, abs => abs.Emplib);
            }
            catch (Exception)
            {
                throw;
            }
        }
        public async Task<Dictionary<string, string>> GetFemmeLibs(string soccod, string uticod)
        {
            try
            {
                List<string> sitcods = await _dbContext.Socusers
                      .Where(s => s.Soccod == soccod && s.Uticod == uticod)
                      .Select(s => s.Sitcod)
                      .ToListAsync();
                var employe = await _dbContext.Employes
                    .Where(e=> e.Soccod == soccod && e.Empsexe == "F" && (e.Empsitfam =="M" || e.Empsitfam == "D")
                     && sitcods.Contains(e.Sitcod))
                                   .ToDictionaryAsync(abs => abs.Empcod, abs => abs.Emplib);
                return employe;
            }
            catch (Exception)
            {
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
        public async Task<IList<EmployeePresenceDto>> GetBySitcodAndDircod(string soccod, string uticod, string site, string? empreg = null, string? service = null,DateTime? debut = null,DateTime? fin = null)
        {
            try
            {
                var sitcods = await _utilisateurRepository.GetSitcodsAccess(soccod, uticod);
                // Step 1: Query Employes and join with Presences based on sitcods, apply base filters
                var employeePresenceData = await (from e in _dbContext.Employes
                                                  join p in _dbContext.Presences
                                                      on e.Empcod equals p.Empcod into presenceGroup
                                                  from p in presenceGroup.DefaultIfEmpty() // Left join
                                                  where e.Soccod == soccod 
                                                    && e.Sitcod == site 
                                                    && e.Actif == "A"
                                                    && (debut == null || fin == null || (p.Predat >= debut && p.Predat <= fin))
                                                    && (sitcods.Contains(e.Sitcod))
                                                  select new
                                                  {
                                                      e.Empcod,
                                                      e.Emplib,
                                                      e.Empreg,
                                                      e.Sitcod,
                                                      e.Sercod,
                                                      Tothre = p != null ? p.Tothre : null
                                                      
                                                  })
                                                  .ToListAsync();
                
                // Step 2: Apply additional filters in-memory, if provided
                if (!string.IsNullOrEmpty(empreg))
                {
                    employeePresenceData = employeePresenceData.Where(e => e.Empreg == empreg).ToList();
                }
                if (!string.IsNullOrEmpty(service))
                {
                    employeePresenceData = employeePresenceData.Where(e => e.Sercod == service).ToList();
                }

                // Step 3: Group and calculate TotalMinutes
                var result = new List<EmployeePresenceDto>();

                foreach (var group in employeePresenceData.GroupBy(x => new { x.Empcod, x.Emplib }))
                {
                    var empcod = group.Key.Empcod;
                    var tothRetard = await GetTotRetards(empcod, debut ?? DateTime.MinValue, fin ?? DateTime.MaxValue);
                    var totalMinutes = group
                        .Where(x => !string.IsNullOrEmpty(x.Tothre) && x.Tothre != "00:00")
                        .Sum(x =>
                        {
                            try
                            {
                                int hours = int.Parse(x.Tothre.Substring(0, 2));
                                int minutes = int.Parse(x.Tothre.Substring(3, 2));
                                return (hours * 60) + minutes;
                            }
                            catch
                            {
                                return 0;
                            }
                        });
                    float? nbJours = await GetNbJours(empcod, debut, fin);
                    result.Add(new EmployeePresenceDto
                    {
                        Empcod = empcod,
                        Emplib = group.Key.Emplib,
                        NbJours = nbJours,
                        TotalMinutes = totalMinutes,
                        TotalRetards = tothRetard
                    });
                }


                return result;
            }
            catch (Exception ex)
            {
                // Log exception details here for debugging, if logging is available
                throw new Exception("An error occurred while retrieving data", ex);
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
    }
}
