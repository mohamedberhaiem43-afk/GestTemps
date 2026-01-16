using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Repository
{
    public class SocieteRepository : ISocieteRepository
    {
        private readonly ApplicationDbContext _dbContext;
        public SocieteRepository(ApplicationDbContext dbContext)
        {
            _dbContext = dbContext;
        }
        public void Add(Societe entity)
        {
            _dbContext.Societes.Add(entity);
            _dbContext.SaveChanges();
        }

        public void Delete(Societe entity)
        {
            if (entity != null)
            {
                _dbContext.Societes.Remove(entity);
                _dbContext.SaveChanges();
            }
        }

        public IEnumerable<Societe> GetAll()
        {
            return _dbContext.Societes.ToList();
        }
        public async Task<Dictionary<string,string>> GetSoclibs()
        {
            try
            {
                var societes = await _dbContext.Societes
                    .ToDictionaryAsync(soc => soc.Soccod.ToString(),soc => soc.Soclib.ToString());
                return societes;
            }
            catch (Exception ex)
            {
                throw new Exception("Erreur innatendu:",ex);
            }
        }

        public Societe GetBySoccod(string soccod)
        {
            return _dbContext.Societes.Find(soccod);
        }

        public void Update(Societe entity)
        {
            if (entity != null)
            {
                _dbContext.Societes.Update(entity);
                _dbContext.SaveChanges();
            }
        }

        public async Task<SocHeures?> GetSocHeures(string soccod)
        {
            try
            {
                return await _dbContext.Societes
                    .Where(s => s.Soccod == soccod)
                    .Select(s => new SocHeures
                    {
                        Sochsup = s.Sochsup,
                        Socpresence = s.Socpresence
                    })
                    .FirstOrDefaultAsync();
            }
            catch
            {
                throw;
            }
        }

        public async Task<bool> UpdateSocHeures(string soccod,string socpresence,string sochsup)
        {
            try
            {
                var rows = await _dbContext.Societes
                    .Where(s => s.Soccod == soccod)
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(s => s.Socpresence, socpresence)
                        .SetProperty(s => s.Sochsup, sochsup)
                    );

                return rows > 0;
            }
            catch
            {
                throw;
            }
        }
    }
}
