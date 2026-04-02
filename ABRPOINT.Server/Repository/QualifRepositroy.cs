using ABRPOINT.Server.Data;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.EntityFrameworkCore;

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
                var qualifs = _dbContext.Qualifs
                    .Where(q => q.Soccod == soccod)
                    .ToList();
                
                if (qualifs == null || qualifs.Count == 0)
                {
                    return new Dictionary<string, string>();
                }
                
                return qualifs.ToDictionary(q => q.Quacod, q => q.Qualib ?? q.Quacod);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error in GetQuaLibs: {ex.Message}");
                throw new InvalidOperationException($"Erreur lors de la récupération des qualifications pour la société {soccod}", ex);
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

        public async Task<IEnumerable<Qualif>> GetAllAsync(string soccod)
        {
            try
            {
                var qualifs = await _dbContext.Qualifs.Where(q => q.Soccod == soccod).ToListAsync();
                return qualifs;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<bool> UpdateAsync(Qualif qualif)
        {
            try
            {
                var rowsAffected = await _dbContext.Qualifs
               .Where(s => s.Soccod == qualif.Soccod && s.Quacod == qualif.Quacod)
               .ExecuteUpdateAsync(setters => setters
                   .SetProperty(s => s.Qualib, qualif.Qualib)
                   .SetProperty(s => s.Catcod, qualif.Catcod)
               );

                return rowsAffected > 0;
            }
            catch (Exception)
            {
                throw;
            }
        }
    }
}
