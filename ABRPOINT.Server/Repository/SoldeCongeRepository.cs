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
        public async Task AddAsync(Solde solde)
        {
            await _dbContext.Soldes.AddAsync(solde);
            await _dbContext.SaveChangesAsync();
        }

        public async Task DeleteAsync(Solde solde)
        {
            if (solde != null)
            {
                _dbContext.Soldes.Remove(solde);
                await _dbContext.SaveChangesAsync();
            }
        }

        public async Task<IEnumerable<Solde>> GetAllAsync()
        {
            return await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.ToListAsync(_dbContext.Soldes);
        }

        public async Task<Solde?> GetByEmpcodAsync(string soccod, string empcod)
        {
            return await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstOrDefaultAsync(_dbContext.Soldes, s => s.Soccod == soccod && s.Empcod == empcod);
        }

        public async Task UpdateAsync(Solde solde)
        {
            if (solde != null)
            {
                _dbContext.Soldes.Update(solde);
                await _dbContext.SaveChangesAsync();
            }
        }

        public async Task<Solde?> GetByEmpCalculatedAsync(string soccod, string empcod)
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
