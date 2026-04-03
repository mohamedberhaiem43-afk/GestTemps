using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface ISiteRepository : IRepository<Site>
    {
        Site GetBySitcod(string soccod, string sitcod);
        IEnumerable<Site> GetAll(string soccod);
        Task<Dictionary<string, string>> GetSitLibs();
        Task<Dictionary<string, string>> GetSitLibs(string soccod);
        Task<Dictionary<string, string>> GetSitLibs(string soccod, string uticod);
        Task<bool> UpdateAsync(Site site);
    }
}
