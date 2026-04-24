using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface ISectionRepository : IRepository<Section>
    {
        Task<Section?> GetBySeccodAsync(string seccod, string soccod);
        Task<Dictionary<string, string>> GetSecLibsAsync(string soccod);
        Task<IEnumerable<Section>> GetAllAsync(string soccod);
    }
}