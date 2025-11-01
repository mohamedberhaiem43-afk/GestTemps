using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface IparTrancheRepository
    {
        Task<IList<Partranche>> GetPartranche(string soccod);
        Task<bool> UpdateParTranche(List<Partranche> partrancheList);
    }
}
