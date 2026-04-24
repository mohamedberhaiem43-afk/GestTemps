using ABRPOINT.Server.Data;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Repository
{
    public class CompenserRepository:IcompenserRepository
    {
        private readonly ApplicationDbContext _dbContext;
        public CompenserRepository(ApplicationDbContext dbContext)
        {
            _dbContext = dbContext;
        }
        public async Task AddAsync(Compenser compenser)
        {
            if (compenser == null)
                throw new ArgumentNullException("compenser doit pas etre null");
            try
            {
                await _dbContext.Compensers.AddAsync(compenser);
                await _dbContext.SaveChangesAsync();
            }
            catch (Exception ex)
            {

                throw new Exception("Erreur innatendu: "+ex);
            }
           
        }

        public async Task DeleteAsync(Compenser compenser)
        {
            if (compenser == null)
                throw new ArgumentNullException("Veuillez saisir les champs obligatoires");
            try
            {
                    _dbContext.Compensers.Remove(compenser);
                    await _dbContext.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                throw new Exception("Erreur innatendu: ",ex);
            }
            
        }

      


        public async Task<Compenser?> GetByNumOrdreAsync(string soccod, string ordre)
        {
            return await _dbContext.Compensers
                .Where(c=>c.Soccod == soccod)
                .FirstOrDefaultAsync(s => s.Concod == ordre);
        }

        public async Task UpdateAsync(Compenser compenser)
        {
            if (compenser != null)
            {
                _dbContext.Compensers.Update(compenser);
                await _dbContext.SaveChangesAsync();
            }
        }
        public async Task<List<Compenser>> GetCompenserWithAbsenceAsync(string soccod)
        {
            try
            {
                var result = await _dbContext.Compensers.Where(c => c.Soccod == soccod)
                                .ToListAsync();
                return result;
            }
            catch (Exception ex)
            {
                throw new Exception("Erreur innatendu: ",ex);
            }
            
        }
        public async Task<IEnumerable<Compenser>> GetAllAsync()
        {
            return await _dbContext.Compensers.ToListAsync();
        }

        
    }
}
