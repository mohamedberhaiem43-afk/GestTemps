using ABRPOINT.Server.Data;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Repository
{
    public class DirectionRepository : IDirectionRepository
    {
        private readonly ApplicationDbContext _dbContext;
        public DirectionRepository(ApplicationDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        public async Task AddAsync(Direction entity)
        {
            try
            {
                if (entity != null)
                {
                    await _dbContext.AddAsync(entity);
                    await _dbContext.SaveChangesAsync();
                }
            }
            catch (Exception ex)
            {
                throw new Exception("An error occurred while adding direction", ex);
            }
        }

        public async Task DeleteAsync(Direction entity)
        {
            try
            {
                if (entity != null)
                {
                    _dbContext.Directions.Remove(entity);
                    await _dbContext.SaveChangesAsync();
                }
            }
            catch (Exception ex)
            {
                throw new Exception("An error occurred while deleting direction", ex);
            }
        }

        public async Task<Direction?> GetAsync(string soccod, string dircod)
        {
            try
            {
                return await _dbContext.Directions
                              .Where(d => d.Soccod == soccod && d.Dircod == dircod)
                              .SingleOrDefaultAsync();
            }
            catch (Exception ex)
            {
                throw new Exception("An error occurred while getting direction", ex);
            }
        }

        public async Task<IEnumerable<Direction>> GetAllAsync()
        {
            try
            {
                return await _dbContext.Directions.ToListAsync();
            }
            catch (Exception ex)
            {
                throw new Exception("An error occurred while getting directions list", ex);
            }
        }

        public async Task<IEnumerable<Direction>> GetAllAsync(string soccod)
        {
            return await _dbContext.Directions.Where(d => d.Soccod == soccod).ToListAsync();
        }

        public async Task<Dictionary<string, string>> GetDirLibsAsync(string soccod)
        {
            try
            {
                return await _dbContext.Directions
                    .Where(d => d.Soccod == soccod)
                    .ToDictionaryAsync(d => d.Dircod, d => d.Dirlib ?? "");
            }
            catch (Exception ex)
            {
                throw new Exception("An error occurred while getting directions libs", ex);
            }
        }

        public async Task UpdateAsync(Direction entity)
        {
            try
            {
                if (entity == null) return;

                // Mise à jour par fusion : on ne remplace que les champs fournis (non null).
                // Avant, Update(entity) global effaçait `dirtitre`/`dirresp`/`dirrespar` quand
                // l'écran OrgStructure n'envoyait que libellé/localisation/email. Charger
                // l'existant évite aussi tout conflit de tracking EF Core.
                var existing = await _dbContext.Directions
                    .FirstOrDefaultAsync(d => d.Dircod == entity.Dircod && d.Soccod == entity.Soccod);
                if (existing == null)
                {
                    await _dbContext.Directions.AddAsync(entity);
                    await _dbContext.SaveChangesAsync();
                    return;
                }

                if (entity.Dirlib != null) existing.Dirlib = entity.Dirlib;
                if (entity.Dirloc != null) existing.Dirloc = entity.Dirloc;
                if (entity.Dirtitre != null) existing.Dirtitre = entity.Dirtitre;
                if (entity.Dirresp != null) existing.Dirresp = entity.Dirresp;
                if (entity.Dirrespar != null) existing.Dirrespar = entity.Dirrespar;
                if (entity.Diremail != null) existing.Diremail = entity.Diremail;
                await _dbContext.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                throw new Exception("An error occurred while updating direction", ex);
            }
        }
    }
}
