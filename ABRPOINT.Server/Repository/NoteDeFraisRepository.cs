using ABRPOINT.Server.Data;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace ABRPOINT.Server.Repository
{
    public class NoteDeFraisRepository : INoteDeFraisRepository
    {
        private readonly ApplicationDbContext _context;

        public NoteDeFraisRepository(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<IEnumerable<NoteDeFrais>> GetAllBySoc(string soccod)
        {
            return await _context.NoteDeFrais
                .Where(n => n.Soccod == soccod)
                .OrderByDescending(n => n.DateDepense)
                .ToListAsync();
        }

        public async Task<IEnumerable<NoteDeFrais>> GetByEmp(string soccod, string empcod)
        {
            return await _context.NoteDeFrais
                .Where(n => n.Soccod == soccod && n.Empcod == empcod)
                .OrderByDescending(n => n.DateDepense)
                .ToListAsync();
        }

        public async Task<NoteDeFrais?> GetById(int id)
        {
            return await _context.NoteDeFrais.FindAsync(id);
        }

        public async Task AddAsync(NoteDeFrais notedefrais)
        {
            await _context.NoteDeFrais.AddAsync(notedefrais);
            await _context.SaveChangesAsync();
        }

        public async Task UpdateAsync(NoteDeFrais notedefrais)
        {
            _context.NoteDeFrais.Update(notedefrais);
            await _context.SaveChangesAsync();
        }

        public async Task DeleteAsync(int id)
        {
            var item = await _context.NoteDeFrais.FindAsync(id);
            if (item != null)
            {
                _context.NoteDeFrais.Remove(item);
                await _context.SaveChangesAsync();
            }
        }
    }
}
