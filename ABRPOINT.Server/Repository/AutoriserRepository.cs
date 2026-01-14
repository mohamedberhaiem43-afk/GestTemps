using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Repository
{
    public class AutoriserRepository : IautoriserRepository
    {

        private readonly ApplicationDbContext _dbContext;
        public AutoriserRepository(ApplicationDbContext dbContext)
        {
            _dbContext = dbContext;
        }
        public void Add(Autoriser autoriser)
        {
            try
            {
                autoriser.Conjour = "O";
                autoriser.Conamdep = autoriser.Conamdep ?? "0";
                autoriser.Conamret = autoriser.Conamret ?? "0";

                // Calculate hours difference between Conret and Condep
                if (autoriser.Condep.HasValue && autoriser.Conret.HasValue)
                {
                    var condep = autoriser.Condep.Value;
                    var conret = autoriser.Conret.Value;

                    // Créer une nouvelle date pour conret avec l'année de condep
                    var adjustedConret = new DateTime(
                        condep.Year,
                        condep.Month,
                        condep.Day,
                        conret.Hour,
                        conret.Minute,
                        conret.Second
                    );
                    autoriser.Conret = adjustedConret;

                    TimeSpan duration = autoriser.Conret.Value - autoriser.Condep.Value;
                    autoriser.Connbjour = (float)Math.Round(duration.TotalHours, 2); // Rounded to 2 decimal places
                }
                else
                {
                    autoriser.Connbjour = 0; // Default if dates are null
                }

                _dbContext.Autorisers.Add(autoriser);
                _dbContext.SaveChanges();
            }
            catch (Exception)
            {
                throw;
            }
        }
        private float? CalculateTotalDuration(DateTime? startDate, DateTime? endDate, string amDep, string amRet)
        {
            if (!startDate.HasValue || !endDate.HasValue)
                return null;

            // Calculate full days between dates (exclusive of start/end days)
            int fullDays = (endDate.Value.Date - startDate.Value.Date).Days - 1;

            // If end date is same as start date, we have a single day case
            if (fullDays < 0)
                fullDays = 0;

            // Parse day fractions (1 = full day, 0 = half day)
            bool isStartFullDay = amDep == "1";
            bool isEndFullDay = amRet == "1";

            // Calculate partial days
            float startDayValue = isStartFullDay ? 1f : 0.5f;
            float endDayValue = isEndFullDay ? 1f : 0.5f;

            // Total duration = start day + full days + end day
            float totalDuration = startDayValue + fullDays + endDayValue;

            return totalDuration;
        }
        public async Task AddMultipleAutorisation(List<Autoriser> autoriser)
        {
            try
            {
                await _dbContext.Autorisers.AddRangeAsync(autoriser);
                await _dbContext.SaveChangesAsync();
            }
            catch (Exception)
            {
                throw;
            }
        }

        public void Delete(Autoriser autoriser)
        {
            try
            {
                if (autoriser != null)
                {
                    _dbContext.Autorisers.Remove(autoriser);
                    _dbContext.SaveChanges();
                }
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<List<AutoriserEmployeDto>> GetAutoriserWithAbsenceAsync(string soccod, string uticod)
        {
            try
            {
                // Utiliser une jointure avec Socusers au lieu de Contains
                var rawResult = await (
                    from c in _dbContext.Autorisers
                    join a in _dbContext.Absences on c.Abscod equals a.Abscod
                    join e in _dbContext.Employes on c.Empcod equals e.Empcod
                    join su in _dbContext.Socusers
                        on new { e.Soccod, e.Sitcod } equals new { su.Soccod, su.Sitcod }
                    where e.Soccod == soccod
                        && su.Uticod == uticod
                    select new AutoriserEmployeDto
                    {
                        Concod = c.Concod,
                        Soccod = e.Soccod,
                        Emplib = e.Emplib,
                        Condat = c.Condat,
                        Condep = c.Condep,
                        Conret = c.Conret,
                        Connbjour = c.Connbjour,
                        Abslib = a.Abslib,
                    }).ToListAsync();

                // Tri et dédoublonnage en mémoire
                var result = rawResult
                    .OrderByDescending(a => a.Condat)
                    .DistinctBy(s => s.Concod)
                    .ToList();

                return result;
            }
            catch (Exception ex)
            {
                throw;
            }
        }
        public async Task<IEnumerable<Autoriser>> GetAllAsync(string soccod,string uticod)
        {
            try
            {
                return await _dbContext.Autorisers.ToListAsync();
            }
            catch (Exception)
            {
                throw;
            }
        }

        public Autoriser GetByConcod(string soccod, string concod)
        {
            try
            {
                return _dbContext.Autorisers
                    .FirstOrDefault(a => a.Soccod == soccod && a.Concod == concod);
            }
            catch (Exception ex)
            {
                throw new Exception("Erreur innatendu: "+ex);
            }
        }

        public void Update(Autoriser autoriser)
        {
            if (autoriser != null)
            {
                var condep = autoriser.Condep.Value;
                var conret = autoriser.Conret.Value;

                // Créer une nouvelle date pour conret avec l'année de condep
                var adjustedConret = new DateTime(
                    condep.Year,
                    condep.Month,
                    condep.Day,
                    conret.Hour,
                    conret.Minute,
                    conret.Second
                );
                autoriser.Conret = adjustedConret;
                TimeSpan duration = autoriser.Conret.Value - autoriser.Condep.Value;
                autoriser.Connbjour = (float)Math.Round(duration.TotalHours, 2); // Rounded to 2 decimal places
                _dbContext.Autorisers.Update(autoriser);
                _dbContext.SaveChanges();
            }
        }

        public async Task<AutDto?> GetAutLib(string? soccod, string? empcod, DateTime dmdate)
        {
            try
            {
                DateTime startOfDay = dmdate.Date;
                DateTime endOfDay = dmdate.Date.AddDays(1).AddTicks(-1);

                var autorisation = await (
                    from a in _dbContext.Autorisers
                    join ab in _dbContext.Absences on a.Abscod equals ab.Abscod
                    where a.Soccod == soccod
                        && a.Empcod == empcod
                        && a.Condep.Value.Day == dmdate.Day
                        && a.Condep <= endOfDay
                        && a.Conret >= startOfDay
                    select new
                    {
                        Abslib = ab.Abslib,
                        Condep = a.Condep,
                        Conret = a.Conret,
                        Connbjour = a.Connbjour
                    }
                ).FirstOrDefaultAsync();

                if (autorisation == null)
                    return null;


                return new AutDto()
                {
                    Abslib = autorisation.Abslib,
                    Connbjour = autorisation.Connbjour,
                    Condep = autorisation.Condep,
                    Conret = autorisation.Conret,
                };
            }
            catch (Exception)
            {
                throw;
            }
        }

        public IEnumerable<Autoriser> GetAll()
        {
            throw new NotImplementedException();
        }
    }
}
