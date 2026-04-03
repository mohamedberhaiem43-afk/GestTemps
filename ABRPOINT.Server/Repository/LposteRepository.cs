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

        public void Add(Lposte entity)
        {
            throw new NotImplementedException();
        }

        public void Delete(Lposte entity)
        {
            throw new NotImplementedException();
        }
        
        public IEnumerable<Lposte> GetAll()
        {
            throw new NotImplementedException();
        }
         public IEnumerable<Lposte> GetLposte(string soccod,string codposte)
        {
            try
            {
                IEnumerable<Lposte> lposte = _dbContext.Lpostes
                    .Where(lp => lp.Soccod == soccod && lp.Codposte == codposte);
                
                return lposte;
            }
            catch (Exception ex)
            {

                throw;
            }
        }

        public void Update(Lposte entity)
        {
            throw new NotImplementedException();
        }
    }
}
