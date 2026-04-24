using ABRPOINT.Server.Data;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Repository
{
    public class SiteRepository : ISiteRepository
    {
        private readonly ApplicationDbContext _dbContext;
        public SiteRepository(ApplicationDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        public async Task AddAsync(Site entity)
        {
            try
            {
                await _dbContext.Sites.AddAsync(entity);
                await _dbContext.SaveChangesAsync();
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task DeleteAsync(Site entity)
        {
            if (entity != null)
            {
                _dbContext.Sites.Remove(entity);
                await _dbContext.SaveChangesAsync();
            }
        }

        public async Task<IEnumerable<Site>> GetAllAsync()
        {
            return await _dbContext.Sites.ToListAsync();
        }

        public async Task<Dictionary<string, string>> GetSitLibsAsync()
        {
            return await _dbContext.Sites
                             .GroupBy(s => s.Sitcod)
                             .Select(group => group.First())
                             .ToDictionaryAsync(abs => abs.Sitcod, abs => abs.Sitlib ?? abs.Sitcod);
        }

        public async Task<Dictionary<string, string>> GetSitLibsAsync(string soccod)
        {
            try
            {
                return await _dbContext.Sites
                    .Where(s => s.Soccod == soccod)
                    .GroupBy(s => s.Sitcod)
                    .Select(group => group.First())
                    .ToDictionaryAsync(s => s.Sitcod, s => s.Sitlib ?? s.Sitcod);
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException($"Erreur lors de la récupération des sites pour la société {soccod}", ex);
            }
        }

        public async Task<Dictionary<string, string>> GetSitLibsAsync(string soccod, string uticod)
        {
            return await _dbContext.Socusers
                .Where(s => s.Soccod == soccod && s.Uticod == uticod)
                .Join(
                    _dbContext.Sites,
                    socuser => socuser.Sitcod,
                    site => site.Sitcod,
                    (socuser, site) => new { site.Sitcod, site.Sitlib }
                )
                .Distinct()
                .ToDictionaryAsync(result => result.Sitcod, result => result.Sitlib ?? result.Sitcod);
        }

        public async Task<Site?> GetBySitcodAsync(string soccod, string sitcod)
        {
            try
            {
                return await _dbContext.Sites
                    .Where(s => s.Soccod == soccod && s.Sitcod == sitcod)
                    .SingleOrDefaultAsync();
            }
            catch (Exception ex)
            {
                throw new Exception("Erreur inattendue", ex);
            }
        }

        public async Task UpdateAsync(Site entity)
        {
            if (entity != null)
            {
                _dbContext.Sites.Update(entity);
                await _dbContext.SaveChangesAsync();
            }
        }

        public async Task<IEnumerable<Site>> GetAllAsync(string soccod)
        {
            try
            {
                return await _dbContext.Sites
                    .Where(s => s.Soccod == soccod)
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                throw new Exception("Error retrieving sites", ex);
            }
        }
    }
}
