using ABRPOINT.Server.Data;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Repository
{
    public class SectionRepository : ISectionRepository
    {
        private readonly ApplicationDbContext _dbContext;
        public SectionRepository(ApplicationDbContext dbContext)
        {
            _dbContext = dbContext;
        }
        public void Add(Section entity)
        {
            try
            {
                _dbContext.Sections.Add(entity);
                _dbContext.SaveChanges();
            }
            catch (DbUpdateException ex)
            {
                // Check if the exception is caused by a duplicate primary key
                if (ex.InnerException is SqlException sqlEx && sqlEx.Number == 2627) // 2627 is the SQL error code for PK violation
                {
                    // You can log the error if needed
                    throw new Exception("Le section avec ce code existe déjà. Veuillez utiliser un autre code..", ex);
                }

                throw; // Re-throw if it's not a PK violation or if you want to handle other exceptions as well
            }
        }

        public void Delete(Section entity)
        {
            if (entity != null)
            {
                _dbContext.Sections.Remove(entity);
                _dbContext.SaveChanges();
            }
        }

        public IEnumerable<Section> GetAll(string soccod)
        {
            try
            {
                return _dbContext.Sections
                .Where(sec => sec.Soccod == soccod)
                .ToList();
            }
            catch (Exception ex)
            {

                throw new Exception("",ex);
            }
            
        }
        public Dictionary<string, string> GetSecLibs()
        {
            return _dbContext.Sections
                               .ToDictionary(abs => abs.Seccod, abs => abs.Seclib);
        }
        public Section GetBySeccod(string seccod, string soccod)
        {
            return _dbContext.Sections.Find(seccod, soccod);
        }

        public void Update(Section entity)
        {
            if (entity != null)
            {
                _dbContext.Sections.Update(entity);
                _dbContext.SaveChanges();
            }
        }

        public Dictionary<string, string> GetSecLibs(string soccod)
        {
            try
            {
                return _dbContext.Sections
                    .Where(sec => sec.Soccod == soccod)
                    .ToDictionary(abs => abs.Seccod ?? string.Empty, abs => abs.Seclib ?? string.Empty);
            }
            catch (Exception ex)
            {
                throw new Exception("Erreur lors de la récupération des sections", ex);
            }
        }

        public IEnumerable<Section> GetAll()
        {
            throw new NotImplementedException();
        }
    }
}
