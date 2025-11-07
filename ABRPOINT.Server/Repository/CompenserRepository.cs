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
        public void Add(Compenser compenser)
        {
            if (compenser == null)
                throw new ArgumentNullException("compenser doit pas etre null");
            try
            {
                _dbContext.Compensers.Add(compenser);
                _dbContext.SaveChanges();
            }
            catch (Exception ex)
            {

                throw new Exception("Erreur innatendu: "+ex);
            }
           
        }

        public void Delete(Compenser compenser)
        {
            if (compenser == null)
                throw new ArgumentNullException("Veuillez saisir les champs obligatoires");
            try
            {
                    _dbContext.Compensers.Remove(compenser);
                    _dbContext.SaveChanges();
            }
            catch (Exception ex)
            {
                throw new Exception("Erreur innatendu: ",ex);
            }
            
        }

      


        public Compenser GetByNumOrdre(string soccod, string ordre)
        {
            return _dbContext.Compensers
                .Where(c=>c.Soccod == soccod)
                .FirstOrDefault(s => s.Concod == ordre);
        }

        public void Update(Compenser compenser)
        {
            if (compenser != null)
            {
                _dbContext.Compensers.Update(compenser);
                _dbContext.SaveChanges();
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
        public IEnumerable<Compenser> GetAll()
        {
            return _dbContext.Compensers.ToList();
        }

        
    }
}
