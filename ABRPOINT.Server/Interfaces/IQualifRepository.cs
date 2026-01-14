using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface IQualifRepository : IRepository<Qualif>
    {
        Qualif GetByQuafcod(string quacod);
        Dictionary<string, string> GetQuaLibs(string soccod);
    }
}