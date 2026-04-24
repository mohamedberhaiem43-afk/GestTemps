using ABRPOINT.Server.Data;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Repository
{
    public class LposteRepository : IlposteRepository
    {
        private readonly ApplicationDbContext _dbContext;

        // Inject the DbContext via constructor
        public LposteRepository(ApplicationDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        public async Task AddAsync(Lposte entity)
        {
            await _dbContext.Lpostes.AddAsync(entity);
            await _dbContext.SaveChangesAsync();
        }

        public async Task DeleteAsync(Lposte entity)
        {
            if (entity != null)
            {
                _dbContext.Lpostes.Remove(entity);
                await _dbContext.SaveChangesAsync();
            }
        }
        
        public async Task<IEnumerable<Lposte>> GetAllAsync()
        {
            return await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.ToListAsync(_dbContext.Lpostes);
        }
         public async Task<IEnumerable<Lposte>> GetLposteAsync(string soccod,string codposte)
        {
            try
            {
                IEnumerable<Lposte> lposte = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.ToListAsync(_dbContext.Lpostes
                    .Where(lp => lp.Soccod == soccod && lp.Codposte == codposte));
                
                return lposte;
            }
            catch (Exception ex)
            {

                throw;
            }
        }

        public async Task UpdateAsync(Lposte entity)
        {
            if (entity != null)
            {
                _dbContext.Lpostes.Update(entity);
                await _dbContext.SaveChangesAsync();
            }
        }
    }
}
