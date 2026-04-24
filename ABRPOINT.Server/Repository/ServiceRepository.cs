using ABRPOINT.Server.Data;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Repository
{
    public class ServiceRepository : IServiceRepository
    {
        private readonly ApplicationDbContext _dbContext;
        public ServiceRepository(ApplicationDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        public async Task AddAsync(Service entity)
        {
            try
            {
                await _dbContext.Services.AddAsync(entity);
                await _dbContext.SaveChangesAsync();
            }
            catch (DbUpdateException ex)
            {
                if (ex.InnerException is SqlException sqlEx && sqlEx.Number == 2627)
                {
                    throw new Exception("Le service avec ce code existe déjà. Veuillez utiliser un autre code..", ex);
                }
                throw;
            }
        }

        public async Task DeleteAsync(Service entity)
        {
            if (entity != null)
            {
                _dbContext.Services.Remove(entity);
                await _dbContext.SaveChangesAsync();
            }
        }

        public async Task<IEnumerable<Service>> GetAllAsync()
        {
            return await _dbContext.Services.ToListAsync();
        }

        public async Task<IEnumerable<Service>> GetAllAsync(string soccod)
        {
            return await _dbContext.Services.Where(d => d.Soccod == soccod).ToListAsync();
        }

        public async Task<Service?> GetBySercodAsync(string sercod, string soccod)
        {
            try
            {
                return await _dbContext.Services.FindAsync(sercod, soccod);
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<Dictionary<string, string>> GetServLibsAsync(string soccod)
        {
            try
            {
                return await _dbContext.Services
                    .Where(s => s.Soccod == soccod)
                    .ToDictionaryAsync(abs => abs.Sercod, abs => abs.Serlib ?? abs.Sercod);
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task UpdateAsync(Service entity)
        {
            if (entity != null)
            {
                _dbContext.Services.Update(entity);
                await _dbContext.SaveChangesAsync();
            }
        }
    }
}
