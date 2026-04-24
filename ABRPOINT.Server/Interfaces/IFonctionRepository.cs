using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface IFonctionRepository : IRepository<Fonction>
    {
        Task<Fonction?> GetByFonccodAsync(string soccod, string fonccod);
        Task<Dictionary<string, string>> GetFonLibsAsync();
        Task<IEnumerable<Fonction>> GetAllAsync(string soccod);
    }
}
