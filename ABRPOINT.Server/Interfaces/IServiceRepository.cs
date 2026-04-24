using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface IServiceRepository : IRepository<Service>
    {
        Task<Service?> GetBySercodAsync(string sercod, string soccod);
        Task<IEnumerable<Service>> GetAllAsync(string soccod);
        Task<Dictionary<string, string>> GetServLibsAsync(string soccod);
    }
}
