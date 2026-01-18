using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface ISanctionRepository : IRepository<Sanction>
    {
        Task<SanctionDto?> GetAbsence(string soccod, string? empcod, DateTime? predat);
        Task<string> GetAbsenceLib(string? soccod, string? empcod, DateTime dmdate);
        Task<Sanction> GetSanction(string soccod, string concod);
        Task<List<SanctionEmpDto>> GetSanctionWithAbsenceAsync(string soccod, string uticod);
        Task<bool> IsDeplacement(string soccod, string empcod, DateTime? predat);
        Task<bool> IsSanction(string soccod, string? empcod, DateTime? predat);
        Task<Dictionary<(string Empcod, DateTime Date), string>> GetAbsenceLibBatch(string soccod, string empcod, DateTime dateDeb, DateTime dateFin);
        Task<List<SanctionDto>> GetSanctionsByPeriod(string soccod, string empcod, DateTime startDate, DateTime endDate);
    }
}
