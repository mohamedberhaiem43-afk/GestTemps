using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using AutoMapper;
using AutoMapper.QueryableExtensions;
using Microsoft.EntityFrameworkCore;
using System.Threading.Tasks;

namespace ABRPOINT.Server.Repository
{
    public class CalendrierRepository : ICalendrierRepository
    {
        private readonly ApplicationDbContext _dbContext;
        private readonly ILogger<CalendrierRepository> _logger;
        private readonly IMapper _mapper;
        private readonly IParametreRepository _parametreRepository;
        private readonly ICongeRepository _congeRepository;
        private readonly IJourFerieRepository _ferierRepository;
        public CalendrierRepository(ApplicationDbContext dbContext,IMapper mapper,ILogger<CalendrierRepository> logger,
            IParametreRepository parametreRepository,ICongeRepository congeRepository,IJourFerieRepository jourFerieRepository)
        {
            _dbContext = dbContext;
            _mapper = mapper;
            _logger = logger;
            _parametreRepository = parametreRepository;
            _congeRepository = congeRepository;
            _ferierRepository = jourFerieRepository;
        }
        public void Add(Calendsoc calendrier)
        {
            _dbContext.Calendsocs.Add(calendrier);
            _dbContext.SaveChanges();
        }

        public void Delete(Calendsoc calendrier)
        {
            if (calendrier != null)
            {
                _dbContext.Calendsocs.Remove(calendrier);
                _dbContext.SaveChanges();
            }
        }

        public async Task<Dictionary<string, string>> GetCalLibs()
        {
            return await _dbContext.Calendsocs
                                .ToDictionaryAsync(abs => abs.Caltype, abs => abs.Callib);
        }

        public IEnumerable<Calendsoc> GetAll()
        {
            return _dbContext.Calendsocs
                .Select(cal => new Calendsoc { Caltype = cal.Caltype, Callib = cal.Callib })
                .Distinct()
                  .ToList();
        }
        public async Task UpdateCalendrier(string soccod, string caltype, string annee, float nbhJours, float nbhSamedi, string jourRepos, string mois, byte tousMois)
        {
            try
            {
                List<Lcalendsoc>? recordsToUpdate = null;
                if (tousMois == 0)
                {
                    recordsToUpdate = await _dbContext.Lcalendsocs
                        .Where(s => s.Soccod == soccod && s.Caltype == caltype && s.CalAn == annee && s.CalMois == mois)
                        .ToListAsync();
                }
                else
                {
                    recordsToUpdate = await _dbContext.Lcalendsocs
                        .Where(s => s.Soccod == soccod && s.Caltype == caltype && s.CalAn == annee)
                        .ToListAsync();
                }
                // Convert jourRepos (string "0", "1", ..., "6") to a DayOfWeek enum value
                DayOfWeek jourReposDayOfWeek = (DayOfWeek)Enum.Parse(typeof(DayOfWeek), jourRepos);

                foreach (var record in recordsToUpdate)
                    {
                        if (record.CalDate.HasValue)
                        {
                            var dayOfWeek = record.CalDate.Value.DayOfWeek;

                            if (dayOfWeek == DayOfWeek.Saturday)
                            {
                                record.CalNbh = nbhSamedi; // 🔹 Update Saturdays
                            }
                            else if (dayOfWeek == jourReposDayOfWeek)
                            {
                                record.CalNbh = 0;
                            }
                            else
                            {
                                record.CalNbh = nbhJours; // 🔹 Update other days
                            }
                        }
                    }

                _dbContext.Lcalendsocs.UpdateRange(recordsToUpdate);
                await _dbContext.SaveChangesAsync();
                
            }
            catch (Exception ex)
            {
                // Handle exception if needed
                Console.WriteLine($"An error occurred: {ex.Message}");
            }
        }

        public async Task<IEnumerable<Lcalendsoc>> GetAnneeCalendrier(string soccod,string annee)
        {
            try
            {
                var calendriers = await _dbContext.Lcalendsocs
                                                    .Where(c=>c.Soccod == soccod && c.CalAn == annee)
                                                    .OrderBy(c=>c.CalDate)
                                                    .AsNoTracking()
                                                    .ToListAsync();
                return calendriers;
            }
            catch (Exception e)
            {

                _logger.LogCritical("Error calendrier");
                _logger.LogError(e.Message);
                return new List<Lcalendsoc>();
            }
        }

        public async Task<IEnumerable<CalendsocDto>> GetCumul(string soccod, string annee)
        {
            try
            {
                var result = await _dbContext.Calendsocs
                    .Where(s => s.Soccod == soccod && s.CalAn == annee)
                    .ProjectTo<CalendsocDto>(_mapper.ConfigurationProvider)
                    .ToListAsync();

                Console.WriteLine($"Résultat retourné: {result.Count()} enregistrements");
                return result;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Erreur dans GetCumul: {ex.Message}");
                throw;
            }
        }

