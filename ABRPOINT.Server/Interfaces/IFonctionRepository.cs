using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface IFonctionRepository : IRepository<Fonction>
    {
        Task<Fonction?> GetByFonccodAsync(string soccod, string fonccod);
        Task<Dictionary<string, string>> GetFonLibsAsync();
        Task<Dictionary<string, string>> GetFonLibsBySoccodAsync(string soccod);
        Task<IEnumerable<Fonction>> GetAllAsync(string soccod);
    }
}
