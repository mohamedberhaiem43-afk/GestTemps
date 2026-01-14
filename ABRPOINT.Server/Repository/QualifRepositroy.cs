using ABRPOINT.Server.Data;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Repository
{
    public class QualifRepositroy : IQualifRepository
    {
        private readonly ApplicationDbContext _dbContext;
        public QualifRepositroy(ApplicationDbContext dbContext)
        {
            _dbContext = dbContext;
        }
        public void Add(Qualif entity)
        {
            _dbContext.Qualifs.Add(entity);
            _dbContext.SaveChanges();
        }

        public void Delete(Qualif entity)
        {
            if (entity != null)
            {
                _dbContext.Qualifs.Remove(entity);
                _dbContext.SaveChanges();
            }
        }

        public IEnumerable<Qualif> GetAll()
        {
            return _dbContext.Qualifs.ToList();
        }

        public Dictionary<string, string> GetQuaLibs(string soccod)
        {
            try
            {
                return _dbContext.Qualifs
                    .Where(q=>q.Soccod == soccod)
                                   .ToDictionary(abs => abs.Quacod, abs => abs.Qualib);
            }
            catch (Exception)
            {
                throw;
            }
        }

        public Qualif GetByQuafcod(string quacod)
        {
            return _dbContext.Qualifs.Where(q=>q.Quacod == quacod).SingleOrDefault();
        }

        public void Update(Qualif entity)
        {
            if (entity != null)
            {
                _dbContext.Qualifs.Update(entity);
                _dbContext.SaveChanges();
            }
        }

    }
}
