using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface ISiteRepository : IRepository<Site>
    {
        Task<Site?> GetBySitcodAsync(string soccod, string sitcod);
        Task<IEnumerable<Site>> GetAllAsync(string soccod);
        Task<Dictionary<string, string>> GetSitLibsAsync();
        Task<Dictionary<string, string>> GetSitLibsAsync(string soccod);
        Task<Dictionary<string, string>> GetSitLibsAsync(string soccod, string uticod);
    }
}
