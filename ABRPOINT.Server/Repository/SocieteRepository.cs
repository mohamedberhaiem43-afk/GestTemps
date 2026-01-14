using ABRPOINT.Server.Data;
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
    }
}
