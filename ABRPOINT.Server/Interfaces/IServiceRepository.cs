using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface IServiceRepository : IRepository<Service>
    {
        Task<Service> GetBySercod(string sercod, string soccod);
        IEnumerable<Service> GetAll(string soccod);
        Task<Dictionary<string, string>> GetServLibs(string soccod);
    }
}
