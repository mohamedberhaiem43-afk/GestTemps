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
        public async Task AddAsync(Autoriser autoriser)
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

                await _dbContext.Autorisers.AddAsync(autoriser);
                await _dbContext.SaveChangesAsync();
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
                foreach (var auth in autoriser)
                {
                    auth.Conjour = "O";
                    auth.Conamdep = auth.Conamdep ?? "0";
                    auth.Conamret = auth.Conamret ?? "0";

                    // Calculate hours difference between Conret and Condep
                    if (auth.Condep.HasValue && auth.Conret.HasValue)
                    {
                        var condep = auth.Condep.Value;
                        var conret = auth.Conret.Value;

                        // Créer une nouvelle date pour conret avec l'année de condep
                        var adjustedConret = new DateTime(
                            condep.Year,
                            condep.Month,
                            condep.Day,
                            conret.Hour,
                            conret.Minute,
                            conret.Second
                        );
                        auth.Conret = adjustedConret;

                        TimeSpan duration = auth.Conret.Value - auth.Condep.Value;
                        auth.Connbjour = (float)Math.Round(duration.TotalHours, 2); // Rounded to 2 decimal places
                    }
                    else
                    {
                        auth.Connbjour = 0; // Default if dates are null
                    }
                }

                await _dbContext.Autorisers.AddRangeAsync(autoriser);
                await _dbContext.SaveChangesAsync();
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task DeleteAsync(Autoriser autoriser)
        {
            try
            {
                if (autoriser != null)
                {
                    _dbContext.Autorisers.Remove(autoriser);
                    await _dbContext.SaveChangesAsync();
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

        public async Task<Autoriser?> GetByConcodAsync(string soccod, string concod)
        {
            try
            {
                return await _dbContext.Autorisers
                    .FirstOrDefaultAsync(a => a.Soccod == soccod && a.Concod == concod);
            }
            catch (Exception ex)
            {
                throw new Exception("Erreur innatendu: "+ex);
            }
        }

        public async Task UpdateAsync(Autoriser autoriser)
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
                await _dbContext.SaveChangesAsync();
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
                        Connbjour = a.Connbjour,
                        Abspayer = ab.Abspayer
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
                    Abspayer = autorisation.Abspayer,
                };
            }
            catch (Exception)
            {
                throw;
            }
        }
        public async Task<Dictionary<(string Empcod, DateTime Date), AutDto?>> GetAutLibBatch(string soccod, string empcod, DateTime dateDeb, DateTime dateFin)
        {
            var result = await (
                from a in _dbContext.Autorisers
                join ab in _dbContext.Absences on a.Abscod equals ab.Abscod
                where a.Soccod == soccod && a.Soccod == ab.Soccod
                    && a.Empcod == empcod
                    && a.Condep.Value.Date <= dateFin
                    && a.Conret.Value.Date >= dateDeb
                select new
                {
                    a.Empcod,
                    a.Condep,
                    a.Conret,
                    ab.Abslib,
                    a.Connbjour,
                    ab.Abspayer
                })
                .ToListAsync();

            // Plusieurs autorisations peuvent partager la même clé (Empcod, Date) lorsqu'un employé
            // possède plus d'une autorisation le même jour. On regroupe pour éviter une exception
            // "duplicate key" dans ToDictionary et on retient la première occurrence.
            return result
                .GroupBy(x => (x.Empcod, Date: x.Condep.Value.Date))
                .ToDictionary(
                    g => g.Key,
                    g =>
                    {
                        var x = g.First();
                        return new AutDto
                        {
                            Abslib = x.Abslib,
                            Connbjour = x.Connbjour,
                            Condep = x.Condep,
                            Conret = x.Conret,
                            Abspayer = x.Abspayer
                        };
                    });
        }

        public async Task<IEnumerable<Autoriser>> GetAllAsync()
        {
            return await _dbContext.Autorisers.ToListAsync();
        }

        public async Task<Dictionary<(string Empcod, DateTime Date), AutDto>> GetAutLibBatch(string soccod,List<(string Empcod, DateTime Date)> demandes)
        {
            if (string.IsNullOrWhiteSpace(soccod))
                throw new ArgumentException(nameof(soccod));

            if (demandes == null || !demandes.Count.Equals(0) == false)
                return new Dictionary<(string, DateTime), AutDto>();

            var empcods = demandes.Select(d => d.Empcod).Distinct().ToList();
            var dates = demandes.Select(d => d.Date.Date).Distinct().ToList();

            DateTime minDate = dates.Min();
            DateTime maxDate = dates.Max().AddDays(1).AddTicks(-1);

            // ========================
            // 1️⃣ Requête SQL unique
            // ========================
            var data = await (
                from a in _dbContext.Autorisers
                join ab in _dbContext.Absences on a.Abscod equals ab.Abscod
                where a.Soccod == soccod
                      && empcods.Contains(a.Empcod)
                      && a.Condep <= maxDate
                      && a.Conret >= minDate
                select new
                {
                    a.Empcod,
                    Abslib = ab.Abslib,
                    a.Condep,
                    a.Conret,
                    a.Connbjour,
                    Abspayer = ab.Abspayer
                }
            ).ToListAsync();

            // ========================
            // 2️⃣ Filtrage en mémoire
            // ========================
            var result = new Dictionary<(string Empcod, DateTime Date), AutDto>();

            foreach (var d in demandes)
            {
                var startOfDay = d.Date.Date;
                var endOfDay = startOfDay.AddDays(1).AddTicks(-1);

                var aut = data.FirstOrDefault(a =>
                    a.Empcod == d.Empcod &&
                    a.Condep <= endOfDay &&
                    a.Conret >= startOfDay);

                if (aut == null)
                    continue;

                result[(d.Empcod, startOfDay)] = new AutDto
                {
                    Abslib = aut.Abslib,
                    Connbjour = aut.Connbjour,
                    Condep = aut.Condep,
                    Conret = aut.Conret,
                    Abspayer = aut.Abspayer
                };
            }

            return result;
        }
        public async Task<List<AutDto>> GetAutorisationsByPeriod(string soccod, string empcod, DateTime startDate, DateTime endDate)
        {
            try
            {
                return await (
                    from a in _dbContext.Autorisers
                    join ab in _dbContext.Absences on a.Abscod equals ab.Abscod
                    where a.Soccod == soccod &&
                          a.Empcod == empcod &&
                          a.Condep <= endDate &&
                          a.Conret >= startDate
                    select new AutDto
                    {
                        Abslib = ab.Abslib,
                        Connbjour = a.Connbjour,
                        Condep = a.Condep,
                        Conret = a.Conret,
                        Abspayer = ab.Abspayer
                    }
                ).ToListAsync();
            }
            catch (Exception)
            {
                throw;
            }
        }
    }
}
