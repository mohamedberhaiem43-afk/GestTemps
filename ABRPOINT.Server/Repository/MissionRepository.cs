using ABRPOINT.Server.Data;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Repository
{
    public class MissionRepository : IMissionRepository
    {
        private readonly ApplicationDbContext _context;

        public MissionRepository(ApplicationDbContext context)
        {
            _context = context;
        }

        public Task<IEnumerable<Mission>> GetBySocAsync(string soccod)
            => _context.Missions
                .Where(m => m.Soccod == soccod)
                .OrderByDescending(m => m.Misdatedeb)
                .ToListAsync()
                .ContinueWith(t => (IEnumerable<Mission>)t.Result);

        public Task<IEnumerable<Mission>> GetByEmpAsync(string soccod, string empcod)
            => _context.Missions
                .Where(m => m.Soccod == soccod && m.Empcod == empcod)
                .OrderByDescending(m => m.Misdatedeb)
                .ToListAsync()
                .ContinueWith(t => (IEnumerable<Mission>)t.Result);

        public Task<Mission?> GetByIdAsync(int id)
            => _context.Missions.FirstOrDefaultAsync(m => m.Id == id);

        public async Task AddAsync(Mission mission)
        {
            mission.CreatedAt = DateTime.UtcNow;
            await _context.Missions.AddAsync(mission);
            await _context.SaveChangesAsync();
        }

        public async Task UpdateAsync(Mission mission)
        {
            _context.Missions.Update(mission);
            await _context.SaveChangesAsync();
        }

        public async Task DeleteAsync(int id)
        {
            var mission = await _context.Missions.FirstOrDefaultAsync(m => m.Id == id);
            if (mission == null) return;
            // Soft-delete via DeletedAt (BaseEntity), pour rester cohérent avec le filtre global.
            mission.DeletedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }

        /// <summary>
        /// Vérifie qu'un abscod correspond bien à une nature d'absence "Formation et mission"
        /// (Abscng = "6"). Source de vérité : table absence dans la base du tenant courant.
        /// </summary>
        public Task<bool> AbsenceCodeIsFormationMissionAsync(string soccod, string abscod)
            => _context.Absences
                .AsNoTracking()
                .AnyAsync(a => a.Soccod == soccod && a.Abscod == abscod && a.Abscng == "6");
    }
}
