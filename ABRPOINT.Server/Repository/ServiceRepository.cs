using ABRPOINT.Server.Data;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace ABRPOINT.Server.Repository
{
    public class ServiceRepository : IServiceRepository
    {
        private readonly ApplicationDbContext _dbContext;
        public ServiceRepository(ApplicationDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        public async Task AddAsync(Service entity)
        {
            try
            {
                await _dbContext.Services.AddAsync(entity);
                await _dbContext.SaveChangesAsync();
            }
            catch (DbUpdateException ex)
            {
                // Postgres : SQLSTATE 23505 = unique_violation (équivalent SQL Server 2627/2601).
                // PostgresException.SqlState est la valeur 5-chars du standard SQL.
                if (ex.InnerException is PostgresException pgEx && pgEx.SqlState == "23505")
                {
                    throw new Exception("Le service avec ce code existe déjà. Veuillez utiliser un autre code..", ex);
                }
                throw;
            }
        }

        public async Task DeleteAsync(Service entity)
        {
            if (entity != null)
            {
                _dbContext.Services.Remove(entity);
                await _dbContext.SaveChangesAsync();
            }
        }

        public async Task<IEnumerable<Service>> GetAllAsync()
        {
            return await _dbContext.Services.ToListAsync();
        }

        public async Task<IEnumerable<Service>> GetAllAsync(string soccod)
        {
            return await _dbContext.Services.Where(d => d.Soccod == soccod).ToListAsync();
        }

        public async Task<Service?> GetBySercodAsync(string sercod, string soccod)
        {
            try
            {
                return await _dbContext.Services.FindAsync(sercod, soccod);
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<Dictionary<string, string>> GetServLibsAsync(string soccod)
        {
            try
            {
                return await _dbContext.Services
                    .Where(s => s.Soccod == soccod)
                    .ToDictionaryAsync(abs => abs.Sercod, abs => abs.Serlib ?? abs.Sercod);
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task UpdateAsync(Service entity)
        {
            if (entity == null) return;

            // Mise à jour par fusion : on charge la ligne existante (suivie) et on n'écrase
            // QUE les champs réellement fournis (non null). Avant, un Update(entity) global
            // remettait à null les colonnes absentes du payload — typiquement l'écran
            // OrgStructure n'envoie pas `effectif`, ce qui l'effaçait à chaque édition.
            // Charger l'entité existante évite aussi le conflit de tracking EF Core.
            var existing = await _dbContext.Services
                .FirstOrDefaultAsync(s => s.Sercod == entity.Sercod && s.Soccod == entity.Soccod);
            if (existing == null)
            {
                await _dbContext.Services.AddAsync(entity);
                await _dbContext.SaveChangesAsync();
                return;
            }

            if (entity.Serlib != null) existing.Serlib = entity.Serlib;
            if (entity.Serloc != null) existing.Serloc = entity.Serloc;
            if (entity.Effectif != null) existing.Effectif = entity.Effectif;
            await _dbContext.SaveChangesAsync();
        }
    }
}
