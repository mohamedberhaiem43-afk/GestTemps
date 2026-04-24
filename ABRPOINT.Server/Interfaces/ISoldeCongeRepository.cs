using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface ISoldeCongeRepository : IRepository<Solde>
    {
        Task<Solde?> GetByEmpcodAsync(string soccod, string empcod);
        Task<Solde?> GetByEmpCalculatedAsync(string soccod, string empcod);
    }
}
