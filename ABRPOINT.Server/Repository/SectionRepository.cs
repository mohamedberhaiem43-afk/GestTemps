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
            // AsNoTracking : ce read sert surtout aux contrôles d'existence (PUT/DELETE).
            // Avec FindAsync (tracké), le PUT chargeait l'entité puis appelait Update() sur une
            // seconde instance de même clé → conflit de tracking EF Core → 500. Le Where explicite
            // lève aussi toute ambiguïté sur l'ordre de la clé composite {Seccod, Soccod}.
            return await _dbContext.Sections
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.Seccod == seccod && s.Soccod == soccod);
        }

        public async Task UpdateAsync(Section entity)
        {
            if (entity == null) return;

            // Mise à jour par fusion : on ne remplace que les champs fournis (non null) sur la
            // ligne existante. Avant, Update(entity) global effaçait `sectype`/`effectif` quand
            // l'écran OrgStructure n'éditait que le libellé. Charger l'existant évite aussi le
            // conflit de tracking EF Core (cf. GetBySeccodAsync passé en AsNoTracking).
            var existing = await _dbContext.Sections
                .FirstOrDefaultAsync(s => s.Seccod == entity.Seccod && s.Soccod == entity.Soccod);
            if (existing == null)
            {
                await _dbContext.Sections.AddAsync(entity);
                await _dbContext.SaveChangesAsync();
                return;
            }

            if (entity.Seclib != null) existing.Seclib = entity.Seclib;
            if (entity.Sectype != null) existing.Sectype = entity.Sectype;
            if (entity.Secemail != null) existing.Secemail = entity.Secemail;
            if (entity.Effectif != null) existing.Effectif = entity.Effectif;
            await _dbContext.SaveChangesAsync();
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
