using ABRPOINT.Server.Data;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Repository
{
    public class FonctionRepository : IFonctionRepository
    {
        private readonly ApplicationDbContext _dbContext;
        public FonctionRepository(ApplicationDbContext dbContext)
        {
            _dbContext = dbContext;
        }
        public void Add(Fonction fonction)
        {
            try
            {
                _dbContext.Fonctions.Add(fonction);
                _dbContext.SaveChanges();
            }
            catch (Exception)
            {
                throw;
            }
        }

        public void Delete(Fonction fonction)
        {
            if (fonction != null)
            {
                _dbContext.Fonctions.Remove(fonction);
                _dbContext.SaveChanges();
            }
        }

        public IEnumerable<Fonction> GetAll()
        {
            return _dbContext.Fonctions.ToList();
        }
        public Dictionary<string, string> GetFonLibs()
        {
            return _dbContext.Fonctions
                               .ToDictionary(abs => abs.Foncod, abs => abs.Fonlib);
        }

        public Fonction GetByFonccod(string soccod, string fonccod)
        {
            return _dbContext.Fonctions.FirstOrDefault(s => s.Soccod == soccod && s.Foncod == fonccod);
        }

        public void Update(Fonction fonction)
        {
            if (fonction != null)
            {
                _dbContext.Fonctions.Update(fonction);
                _dbContext.SaveChanges();
            }
        }

        public IEnumerable<Fonction> GetAll(string soccod)
        {
            try
            {
                IEnumerable<Fonction> fonctions = _dbContext.Fonctions
                    .Where(f => f.Soccod == soccod)
                    .ToList();
                return fonctions;
            }
            catch (Exception ex)
            {

                throw new Exception("",ex);
            }
        }
    }
}
