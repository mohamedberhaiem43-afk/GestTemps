using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface IAllaitementRepository : IRepository<Allaitement>
    {
        Task<Allaitement?> GetByEmpcodAsync(string soccod, string empcod);
        Task<Allaitement?> GetAsync(string soccod, string concod);
        Task<IEnumerable<AllaitementDto>> GetAllAsync(string soccod, string uticod);
        Task<float?> GetNbhAllaitementAsync(string soccod, string empcod, DateTime? predat);
        Task<Dictionary<DateTime, float>> GetAllaitementsByPeriodAsync(string soccod, string empcod, DateTime startDate, DateTime endDate);
    }
}
