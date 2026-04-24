using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Repository
{
    public class AllaitementRepository : IAllaitementRepository
    {
        private readonly ApplicationDbContext _dbContext;
        private readonly IUtilisateurRepository _utilisateurRepository;
        public AllaitementRepository(ApplicationDbContext dbContext, IUtilisateurRepository utilisateurRepository)
        {
            _dbContext = dbContext;
            _utilisateurRepository = utilisateurRepository;
        }

        public async Task AddAsync(Allaitement allaitement)
        {
            await _dbContext.Allaitements.AddAsync(allaitement);
            await _dbContext.SaveChangesAsync();
        }

        public async Task DeleteAsync(Allaitement allaitement)
        {
            if (allaitement != null)
            {
                _dbContext.Allaitements.Remove(allaitement);
                await _dbContext.SaveChangesAsync();
            }
        }

        public async Task<Dictionary<DateTime, float>> GetAllaitementsByPeriodAsync(
            string soccod,
            string empcod,
            DateTime startDate,
            DateTime endDate)
        {
            try
            {
                var allaitements = await _dbContext.Allaitements
                    .Where(a => a.Soccod == soccod &&
                               a.Empcod == empcod &&
                               a.Condep <= endDate &&
                               a.Conret >= startDate)
                    .ToListAsync();

                var result = new Dictionary<DateTime, float>();

                // Generate all dates in range
                DateTime current = startDate.Date;
                while (current <= endDate.Date)
                {
                    // Find allaitement period that covers this date
                    var allaitement = allaitements.FirstOrDefault(a =>
                        a.Condep <= current && a.Conret >= current);

                    if (allaitement != null)
                    {
                        float hours = current.DayOfWeek switch
                        {
                            DayOfWeek.Sunday => allaitement.Dimanche ?? 0,
                            DayOfWeek.Monday => allaitement.Lundi ?? 0,
                            DayOfWeek.Tuesday => allaitement.Mardi ?? 0,
                            DayOfWeek.Wednesday => allaitement.Mercredi ?? 0,
                            DayOfWeek.Thursday => allaitement.Jeudi ?? 0,
                            DayOfWeek.Friday => allaitement.Vendredi ?? 0,
                            DayOfWeek.Saturday => allaitement.Samedi ?? 0,
                            _ => 0
                        };

                        if (hours > 0)
                        {
                            result[current] = hours;
                        }
                    }

                    current = current.AddDays(1);
                }

                return result;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<IEnumerable<AllaitementDto>> GetAllAsync(string soccod, string uticod)
        {
            try
            {
                var result = from a in _dbContext.Allaitements
                             join e in _dbContext.Employes on a.Empcod equals e.Empcod
                             join su in _dbContext.Socusers
                                 on new { e.Soccod, e.Sitcod } equals new { su.Soccod, su.Sitcod }
                             where a.Soccod == soccod
                                 && su.Uticod == uticod
                             select new AllaitementDto
                             {
                                 Soccod = a.Soccod,
                                 Conjour = a.Conjour,
                                 Empcod = a.Empcod,
                                 Condat = a.Condat,
                                 Condep = a.Condep,
                                 Conret = a.Conret,
                                 Lundi = a.Lundi,
                                 Mardi = a.Mardi,
                                 Mercredi = a.Mercredi,
                                 Jeudi = a.Jeudi,
                                 Vendredi = a.Vendredi,
                                 Samedi = a.Samedi,
                                 Dimanche = a.Dimanche,
                                 Emplib = e.Emplib,
                                 Concod = a.Concod,
                             };

                return await result.ToListAsync();
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<Allaitement?> GetAsync(string soccod, string concod)
        {
            try
            {
                return await _dbContext.Allaitements
                    .Where(a => a.Soccod == soccod && a.Concod == concod)
                    .SingleOrDefaultAsync();
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<Allaitement?> GetByEmpcodAsync(string soccod, string concod)
        {
            try
            {
                return await _dbContext.Allaitements
                .FirstOrDefaultAsync(s => s.Soccod == soccod && s.Concod == concod);
            }
            catch (Exception ex)
            {
                throw new Exception("Error retrieving breastfeeding data", ex);
            }
        }

        public async Task UpdateAsync(Allaitement allaitement)
        {
            if (allaitement != null)
            {
                _dbContext.Allaitements.Update(allaitement);
                await _dbContext.SaveChangesAsync();
            }
        }

        public async Task<IEnumerable<Allaitement>> GetAllAsync()
        {
            return await _dbContext.Allaitements.ToListAsync();
        }

        public async Task<float?> GetNbhAllaitementAsync(string soccod, string empcod, DateTime? predat)
        {
            try
            {
                if (!predat.HasValue) return 0;
                var allaitement = await _dbContext.Allaitements.Where(alt => alt.Soccod == soccod &&
                                                                             alt.Empcod == empcod &&
                                                                             predat >= alt.Condep && predat <= alt.Conret)
                                                                             .SingleOrDefaultAsync();
                return predat.Value.DayOfWeek switch
                {
                    DayOfWeek.Sunday => allaitement?.Dimanche,
                    DayOfWeek.Monday => allaitement?.Lundi,
                    DayOfWeek.Tuesday => allaitement?.Mardi,
                    DayOfWeek.Wednesday => allaitement?.Mercredi,
                    DayOfWeek.Thursday => allaitement?.Jeudi,
                    DayOfWeek.Friday => allaitement?.Vendredi,
                    DayOfWeek.Saturday => allaitement?.Samedi,
                    _ => 0
                };
            }
            catch (Exception)
            {
                throw;
            }
        }
    }
}
