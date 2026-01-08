using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using AutoMapper;
using AutoMapper.QueryableExtensions;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Repository
{
    public class CalendrierRepository : ICalendrierRepository
    {
        private readonly ApplicationDbContext _dbContext;
        private readonly ILogger<CalendrierRepository> _logger;
        private readonly IMapper _mapper;
        private readonly IParametreRepository _parametreRepository;
        public CalendrierRepository(ApplicationDbContext dbContext,IMapper mapper,ILogger<CalendrierRepository> logger,IParametreRepository parametreRepository)
        {
            _dbContext = dbContext;
            _mapper = mapper;
            _logger = logger;
            _parametreRepository = parametreRepository;
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

        public Dictionary<string, string> GetCalLibs()
        {
            return _dbContext.Calendsocs
                                .ToDictionary(abs => abs.Caltype, abs => abs.Callib);
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

        public async Task<float?> GetNbHeuresParSemaine(string soccod, string mois, string annee, string semaine, string empcod)
        {
            try
            {
                // Validate input parameters
                if (string.IsNullOrEmpty(soccod) || string.IsNullOrEmpty(mois) ||
                    string.IsNullOrEmpty(annee) || string.IsNullOrEmpty(semaine) ||
                    string.IsNullOrEmpty(empcod))
                {
                    return null;
                }

                // Get employee's calendar type
                string? type = await _dbContext.Employes
                    .Where(e => e.Empcod == empcod)
                    .Select(e => e.Caltype)
                    .FirstOrDefaultAsync();

                if (string.IsNullOrEmpty(type))
                    return null;

                // Get company's month configuration
                ParametreMoisPointageDto jourDebFinDto = await _parametreRepository.GetParametreMoisPointage(soccod);
                if (jourDebFinDto == null)
                {
                    return null;
                }

                // Parse month and year
                if (!int.TryParse(mois, out int month) || !int.TryParse(annee, out int year) ||
                    !int.TryParse(semaine, out int weekNumber))
                {
                    return null;
                }

                // Calculate work month start and end dates according to company parameters
                DateTime startMonth, endMonth;

                // Start date calculation
                if (jourDebFinDto.Moisdeb == "P") // Previous month
                {
                    var previousMonth = month == 1 ? 12 : month - 1;
                    var previousYear = month == 1 ? year - 1 : year;
                    startMonth = new DateTime(previousYear, previousMonth, int.Parse(jourDebFinDto.Joudeb));
                }
                else // Current month
                {
                    startMonth = new DateTime(year, month, int.Parse(jourDebFinDto.Joudeb));
                }

                // End date calculation
                if (jourDebFinDto.Moisfin == "P") // Previous month
                {
                    var previousMonth = month == 1 ? 12 : month - 1;
                    var previousYear = month == 1 ? year - 1 : year;
                    endMonth = new DateTime(previousYear, previousMonth, int.Parse(jourDebFinDto.Joufin));
                }
                else // Current month
                {
                    endMonth = new DateTime(year, month, int.Parse(jourDebFinDto.Joufin));
                }

                // Adjust for month boundaries
                startMonth = AdjustDayToMonth(startMonth);
                endMonth = AdjustDayToMonth(endMonth);

                // Get all calendar days in the work month
                var monthDays = await _dbContext.Lcalendsocs
                    .Where(c => c.Soccod == soccod &&
                                c.CalDate >= startMonth &&
                                c.CalDate <= endMonth &&
                                c.Caltype == type)
                    .OrderBy(c => c.CalDate)
                    .ToListAsync();

                if (!monthDays.Any())
                    return 0;

                // Group days into weeks (ending on rest day)
                var weeks = new List<List<Lcalendsoc>>();
                var currentWeek = new List<Lcalendsoc>();

                foreach (var day in monthDays)
                {
                    currentWeek.Add(day);

                    // If it's a rest day or last day of month, complete the week
                    if (day.CalNbh == 0 || day == monthDays.Last())
                    {
                        weeks.Add(currentWeek);
                        currentWeek = new List<Lcalendsoc>();
                    }
                }

                // If we want all weeks (semaine = "0"), sum all hours
                if (semaine == "0")
                {
                    return weeks.Sum(w => w.Sum(d => d.CalNbh));
                }

                // Validate week number
                if (weekNumber < 1 || weekNumber > weeks.Count)
                    return 0;

                // Return hours for the requested week
                return weeks[weekNumber - 1].Sum(d => d.CalNbh);
            }
            catch (Exception ex)
            {
                // Log error here
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


    }
}

