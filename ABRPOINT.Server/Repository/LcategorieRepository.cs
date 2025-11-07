using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Repository
{
    public class LcategorieRepository : ILcategorieRepository
    {
        private readonly ApplicationDbContext _dbContext;
        public LcategorieRepository(ApplicationDbContext dbContext)
        {
            _dbContext = dbContext;
        }
        public void Add(Lcategorie lcategorie)
        {
            _dbContext.Lcategories.Add(lcategorie);
            _dbContext.SaveChanges();
        }

        public void Delete(Lcategorie lcategorie)
        {
            if (lcategorie != null)
            {
                _dbContext.Lcategories.Remove(lcategorie);
                _dbContext.SaveChanges();
            }
        }

        public IEnumerable<LcategorieDto> Getlcat(string soccod, string catperiode)
        {
            try
            {
                var result = from lcat in _dbContext.Lcategories
                             join cat in _dbContext.Categories
                             on new { lcat.Catcod, lcat.Soccod } equals new { cat.Catcod, cat.Soccod }
                             where lcat.Soccod == soccod && cat.Catperiode == catperiode
                             select new LcategorieDto
                             {
                                 Ordre = lcat.Ordre,
                                 Soccod = lcat.Soccod,
                                 Catcod = lcat.Catcod,
                                 Codposte = lcat.Codposte,
                                 Catdu = lcat.Catdu,
                                 Catau = lcat.Catau,
                                 Catfixe = lcat.Catfixe,
                                 Cathsup = cat.Cathsup,  // Joining with the Categorie class to get Catlib
                                 Catlib = cat.Catlib,  // Joining with the Categorie class to get Catlib
                                 Catperiode = cat.Catperiode,  // Joining with the Categorie class to get Catperiode
                                 Catsem2 = cat.Catsem2,  // Joining with the Categorie class to get Catperiode
                                 Catsem3 = cat.Catsem3,  // Joining with the Categorie class to get Catperiode
                                 Catsem4 = cat.Catsem4,  // Joining with the Categorie class to get Catperiode
                                 Catsem5 = cat.Catsem5,  // Joining with the Categorie class to get Catperiode
                                 Catsem6 = cat.Catsem6,  // Joining with the Categorie class to get Catperiode
                             };
                if(result != null)
                    return result.ToList();
                return new List<LcategorieDto>();
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<IEnumerable<Categorie>> GetcatAsync(string soccod,string catcod)
        {
            try
            {
                var lcat = await _dbContext.Categories
                                             .Where(c =>c.Soccod ==soccod &&  c.Catcod == catcod)
                                             .ToListAsync();
                return lcat;
            }
            catch (Exception)
            {

                throw;
            }
        }
        public async Task<Lcategorie> GetByNumOrdre(string soccod, int ordre)
        {
            try
            {
                return await _dbContext.Lcategories.FirstOrDefaultAsync(s => s.Ordre == ordre && s.Soccod == soccod);
            }
            catch (Exception)
            {
                throw;
            }
        }

        public void Update(Lcategorie lcategorie)
        {
            if (lcategorie != null)
            {
                _dbContext.Lcategories.Update(lcategorie);
                _dbContext.SaveChanges();
            }
        }

        public IEnumerable<Lcategorie> GetAll()
        {
            return _dbContext.Lcategories.ToList();
        }

        public Dictionary<string, string> GetHorLibs(string soccod)
        {
            try
            {
                    return _dbContext.Categories
                    .Where(h => h.Soccod == soccod)
                    .ToDictionary(d => d.Catcod, d => d.Catlib);
            }
            catch (Exception ex)
            {

                throw new Exception("probleme ",ex);
            }
            
        }

        public async Task<string?> GetCathsup(string soccod,string empcod)
        {
            try
            {
                string? catcod = await _dbContext.Employes
                    .Where(e => e.Soccod == soccod && e.Empcod == empcod)
                    .Select(e => e.Catcod)
                    .SingleOrDefaultAsync();
                string? cathsup = await _dbContext.Categories
                    .Where(c => c.Soccod == soccod && c.Catcod == catcod)
                    .Select(c => c.Cathsup)
                    .SingleOrDefaultAsync();
                return cathsup;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task UpdateAsync(LcategorieDto lcategorie)
        {
            try
            {
                if (lcategorie == null)
                    throw new ArgumentNullException(nameof(lcategorie));

                // 2️⃣ Update Categories table
                await _dbContext.Categories
                    .Where(c => c.Soccod == lcategorie.Soccod && c.Catcod == lcategorie.Catcod)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(c => c.Catlib, lcategorie.Catlib)
                        .SetProperty(c => c.Cathsup, lcategorie.Cathsup)
                        .SetProperty(c => c.Catperiode, lcategorie.Catperiode)
                        .SetProperty(c => c.Catsem2, lcategorie.Catsem2)
                        .SetProperty(c => c.Catsem3, lcategorie.Catsem3)
                        .SetProperty(c => c.Catsem4, lcategorie.Catsem4)
                        .SetProperty(c => c.Catsem5, lcategorie.Catsem5)
                        .SetProperty(c => c.Catsem6, lcategorie.Catsem6)
                        .SetProperty(c => c.Catsem7, lcategorie.Catsem7)
                        .SetProperty(c => c.Catsem8, lcategorie.Catsem8)
                        .SetProperty(c => c.Catsem9, lcategorie.Catsem9)
                        .SetProperty(c => c.Catsem10, lcategorie.Catsem10)
                        .SetProperty(c => c.Catsem11, lcategorie.Catsem11)
                        .SetProperty(c => c.Catsem12, lcategorie.Catsem12)
                    );

                // 3️⃣ Update Lcategories table
                await _dbContext.Lcategories
                    .Where(l => l.Soccod == lcategorie.Soccod
                             && l.Catcod == lcategorie.Catcod
                             && l.Ordre == lcategorie.Ordre)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(l => l.Catdu, lcategorie.Catdu)
                        .SetProperty(l => l.Catau, lcategorie.Catau)
                        .SetProperty(l => l.Catfixe, lcategorie.Catfixe)
                        .SetProperty(l => l.Codposte, lcategorie.Codposte)
                    );
            }
            catch (Exception)
            {
                throw;
            }
        }


        public async Task AddAsync(LcategorieDto lcategorie)
        {
            try
            {
                if (lcategorie == null)
                    throw new ArgumentNullException(nameof(lcategorie));

                // 1️⃣ Auto-set Ordre if null or 0
                var maxOrdre = await _dbContext.Lcategories
                    .Where(l => l.Soccod == lcategorie.Soccod
                             && l.Catcod == lcategorie.Catcod
                             && l.Codposte == lcategorie.Codposte)
                    .MaxAsync(l => (int?)l.Ordre) ?? 0;

                lcategorie.Ordre = maxOrdre + 1;

                // 2️⃣ Create and map Categorie
                var cat = new Categorie
                {
                    Soccod = lcategorie.Soccod,
                    Catcod = lcategorie.Catcod,
                    Catlib = lcategorie.Catlib,
                    Cathsup = lcategorie.Cathsup,
                    Catperiode = lcategorie.Catperiode,
                    Catsem2 = lcategorie.Catsem2,
                    Catsem3 = lcategorie.Catsem3,
                    Catsem4 = lcategorie.Catsem4,
                    Catsem5 = lcategorie.Catsem5,
                    Catsem6 = lcategorie.Catsem6,
                    Catsem7 = lcategorie.Catsem7,
                    Catsem8 = lcategorie.Catsem8,
                    Catsem9 = lcategorie.Catsem9,
                    Catsem10 = lcategorie.Catsem10,
                    Catsem11 = lcategorie.Catsem11,
                    Catsem12 = lcategorie.Catsem12,
                };

                // 3️⃣ Create and map Lcategorie
                var lcat = new Lcategorie
                {
                    Soccod = lcategorie.Soccod,
                    Catcod = lcategorie.Catcod,
                    Codposte = lcategorie.Codposte,
                    Catdu = lcategorie.Catdu,
                    Catau = lcategorie.Catau,
                    Catfixe = lcategorie.Catfixe,
                    Ordre = lcategorie.Ordre
                };

                // 4️⃣ Add to DbContext
                await _dbContext.Categories.AddAsync(cat);
                await _dbContext.Lcategories.AddAsync(lcat);

                // 5️⃣ Save changes
                await _dbContext.SaveChangesAsync();
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task DeleteAsync(LcategorieDto lcategorie)
        {
            try
            {
                if(lcategorie != null)
                {
                    Lcategorie? lcat = await _dbContext.Lcategories.FirstOrDefaultAsync(lcat=>lcat.Soccod == lcategorie.Soccod
                     && lcat.Catcod == lcategorie.Catcod && lcat.Ordre == lcategorie.Ordre);
                    if(lcat != null)
                        _dbContext.Lcategories.Remove(lcat);
                    Categorie? dbcat = await _dbContext.Categories
                        .FirstOrDefaultAsync(cat => cat.Catcod == lcategorie.Catcod && cat.Soccod == lcategorie.Soccod);
                    if (dbcat != null)
                        _dbContext.Categories.Remove(dbcat);
                }
                await _dbContext.SaveChangesAsync();
            }
            catch (Exception)
            {
                throw;
            }
        }
    }
}
