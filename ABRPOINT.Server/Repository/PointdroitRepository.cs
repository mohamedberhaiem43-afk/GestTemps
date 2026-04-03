using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Repository
{
    public class PointdroitRepository : IPointdroitRepository
    {
        private readonly ApplicationDbContext _dbContext;
        public PointdroitRepository(ApplicationDbContext dbContext)
        {
            _dbContext = dbContext;
        }
        public async Task<List<PointdroitDto?>> GetPointdroit(string soccod, string uticod)
        {
            try
            {
                var pointeuses = await _dbContext.Pointeuses
                    .Where(p => p.Soccod == soccod)
                    .ToListAsync();

                if (pointeuses == null || !pointeuses.Any())
                    return new List<PointdroitDto?>();

                var pointdroits = await _dbContext.Pointdroits
                    .Where(p => p.Soccod == soccod && p.Uticod == uticod)
                    .ToListAsync();

                // ✅ Left join manually: include all pointeuses, even if no matching pointdroit
                var result = pointeuses
                    .Select(p =>
                    {
                        var droit = pointdroits.FirstOrDefault(d => d.Poicod == p.Poicod);
                        return new PointdroitDto
                        {
                            Poicod = p.Poicod,
                            Poilib = p.Poilib,
                            Soccod = soccod,
                            Uticod = uticod,
                            Purger = droit?.Purger,
                            Lire = droit?.Lire,
                            Config = droit?.Config
                        };
                    })
                    .ToList();

                return result;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<bool> UpdatePointdroit(List<Pointdroit> pointdroits)
        {
            try
            {
                if (pointdroits == null || !pointdroits.Any())
                    return false;

                // Get all existing records that match the composite keys
                var soccod = pointdroits.First().Soccod;
                var uticod = pointdroits.First().Uticod;

                var existingRecords = await _dbContext.Pointdroits
                    .Where(p => p.Soccod == soccod && p.Uticod == uticod)
                    .ToListAsync();

                foreach (var droit in pointdroits)
                {
                    var existing = existingRecords.FirstOrDefault(p =>
                        p.Poicod == droit.Poicod &&
                        p.Soccod == droit.Soccod &&
                        p.Uticod == droit.Uticod);

                    if (existing != null)
                    {
                        // ✅ Update existing record
                        existing.Lire = droit.Lire;
                        existing.Config = droit.Config;
                        existing.Purger = droit.Purger;
                    }
                    else
                    {
                        // ✅ Insert new record
                        await _dbContext.Pointdroits.AddAsync(droit);
                    }
                }

                var result = await _dbContext.SaveChangesAsync();
                return result > 0;
            }
            catch (Exception ex)
            {
                // Optional: log the exception message
                throw;
            }
        }


    }
}
