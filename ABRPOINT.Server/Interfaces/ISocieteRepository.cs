using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface ISocieteRepository : IRepository<Societe>
    {
        Societe GetBySoccod(string soccod);
        Task<Dictionary<string, string>> GetSoclibs();
    }
}
