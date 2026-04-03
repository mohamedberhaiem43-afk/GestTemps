using ABRPOINT.Server.Data;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Repository
{
    public class PaysRepository : IPaysRepoistory
    {
        private readonly ApplicationDbContext _dbContext;
        public PaysRepository(ApplicationDbContext dbContext)
        {
            _dbContext = dbContext;
        }
        public void Add(Nation entity)
        {
            _dbContext.Nations.Add(entity);
            _dbContext.SaveChanges();
        }

        public void Delete(Nation entity)
        {
            if (entity != null)
            {
                _dbContext.Nations.Remove(entity);
                _dbContext.SaveChanges();
            }
        }

        public IEnumerable<Nation> GetAll()
        {
            return _dbContext.Nations.ToList();
        }

        

        public Nation GetByNatcod(string natcod)
        {
            return _dbContext.Nations.Find(natcod);
        }

        public Dictionary<string, string> GetNatlibs()
        {
            return _dbContext.Nations.ToDictionary(n=>n.Natcod,n=>n.Natlib);
        }

        public void Update(Nation entity)
        {
            if (entity != null)
            {
                _dbContext.Nations.Update(entity);
                _dbContext.SaveChanges();
            }
        }

    }
}
