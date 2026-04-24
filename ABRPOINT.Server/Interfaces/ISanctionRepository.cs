using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface ISanctionRepository : IRepository<Sanction>
    {
        Task<SanctionDto?> GetAbsenceAsync(string soccod, string? empcod, DateTime? predat);
        Task<string> GetAbsenceLibAsync(string? soccod, string? empcod, DateTime dmdate);
        Task<Sanction?> GetSanctionAsync(string soccod, string concod);
        Task<List<SanctionEmpDto>> GetSanctionWithAbsenceAsync(string soccod, string uticod);
        Task<bool> IsDeplacementAsync(string soccod, string empcod, DateTime? predat);
        Task<bool> IsSanctionAsync(string soccod, string? empcod, DateTime? predat);
        Task<List<SanctionRangeDto>> GetAbsenceLibBatchAsync(string soccod, string empcod, DateTime dateDeb, DateTime dateFin);
        Task<List<SanctionDto>> GetSanctionsByPeriodAsync(string soccod, string empcod, DateTime startDate, DateTime endDate);
        Task<Sanction?> GetSanctionDateAsync(string soccod, DateTime? date, string empcod);
        Task UpdateAsync(Sanction sanction);
    }
}
