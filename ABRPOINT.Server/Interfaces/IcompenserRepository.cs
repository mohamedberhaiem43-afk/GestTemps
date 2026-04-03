using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface IcompenserRepository : IRepository<Compenser>
    {
        Compenser GetByNumOrdre(string soccod, string id);
        Task<List<Compenser>> GetCompenserWithAbsenceAsync(string soccod);
    }
}
