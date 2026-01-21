using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Repository
{
    public class JourFerieRepository : IJourFerieRepository
    {

        private readonly ApplicationDbContext _dbContext;
        public JourFerieRepository(ApplicationDbContext dbContext)
        {
            _dbContext = dbContext;
        }
        public async Task<List<Ferier>> GetFeriersByPeriod(string soccod,DateTime startDate,DateTime endDate)
        {
            try
            {
                return await _dbContext.Feriers
                    .Where(f => f.Soccod == soccod &&
                               f.Ferdate >= startDate &&
                               f.Ferdate <= endDate)
                    .ToListAsync();
            }
            catch (Exception)
            {
                throw;
            }
        }
        public void Add(Ferier ferier)
        {
            _dbContext.Feriers.Add(ferier);
            _dbContext.SaveChanges();
        }

        public void Delete(Ferier ferier)
        {
            if (ferier != null)
            {
                _dbContext.Feriers.Remove(ferier);
                _dbContext.SaveChanges();
            }
        }

        public IEnumerable<Ferier> GetAll()
        {
            return _dbContext.Feriers.ToList();
        }
        public async Task<Dictionary<DateTime, Ferier>> GetByFerdateBatch(string soccod, DateTime dateDeb, DateTime dateFin)
        {
            var feries = await _dbContext.Feriers
                .Where(f => f.Soccod == soccod && f.Ferdate.HasValue
                            && f.Ferdate >= dateDeb
                            && f.Ferdate <= dateFin)
                .ToListAsync();

            return feries.ToDictionary(f => f.Ferdate!.Value, f => f);
        }


        public async Task<Ferier> GetByFerdate(string soccod, DateTime ferdate)
        {
            return await _dbContext.Feriers.FirstOrDefaultAsync(s => s.Soccod == soccod && s.Ferdate == ferdate);
        }
        public async Task<float?> GetFerheure(string soccod,DateTime? ferdate)
        {
            try
            {
                return await _dbContext.Feriers.Where(s => s.Soccod == soccod && s.Ferdate == ferdate).Select(f=>f.Ferheure).FirstOrDefaultAsync();
            }
            catch (Exception)
            {
                throw;
            }
        }
        public async Task<float?> GetHeureFerieTrav(string soccod, DateTime? predat, string? tothre)
        {
            try
            {
                Ferier? ferier = await _dbContext.Feriers
                    .Where(f => f.Soccod == soccod && f.Ferdate == predat)
                    .FirstOrDefaultAsync();
                

                if (ferier == null) return 0;

                // Convert "09:30" to float (e.g., 9.5)
                if (TimeSpan.TryParse(tothre, out TimeSpan time))
                {
                    float totalHours = (float)time.TotalHours;
                    return totalHours;
                }

                return null; // Invalid format
            }
            catch (Exception)
            {
                throw;
            }
        }
        public async Task<float?> GetHeureFerieTravParPeriode(string soccod, DateTime? predat, string? tothre)
        {
            try
            {
                Ferier? ferier = await _dbContext.Feriers
                    .Where(f => f.Soccod == soccod && f.Ferdate == predat)
                    .FirstOrDefaultAsync();

                if (ferier == null) return 0;

                // Convert "09:30" to float (e.g., 9.5)
                if (TimeSpan.TryParse(tothre, out TimeSpan time))
                {
                    float totalHours = (float)time.TotalHours;
                    return totalHours;
                }

                return null; // Invalid format
            }
            catch (Exception)
            {
                throw;
            }
        }


        public async Task<float?> GetNbHeures(PresenceDto presence,string codpost)
        {
            try
            {
                bool isFerier = await IsFerier(presence.Soccod, presence.Predat);
                float? nbheure = 0;
                //float? nbheure = await _posteRepository.GetJourHeures(presence.Soccod,presence.Predat, codpost);
                return nbheure;
            }
            catch (Exception)
            { 
                throw;
            }
        }

        public async Task<float?> GetTotheureFerierParPeriode(string soccod,DateTime? debut,DateTime? fin)
        {
            try
            {
                var query = _dbContext.Feriers
                    .Where(f => f.Soccod == soccod);

                if (debut.HasValue)
                    query = query.Where(f => f.Ferdate >= debut.Value);

                if (fin.HasValue)
                    query = query.Where(f => f.Ferdate <= fin.Value);

                return await query.SumAsync(f => (float?)f.Ferheure);
            }
            catch (Exception)
            {
                throw;
            }
        }


        public async Task<bool> IsFerier(string soccod,DateTime? predat)
        {
            try
            {
                bool isFerier = await _dbContext.Feriers.Where(f => f.Soccod == soccod && f.Ferdate == predat).AnyAsync();
                return isFerier;
            }
            catch (Exception)
            {
                throw;
            }
        }
        public void Update(Ferier ferier)
        {
            try
            {
                var existing = _dbContext.Feriers
                    .FirstOrDefault(f => f.Soccod == ferier.Soccod && f.Ferdate == ferier.Ferdate);

                if (existing == null)
                {
                    // L'entrée n'existe pas, vous pouvez l'ajouter
                    _dbContext.Feriers.Add(ferier);
                }
                else
                {
                    // L'entrée existe, donc on peut la mettre à jour
                    _dbContext.Entry(existing).CurrentValues.SetValues(ferier);
                }

                _dbContext.SaveChanges();

            }
            catch (Exception)
            {
                throw;
            }
        }
    }
}
