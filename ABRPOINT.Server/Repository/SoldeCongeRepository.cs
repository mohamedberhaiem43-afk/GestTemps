using ABRPOINT.Server.CalculService.Conge;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Repository
{
    public class SoldeCongeRepository:ISoldeCongeRepository
    {
        private readonly ApplicationDbContext _dbContext;
        private readonly ICongeCalculationService _congeCalculationService;

        public SoldeCongeRepository(ApplicationDbContext dbContext, ICongeCalculationService congeCalculationService)
        {
            _dbContext = dbContext;
            _congeCalculationService = congeCalculationService;
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

        public async Task<Solde> GetByEmpCalculatedAsync(string soccod, string empcod)
        {
            string year = DateTime.Now.Year.ToString();
            string month = DateTime.Now.Month.ToString("D2");

            var etat = await _congeCalculationService.GetEmpEtatCongeAsync(soccod, empcod, "01", month, year);

            return new Solde
            {
                Soccod = soccod,
                Empcod = empcod,
                Annee = year,
                Conge = (float?)etat.DroitConge,
                Empconge = (float?)etat.SoldeAnterieur
            };
        }
    }
}
