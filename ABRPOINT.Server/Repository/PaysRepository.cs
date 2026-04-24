using ABRPOINT.Server.Data;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Repository
{
    public class PaysRepository : IPaysRepoistory
    {
        private readonly ApplicationDbContext _dbContext;
        public PaysRepository(ApplicationDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        public async Task AddAsync(Nation entity)
        {
            try
            {
                await _dbContext.Nations.AddAsync(entity);
                await _dbContext.SaveChangesAsync();
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task DeleteAsync(Nation entity)
        {
            if (entity != null)
            {
                _dbContext.Nations.Remove(entity);
                await _dbContext.SaveChangesAsync();
            }
        }

        public async Task<IEnumerable<Nation>> GetAllAsync()
        {
            return await _dbContext.Nations.ToListAsync();
        }

        public async Task<Nation?> GetByNatcodAsync(string natcod)
        {
            return await _dbContext.Nations.FindAsync(natcod);
        }

        public async Task<Dictionary<string, string>> GetNatlibsAsync()
        {
            return await _dbContext.Nations.ToDictionaryAsync(n => n.Natcod ?? "", n => n.Natlib ?? "");
        }

        public async Task UpdateAsync(Nation entity)
        {
            if (entity != null)
            {
                _dbContext.Nations.Update(entity);
                await _dbContext.SaveChangesAsync();
            }
        }

    }
}
