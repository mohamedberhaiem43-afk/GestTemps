using ABRPOINT.Server.Data;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace ABRPOINT.Server.Repository
{
    public class SectionRepository : ISectionRepository
    {
        private readonly ApplicationDbContext _dbContext;
        public SectionRepository(ApplicationDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        public async Task AddAsync(Section entity)
        {
            try
            {
                await _dbContext.Sections.AddAsync(entity);
                await _dbContext.SaveChangesAsync();
            }
            catch (DbUpdateException ex)
            {
                // Postgres : SQLSTATE 23505 = unique_violation (équivalent SQL Server 2627).
                if (ex.InnerException is PostgresException pgEx && pgEx.SqlState == "23505")
                {
                    throw new Exception("Le section avec ce code existe déjà. Veuillez utiliser un autre code..", ex);
                }
                throw;
            }
        }

        public async Task DeleteAsync(Section entity)
        {
            if (entity != null)
            {
                _dbContext.Sections.Remove(entity);
                await _dbContext.SaveChangesAsync();
            }
        }

        public async Task<IEnumerable<Section>> GetAllAsync()
        {
            return await _dbContext.Sections.ToListAsync();
        }

        public async Task<IEnumerable<Section>> GetAllAsync(string soccod)
        {
            try
            {
                return await _dbContext.Sections
                .Where(sec => sec.Soccod == soccod)
                .ToListAsync();
            }
            catch (Exception ex)
            {
                throw new Exception("Error retrieving sections", ex);
            }
        }

        public async Task<Section?> GetBySeccodAsync(string seccod, string soccod)
        {
            return await _dbContext.Sections.FindAsync(seccod, soccod);
        }

        public async Task UpdateAsync(Section entity)
        {
            if (entity != null)
            {
                _dbContext.Sections.Update(entity);
                await _dbContext.SaveChangesAsync();
            }
        }

        public async Task<Dictionary<string, string>> GetSecLibsAsync(string soccod)
        {
            try
            {
                return await _dbContext.Sections
                    .Where(sec => sec.Soccod == soccod)
                    .ToDictionaryAsync(abs => abs.Seccod ?? string.Empty, abs => abs.Seclib ?? string.Empty);
            }
            catch (Exception ex)
            {
                throw new Exception("Erreur lors de la récupération des sections", ex);
            }
        }
    }
}
