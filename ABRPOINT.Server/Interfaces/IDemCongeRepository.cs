using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface IDemCongeRepository : IRepository<Demconge>
    {
        Task<List<DemcongeEmpAbsDto>> GetDemongeWithAbsenceAsync(string soccod, string uticod);
        Task<Demconge?> GetByConcodAsync(string soccod, string concod);
        Task<(bool Success, string Message)> AcceptDemCongeAsync(string soccod, string concod, string empcod);
        Task<(bool Success, string Message)> RefuseDemCongeAsync(string soccod, string concod, string empcod);
        Task<List<DemcongeDto>> GetAllByPeriodAsync(string soccod, string uticod, DateTime datedebut, DateTime datefin);
        Task<List<DemcongeDto>> GetEmpDemcongeAsync(string soccod, string empcod);
        Task<List<Demconge>> GetAllEnAttenteByPeriodAsync(string soccod, string uticod, DateTime datedebut, DateTime datefin);
    }
}