        public async Task<Calendsoc> GetCalendrier(string soccod, string annee, string moisdeb, string type)
        {
            try
            {
                Calendsoc? calendrier = await _dbContext.Calendsocs.
                FirstOrDefaultAsync(s => s.Soccod == soccod &&
                s.CalAn == annee &&
                s.CalMois == moisdeb &&
                s.Caltype == type);

                return calendrier;
            }
            catch (Exception ex)
            {
                throw new Exception("Erreur innatendu",ex);
            }
            
        }

        public void Update(Calendsoc calendrier)
        {
            if (calendrier != null)
            {
                _dbContext.Calendsocs.Update(calendrier);
                _dbContext.SaveChanges();
            }
        }

        public async Task<(string? calend,float? hours,DateTime? startDate,DateTime? endDate,int? jourferier,float? heuresferier)>GetNbHeuresParSemaineWithDates(string soccod,
                           string mois,string annee,string semaine,string empcod)
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
                    return ("0",0, null, null, 0, 0);
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

                #region Découpage en semaines
                var weeks = new List<List<Lcalendsoc>>();
                var currentWeek = new List<Lcalendsoc>();

                foreach (var day in monthDays)
                {
                    bool isFerier = await _ferierRepository.IsFerier(soccod, day.CalDate.Value);
                    var conge = await _congeRepository.GetEmpCongeByDate(
                        soccod, empcod, day.CalDate.Value);

                    if (isFerier)
                    {
                        day.CalNbh = await _parametreRepository.GetNbhFerier(soccod);
                    }
                    else if (conge != null)
                    {
                        var nbh = await _parametreRepository.GetNbhConge(soccod);
                        day.CalNbh = conge.Connbjour == 0.5 ? nbh / 2 : nbh;
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
                string? calend = await _dbContext.Employes.Where(e => e.Empcod == empcod && e.Soccod == soccod).Select(e=>e.Caltype).FirstOrDefaultAsync();
                #region TOTAL (semaine = 0)
                if (weekNumber == 0)
                {
                    var allDays = weeks.SelectMany(w => w).ToList();

                    float totalHours = allDays.Sum(d => d.CalNbh ?? 0);
                    DateTime? start = allDays.First().CalDate;
                    DateTime? end = allDays.Last().CalDate;

                    int jourFerier = 0;
                    float heuresFerier = 0;
                    int panierTotal = 0;

                    foreach (var day in allDays)
                    {
                        bool isFerier = await _ferierRepository.IsFerier(soccod, day.CalDate.Value);
                        var conge = await _congeRepository.GetEmpCongeByDate(
                            soccod, empcod, day.CalDate.Value);

                        if (isFerier)
                        {
                            jourFerier++;
                            heuresFerier += day.CalNbh ?? 0;
                            continue;
                        }

                        if (conge != null)
                            continue;

                    }

                    return (calend,totalHours, start, end, jourFerier, heuresFerier);
                }
                #endregion

                #region Semaine précise
                if (weekNumber < 1 || weekNumber > weeks.Count)
                    return (calend,0, null, null, 0, 0);

                var selectedWeek = weeks[weekNumber - 1];

                float weekHours = selectedWeek.Sum(d => d.CalNbh ?? 0);
                DateTime? weekStart = selectedWeek.First().CalDate;
                DateTime? weekEnd = selectedWeek.Last().CalDate;

                int jourFerierWeek = 0;
                float heuresFerierWeek = 0;

                foreach (var day in selectedWeek)
                {
                    bool isFerier = await _ferierRepository.IsFerier(soccod, day.CalDate.Value);
                    var conge = await _congeRepository.GetEmpCongeByDate(
                        soccod, empcod, day.CalDate.Value);

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

                return (calend,weekHours, weekStart, weekEnd, jourFerierWeek, heuresFerierWeek);
                #endregion
            }
            catch
            {
                throw;
            }
        }


        private DateTime AdjustDayToMonth(DateTime date)
        {
            int daysInMonth = DateTime.DaysInMonth(date.Year, date.Month);
            return date.Day > daysInMonth ? new DateTime(date.Year, date.Month, daysInMonth) : date;
        }

        public async Task<IDictionary<string, string>> GetCalendriers(string soccod)
        {
            try
            {
                var calends = await _dbContext.Calendsocs
                    .Where(c => c.Soccod == soccod)
                    .ToListAsync(); // ✅ Fetch to memory first

                // ✅ Perform DistinctBy on client side
                var distinctCalends = calends
                    .DistinctBy(c => c.Caltype)
                    .ToDictionary(c => c.Caltype, c => c.Callib);

                return distinctCalends;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Erreur dans GetCalendriers: {ex.Message}");
                throw;
            }
        }

        public async Task<bool> CloneCalendrier(string soccod, int annee)
        {
            try
            {
                string anneeSource = (annee - 1).ToString();
                string anneeCible = annee.ToString();

                // 1️⃣ Lire calendrier de l’année précédente
                var calendrierSource = await _dbContext.Calendsocs
                    .Where(c => c.Soccod == soccod && c.CalAn == anneeSource)
                    .AsNoTracking()
                    .ToListAsync();

                if (!calendrierSource.Any())
                    return false;

                // 2️⃣ Cloner
                var calendrierClone = calendrierSource.Select(c => new Calendsoc
                {
                    Soccod = c.Soccod,
                    Caltype = c.Caltype,
                    CalAn = anneeCible,
                    CalMois = c.CalMois,
                    CalSem = c.CalSem,
                    CalNbh = c.CalNbh,
                    CalTrav = c.CalTrav,
                    CalHjour = c.CalHjour,
                    CalHouv = c.CalHouv,
                    Callib = c.Callib,
                    CalHsem = c.CalHsem
                }).ToList();

                await _dbContext.Calendsocs.AddRangeAsync(calendrierClone);
                await _dbContext.SaveChangesAsync();
                
                return true;
            }
            catch (Exception)
            {
                throw;
            }
        }
        public async Task<bool> CloneLCalendrier(string soccod, int annee)
        {
            string anneeSource = (annee - 1).ToString();
            string anneeCible = annee.ToString();

            // 1️⃣ Charger l’année précédente (sans tracking)
            var source = await _dbContext.Lcalendsocs
                .AsNoTracking()
                .Where(l => l.Soccod == soccod && l.CalAn == anneeSource)
                .ToListAsync();

            if (!source.Any())
                return false;

            // 2️⃣ Cloner avec nouvelle année + nouvelle date
            var clones = source.Select(l =>
            {
                DateTime? newDate = null;

                if (l.CalDate.HasValue)
                {
                    newDate = new DateTime(
                        annee,
                        l.CalDate.Value.Month,
                        l.CalDate.Value.Day
                    );
                }

                return new Lcalendsoc
                {
                    Soccod = l.Soccod,
                    Caltype = l.Caltype,
                    CalDate = newDate,
                    CalAn = anneeCible,
                    CalMois = l.CalMois,
                    CalSem = l.CalSem,
                    CalNbh = l.CalNbh,
                    CalTrav = l.CalTrav,
                    CalCol = l.CalCol,
                    CalRow = l.CalRow,
                    Motif = l.Motif,
                    Payer = l.Payer
                };
            }).ToList();

            await _dbContext.Lcalendsocs.AddRangeAsync(clones);
            await _dbContext.SaveChangesAsync();

            return true;
        }

        public async Task AddCalendrier(string soccod, string annee, string caltype)
        {
            // Vérifier si le calendrier existe déjà
            var exists = await _dbContext.Calendsocs
                .AnyAsync(c => c.Soccod == soccod && c.CalAn == annee && c.Caltype == caltype);

            if (exists)
                throw new Exception($"Le calendrier {annee}/{caltype} existe déjà pour la société {soccod}");

            // Créer les entrées Calendsoc pour chaque mois
            var calendsocs = new List<Calendsoc>();
            for (int month = 1; month <= 12; month++)
            {
                calendsocs.Add(new Calendsoc
                {
                    Soccod = soccod,
                    Caltype = caltype,
                    CalAn = annee,
                    CalMois = month.ToString("00"),
                    CalSem = month,
                    CalNbh = 176, // Valeur par défaut (22 jours * 8h)
                    CalTrav = 22,
                    CalHjour = 8,
                    CalHouv = 8,
                    Callib = $"Calendrier {annee}",
                    CalHsem = 40
                });
            }

            await _dbContext.Calendsocs.AddRangeAsync(calendsocs);
            await _dbContext.SaveChangesAsync();

            // Créer les entrées Lcalendsoc pour chaque jour de l'année
            var lcalendsocs = new List<Lcalendsoc>();
            int year = int.Parse(annee);
            var startDate = new DateTime(year, 1, 1);
            var endDate = new DateTime(year, 12, 31);

            for (var date = startDate; date <= endDate; date = date.AddDays(1))
            {
                int weekNum = GetWeekNumber(date);
                float nbh = date.DayOfWeek == DayOfWeek.Sunday || date.DayOfWeek == DayOfWeek.Saturday ? 0 : 8;

                lcalendsocs.Add(new Lcalendsoc
                {
                    Soccod = soccod,
                    Caltype = caltype,
                    CalDate = date,
                    CalAn = annee,
                    CalMois = date.Month.ToString("00"),
                    CalSem = weekNum,
                    CalNbh = nbh,
                    CalTrav = nbh > 0 ? 1 : 0
                });
            }

            await _dbContext.Lcalendsocs.AddRangeAsync(lcalendsocs);
            await _dbContext.SaveChangesAsync();
        }

        private int GetWeekNumber(DateTime date)
        {
            var dayOfYear = date.DayOfYear;
            return ((dayOfYear - 1) / 7) + 1;
        }


    }
}

