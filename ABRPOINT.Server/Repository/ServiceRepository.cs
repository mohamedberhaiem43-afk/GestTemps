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
        public void Add(Service entity)
        {
            try
            {
                _dbContext.Services.Add(entity);
                _dbContext.SaveChanges();
            }
            catch (DbUpdateException ex)
            {
                // Check if the exception is caused by a duplicate primary key
                if (ex.InnerException is SqlException sqlEx && sqlEx.Number == 2627) // 2627 is the SQL error code for PK violation
                {
                    // You can log the error if needed
                    throw new Exception("Le service avec ce code existe déjà. Veuillez utiliser un autre code..", ex);
                }

                throw; // Re-throw if it's not a PK violation or if you want to handle other exceptions as well
            }
        }

        public void Delete(Service entity)
        {
            if(entity != null)
            {
                _dbContext.Services.Remove(entity);
                _dbContext.SaveChanges();
            }
        }

        public IEnumerable<Service> GetAll()
        {
            return _dbContext.Services.ToList();
        }
        public IEnumerable<Service> GetAll(string soccod)
        {
            return _dbContext.Services.Where(d => d.Soccod == soccod).ToList();
        }

        public async Task<Service> GetBySercod(string sercod,string soccod)
        {
            try
            {
                var service = await _dbContext.Services.FindAsync(sercod,soccod);
                return service;
            }
            catch (Exception)
            {
                throw;
            }
        }

      
        public async Task<Dictionary<string, string>> GetServLibs(string soccod)
        {
            try
            {
                var services = await _dbContext.Services
                    .Where(s=>s.Soccod == soccod)
                                   .ToDictionaryAsync(abs => abs.Sercod, abs => abs.Serlib);
                return services;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public void Update(Service entity)
        {
            if(entity != null)
            {
                _dbContext.Services.Update(entity);
                _dbContext.SaveChanges();
            }
        }
              
    }
}
