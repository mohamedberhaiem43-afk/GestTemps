using ABRPOINT.Server.Data;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Repository
{
    public class SiteRepository : ISiteRepository
    {
        private readonly ApplicationDbContext _dbContext;
        public SiteRepository(ApplicationDbContext dbContext)
        {
            _dbContext = dbContext;
        }
        public void Add(Site entity)
        {
            try
            {
                _dbContext.Sites.Add(entity);
                _dbContext.SaveChanges();
            }
            catch (Exception)
            {
                throw;
            }
        }

        public void Delete(Site entity)
        {
            if (entity != null)
            {
                _dbContext.Sites.Remove(entity);
                _dbContext.SaveChanges();
            }
        }

        public IEnumerable<Site> GetAll()
        {
            return _dbContext.Sites.ToList();
        }
        public async Task<Dictionary<string, string>> GetSitLibs()
        {
            return await _dbContext.Sites
                             .GroupBy(s => s.Sitcod)
                             .Select(group => group.First())  // Take the first item from each group
                             .ToDictionaryAsync(abs => abs.Sitcod, abs => abs.Sitlib);
        }

        public async Task<Dictionary<string, string>> GetSitLibs(string soccod)
        {
            try
            {
                return await _dbContext.Sites
                    .Where(s => s.Soccod == soccod)
                    .GroupBy(s => s.Sitcod)
                    .Select(group => group.First())
                    .ToDictionaryAsync(s => s.Sitcod, s => s.Sitlib ?? s.Sitcod);
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException($"Erreur lors de la récupération des sites pour la société {soccod}", ex);
            }
        }
        public async Task<Dictionary<string, string>> GetSitLibs(string soccod, string uticod)
        {
            // Perform a join between Socusers and Sites based on Sitcod
            return await _dbContext.Socusers
                .Where(s => s.Soccod == soccod && s.Uticod == uticod) // Filter Socusers by soccod and uticod
                .Join(
                    _dbContext.Sites, // Joining with Sites table
                    socuser => socuser.Sitcod, // Join key from Socusers
                    site => site.Sitcod,       // Join key from Sites
                    (socuser, site) => new { site.Sitcod, site.Sitlib } // Selecting Sitcod and Sitlib from joined result
                )
                .Distinct() // Ensure unique Sitcod-Sitlib pairs
                .ToDictionaryAsync(result => result.Sitcod, result => result.Sitlib); // Convert to Dictionary
        }

        public Site GetBySitcod(string soccod,string sitcod)
        {
            try
            {
                return _dbContext.Sites
                    .Where(s => s.Soccod == soccod && s.Sitcod == sitcod)
                    .SingleOrDefault();
            }
            catch (Exception ex)
            {

                throw new Exception("Erreur innatendu ",ex);
            }
           
        }

        public void Update(Site entity)
        {
            if (entity != null)
            {
                _dbContext.Sites.Update(entity);
                _dbContext.SaveChanges();
            }
        }

        public IEnumerable<Site> GetAll(string soccod)
        {
            try
            {
                return _dbContext.Sites
                    .Where(s => s.Soccod == soccod)
                    .ToList();
            }
            catch (Exception ex)
            {

                throw new Exception("",ex);
            }
        }

        public async Task<bool> UpdateAsync(Site site)
        {
            try
            {
                var rowsAffected = await _dbContext.Sites
                    .Where(s => s.Soccod == site.Soccod && s.Sitsoc == site.Sitcod)
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(s => s.Sitlib, site.Sitlib)
                        .SetProperty(s => s.Sitadr, site.Sitadr)
                        .SetProperty(s => s.Sitpaie, site.Sitpaie)
                        .SetProperty(s => s.Sittel, site.Sittel)
                        .SetProperty(s => s.Sitmois, site.Sitmois)
                        .SetProperty(s => s.Sitconge, site.Sitconge)
                        .SetProperty(s => s.Sitcongem, site.Sitcongem)
                        .SetProperty(s => s.Sitsanch, site.Sitsanch)
                        .SetProperty(s => s.Sitsancm, site.Sitsancm)
                        .SetProperty(s => s.Sitfax, site.Sitfax)
                        .SetProperty(s => s.Sitemail, site.Sitemail)
                    );

                return rowsAffected > 0;
            }
            catch (Exception)
            {
                throw;
            }
        }
    }
}

