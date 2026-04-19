using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface ISoldeCongeRepository : IRepository<Solde>
    {
        Solde GetByEmpcod(string soccod, string empcod);
        Task<Solde> GetByEmpCalculatedAsync(string soccod, string empcod);
    }
}
