using ABRPOINT.Server.Data;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Repository
{
    public class FonctionRepository : IFonctionRepository
    {
        private readonly ApplicationDbContext _dbContext;
        public FonctionRepository(ApplicationDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        public async Task AddAsync(Fonction fonction)
        {
            try
            {
                await _dbContext.Fonctions.AddAsync(fonction);
                await _dbContext.SaveChangesAsync();
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task DeleteAsync(Fonction fonction)
        {
            if (fonction != null)
            {
                _dbContext.Fonctions.Remove(fonction);
                await _dbContext.SaveChangesAsync();
            }
        }

        public async Task<IEnumerable<Fonction>> GetAllAsync()
        {
            return await _dbContext.Fonctions.ToListAsync();
        }

        public async Task<Dictionary<string, string>> GetFonLibsAsync()
        {
            return await _dbContext.Fonctions
                               .ToDictionaryAsync(abs => abs.Foncod, abs => abs.Fonlib ?? "");
        }

        public async Task<Fonction?> GetByFonccodAsync(string soccod, string fonccod)
        {
            return await _dbContext.Fonctions.FirstOrDefaultAsync(s => s.Soccod == soccod && s.Foncod == fonccod);
        }

        public async Task UpdateAsync(Fonction fonction)
        {
            if (fonction != null)
            {
                _dbContext.Fonctions.Update(fonction);
                await _dbContext.SaveChangesAsync();
            }
        }

        public async Task<IEnumerable<Fonction>> GetAllAsync(string soccod)
        {
            try
            {
                return await _dbContext.Fonctions
                    .Where(f => f.Soccod == soccod)
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                throw new Exception("Error retrieving functions", ex);
            }
        }
    }
}
