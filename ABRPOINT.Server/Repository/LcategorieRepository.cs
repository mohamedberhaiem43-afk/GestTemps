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
        public async Task AddAsync(Lcategorie lcategorie)
        {
            await _dbContext.Lcategories.AddAsync(lcategorie);
            await _dbContext.SaveChangesAsync();
        }

        public async Task DeleteAsync(Lcategorie lcategorie)
        {
            if (lcategorie != null)
            {
                _dbContext.Lcategories.Remove(lcategorie);
                await _dbContext.SaveChangesAsync();
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

        public async Task UpdateAsync(Lcategorie lcategorie)
        {
            if (lcategorie != null)
            {
                _dbContext.Lcategories.Update(lcategorie);
                await _dbContext.SaveChangesAsync();
            }
        }

        public async Task<IEnumerable<Lcategorie>> GetAllAsync()
        {
            return await _dbContext.Lcategories.ToListAsync();
        }

        public async Task<Dictionary<string, string>> GetHorLibs(string soccod)
        {
            try
            {
                var today = DateTime.Today;
                return await _dbContext.Categories
                    .Where(c => c.Soccod == soccod)
                    .Join(
                        _dbContext.Lcategories,
                        c => c.Catcod,
                        lc => lc.Catcod,
                        (c, lc) => new { c, lc }
                    )
                    .Where(x => x.lc.Catfixe == "1"
                             || (today >= x.lc.Catdu && today <= x.lc.Catau))
                    .Select(x => new { x.c.Catcod, x.c.Catlib })
                    .Distinct()                                        // ✅ remove duplicates
                    .ToDictionaryAsync(x => x.Catcod, x => x.Catlib);
            }
            catch (Exception ex)
            {
                throw new Exception("probleme ", ex);
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

                // 4️⃣ Update Employes table (as requested by user)
                await _dbContext.Employes
                    .Where(e => e.Soccod == lcategorie.Soccod && e.Catcod == lcategorie.Catcod)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(e => e.Poscod, lcategorie.Codposte)
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

                // 1️⃣ Catégorie : upsert. Si la classe existe déjà (cas "ajout d'une période"),
                // on met à jour ses métadonnées sans la dupliquer (la PK (Soccod, Catcod) sauterait).
                var existingCat = await _dbContext.Categories
                    .FirstOrDefaultAsync(c => c.Soccod == lcategorie.Soccod && c.Catcod == lcategorie.Catcod);

                if (existingCat == null)
                {
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
                    await _dbContext.Categories.AddAsync(cat);
                }
                else
                {
                    existingCat.Catlib = lcategorie.Catlib ?? existingCat.Catlib;
                    existingCat.Cathsup = lcategorie.Cathsup ?? existingCat.Cathsup;
                    existingCat.Catperiode = lcategorie.Catperiode ?? existingCat.Catperiode;
                    existingCat.Catsem2 = lcategorie.Catsem2;
                    existingCat.Catsem3 = lcategorie.Catsem3;
                    existingCat.Catsem4 = lcategorie.Catsem4;
                    existingCat.Catsem5 = lcategorie.Catsem5;
                    existingCat.Catsem6 = lcategorie.Catsem6;
                    existingCat.Catsem7 = lcategorie.Catsem7;
                    existingCat.Catsem8 = lcategorie.Catsem8;
                    existingCat.Catsem9 = lcategorie.Catsem9;
                    existingCat.Catsem10 = lcategorie.Catsem10;
                    existingCat.Catsem11 = lcategorie.Catsem11;
                    existingCat.Catsem12 = lcategorie.Catsem12;
                }

                // 2️⃣ Nouvelle période (Lcategorie). Ordre est Identity côté DB → on ne l'envoie pas,
                // EF Core l'ignorera grâce à [DatabaseGenerated(Identity)].
                var lcat = new Lcategorie
                {
                    Soccod = lcategorie.Soccod,
                    Catcod = lcategorie.Catcod,
                    Codposte = lcategorie.Codposte,
                    Catdu = lcategorie.Catdu,
                    Catau = lcategorie.Catau,
                    Catfixe = lcategorie.Catfixe,
                };
                await _dbContext.Lcategories.AddAsync(lcat);

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

        public async Task<string?> GetCatcodByEmp(string soccod, string empcod, DateTime? date)
        {
            try
            {
                var catcod = await _dbContext.Presences.Where(p => p.Soccod == soccod && p.Predat.Value.Date == date.Value.Date && p.Empcod == empcod)
                   .Select(p => p.Catcod)
                   .FirstOrDefaultAsync();
                if (string.IsNullOrEmpty(catcod))
                {
                    // Step 1: Get employee's category
                    catcod = await _dbContext.Employes
                       .Where(emp => emp.Soccod == soccod && emp.Empcod == empcod)
                       .Select(emp => emp.Catcod)
                       .FirstOrDefaultAsync();
                }
                return catcod;
            }
            catch (Exception)
            {
                throw;
            }
        }
    }
}
