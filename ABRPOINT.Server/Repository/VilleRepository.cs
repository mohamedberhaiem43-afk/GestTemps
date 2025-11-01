using ABRPOINT.Server.Data;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Repository
{
    public class VilleRepository:IVilleRepository
    {
        private readonly ApplicationDbContext _dbContext;
        public VilleRepository(ApplicationDbContext dbContext)
        {
            _dbContext = dbContext;
        }
        public void Add(Ville entity)
        {
            _dbContext.Villes.Add(entity);
            _dbContext.SaveChanges();
        }
        
        public void Delete(Ville entity)
        {
            if (entity != null)
            {
                _dbContext.Villes.Remove(entity);
                _dbContext.SaveChanges();
            }
        }

        public IEnumerable<Ville> GetAll()
        {
            return _dbContext.Villes.ToList();
        }

        public Ville GetByVilcod(string vilcod)
        {
            return _dbContext.Villes.Find(vilcod);
        }

        public Dictionary<string, string> GetVillibs()
        {
            return _dbContext.Villes.ToDictionary(v=>v.Vilcod,v=>v.Villib);
        }

        public void Update(Ville entity)
        {
            if (entity != null)
            {
                _dbContext.Villes.Update(entity);
                _dbContext.SaveChanges();
            }
        }
    }
}
