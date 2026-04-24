using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface IcompenserRepository : IRepository<Compenser>
    {
        Task<Compenser?> GetByNumOrdreAsync(string soccod, string id);
        Task<List<Compenser>> GetCompenserWithAbsenceAsync(string soccod);
    }
}
