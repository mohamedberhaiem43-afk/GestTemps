using ABRPOINT.Server.Data;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Repository
{
    public class SoldeCongeRepository:ISoldeCongeRepository
    {

        private readonly ApplicationDbContext _dbContext;
        public SoldeCongeRepository(ApplicationDbContext dbContext)
        {
            _dbContext = dbContext;
        }
        public void Add(Solde solde)
        {
            _dbContext.Soldes.Add(solde);
            _dbContext.SaveChanges();
        }

        public void Delete(Solde solde)
        {
            if (solde != null)
            {
                _dbContext.Soldes.Remove(solde);
                _dbContext.SaveChanges();
            }
        }

        public IEnumerable<Solde> GetAll()
        {
            return _dbContext.Soldes.ToList();
        }

        public Solde GetByEmpcod(string soccod, string empcod)
        {
            return _dbContext.Soldes.FirstOrDefault(s => s.Soccod == soccod && s.Empcod == empcod);
        }

        public void Update(Solde solde)
        {
            if (solde != null)
            {
                _dbContext.Soldes.Update(solde);
                _dbContext.SaveChanges();
            }
        }
    }
}
