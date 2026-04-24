using ABRPOINT.Server.Data;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Repository
{
    public class VilleRepository : IVilleRepository
    {
        private readonly ApplicationDbContext _dbContext;
        public VilleRepository(ApplicationDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        public async Task AddAsync(Ville entity)
        {
            await _dbContext.Villes.AddAsync(entity);
            await _dbContext.SaveChangesAsync();
        }

        public async Task DeleteAsync(Ville entity)
        {
            if (entity != null)
            {
                _dbContext.Villes.Remove(entity);
                await _dbContext.SaveChangesAsync();
            }
        }

        public async Task<IEnumerable<Ville>> GetAllAsync()
        {
            return await _dbContext.Villes.ToListAsync();
        }

        public async Task<Ville?> GetByVilcodAsync(string vilcod)
        {
            return await _dbContext.Villes.FindAsync(vilcod);
        }

        public async Task<Dictionary<string, string>> GetVillibsAsync()
        {
            return await _dbContext.Villes.ToDictionaryAsync(v => v.Vilcod, v => v.Villib ?? "");
        }

        public async Task UpdateAsync(Ville entity)
        {
            if (entity != null)
            {
                _dbContext.Villes.Update(entity);
                await _dbContext.SaveChangesAsync();
            }
        }
    }
}
