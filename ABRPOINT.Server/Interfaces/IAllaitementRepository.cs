using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface IAllaitementRepository : IRepository<Allaitement>
    {
        Task<Allaitement> GetByEmpcod(string soccod, string empcod);
        Task<Allaitement> Get(string soccod, string concod);
        Task<IEnumerable<AllaitementDto>> GetAll(string soccod, string uticod);
        Task<float?> GetNbhAllaitement(string soccod, string empcod, DateTime? predat);

    }
}
