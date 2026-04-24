using ABRPOINT.Server.Data;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Repository
{
    public class QualifRepositroy : IQualifRepository
    {
        private readonly ApplicationDbContext _dbContext;
        public QualifRepositroy(ApplicationDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        public async Task AddAsync(Qualif entity)
        {
            try
            {
                await _dbContext.Qualifs.AddAsync(entity);
                await _dbContext.SaveChangesAsync();
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task DeleteAsync(Qualif entity)
        {
            if (entity != null)
            {
                _dbContext.Qualifs.Remove(entity);
                await _dbContext.SaveChangesAsync();
            }
        }

        public async Task<IEnumerable<Qualif>> GetAllAsync()
        {
            return await _dbContext.Qualifs.ToListAsync();
        }

        public async Task<IEnumerable<Qualif>> GetAllAsync(string soccod)
        {
            return await _dbContext.Qualifs.Where(q => q.Soccod == soccod).ToListAsync();
        }

        public async Task<Dictionary<string, string>> GetQuaLibsAsync(string soccod)
        {
            try
            {
                var qualifs = await _dbContext.Qualifs
                    .Where(q => q.Soccod == soccod)
                    .ToListAsync();

                return qualifs.ToDictionary(q => q.Quacod, q => q.Qualib ?? q.Quacod);
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException($"Erreur lors de la récupération des qualifications pour la société {soccod}", ex);
            }
        }

        public async Task<Qualif?> GetByQuafcodAsync(string soccod, string quacod)
        {
            return await _dbContext.Qualifs.FirstOrDefaultAsync(q => q.Soccod == soccod && q.Quacod == quacod);
        }

        public async Task UpdateAsync(Qualif entity)
        {
            if (entity != null)
            {
                _dbContext.Qualifs.Update(entity);
                await _dbContext.SaveChangesAsync();
            }
        }
    }
}
