using ABRPOINT.Server.Data;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Repository
{
    public class DmpointService : IDmpointService
    {
        private readonly ApplicationDbContext _dbContext;
        public DmpointService(ApplicationDbContext dbContext)
        {
            _dbContext = dbContext;
        }
        public void Add(Dmpoint entity)
        {
            throw new NotImplementedException();
        }
        public async Task AddAsync(Presence presence, DateTime date, string poicod)
        {
            try
            {
                // Calculer validDmdate
                DateTime validDmdate = presence.Dmdate.HasValue ? presence.Dmdate.Value : DateTime.Now.Date;
                if (validDmdate < new DateTime(1753, 1, 1))
                {
                    validDmdate = DateTime.Now.Date;
                }

                // Valider également le paramètre 'date' pour Dmhre
                DateTime validDmhre = date;
                if (date < new DateTime(1753, 1, 1) || date > new DateTime(9999, 12, 31))
                {
                    validDmhre = DateTime.Now;
                }

                // Calculer maxOrdre
                int maxOrdre = await _dbContext.Dmpoints
                    .Where(dm => dm.Empcod == presence.Empcod &&
                                 dm.Soccod == presence.Soccod &&
                                 dm.Dmdat == validDmdate)
                    .Select(dm => (int?)dm.Ordre)
                    .MaxAsync() ?? 0;

                // Vérifier si l'enregistrement existe
                bool isExisting = await _dbContext.Dmpoints.AnyAsync(d =>
                    d.Soccod == presence.Soccod &&
                    d.Empcod == presence.Empcod &&
                    d.Dmdat == validDmdate &&
                    d.Ordre == maxOrdre);

                if (!isExisting)
                {
                    Dmpoint dmpoint = new Dmpoint()
                    {
                        Soccod = presence.Soccod,
                        Empcod = presence.Empcod,
                        Dmdat = validDmdate,
                        Ordre = maxOrdre + 1,
                        Dmhre = validDmhre,  // Utiliser la valeur validée
                        Dmpnt = poicod,
                        Dmlue = "1",
                        Dmtype = "E",
                    };

                    await _dbContext.Dmpoints.AddAsync(dmpoint);
                    await _dbContext.SaveChangesAsync();
                }
            }
            catch (Exception)
            {
                throw;
            }
        }
        public void Delete(Dmpoint entity)
        {
            throw new NotImplementedException();
        }

        public IEnumerable<Dmpoint> GetAll()
        {
            throw new NotImplementedException();
        }

        public async Task<string?> GetPoicod(string soccod, string empcod, DateTime? dmdate)
        {
            try
            {
                string? poicod = await _dbContext.Dmpoints
                    .Where(d => d.Soccod == soccod && d.Empcod == empcod && d.Dmdat == dmdate)
                    .OrderByDescending(d => d.Ordre) // Pour obtenir le dernier pointage
                    .Select(d => d.Dmpnt)
                    .FirstOrDefaultAsync();
                return poicod;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<Dictionary<(string Empcod, DateTime Date), string?>> GetPoicodBatch(string soccod, string empcod, DateTime dateDeb, DateTime dateFin)
        {
            var points = await _dbContext.Dmpoints
                .Where(d => d.Soccod == soccod
                            && d.Empcod == empcod
                            && d.Dmdat >= dateDeb && d.Dmdat <= dateFin)
                .OrderByDescending(d => d.Ordre)
                .ToListAsync();

            return points
                .GroupBy(d => (d.Empcod, d.Dmdat.Value.Date))
                .ToDictionary(g => g.Key, g => g.First().Dmpnt);
        }

        public void Update(Dmpoint entity)
        {
            throw new NotImplementedException();
        }
    }
}
