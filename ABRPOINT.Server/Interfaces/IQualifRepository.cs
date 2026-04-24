using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface IQualifRepository : IRepository<Qualif>
    {
        Task<IEnumerable<Qualif>> GetAllAsync(string soccod);
        Task<Qualif?> GetByQuafcodAsync(string soccod, string quacod);
        Task<Dictionary<string, string>> GetQuaLibsAsync(string soccod);
    }
}