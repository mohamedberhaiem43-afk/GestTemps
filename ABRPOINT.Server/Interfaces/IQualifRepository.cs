using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface IQualifRepository : IRepository<Qualif>
    {
        Task<IEnumerable<Qualif>> GetAllAsync(string soccod);
        Qualif GetByQuafcod(string quacod);
        Dictionary<string, string> GetQuaLibs(string soccod);
        Task<bool> UpdateAsync(Qualif qualif);
    }
}