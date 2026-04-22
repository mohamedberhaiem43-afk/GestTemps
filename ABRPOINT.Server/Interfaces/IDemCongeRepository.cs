using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface IDemCongeRepository : IRepository<Demconge>
    {
        Task<List<DemcongeEmpAbsDto>> GetDemongeWithAbsenceAsync(string soccod, string uticod);
        Demconge GetByConcod(string soccod, string concod);
        Task<(bool Success, string Message)> AcceptDemCongeAsync(string soccod, string concod, string empcod);
        Task<(bool Success, string Message)> RefuseDemCongeAsync(string soccod, string concod, string empcod);
        Task<List<DemcongeDto>> GetAllByPeriod(string soccod, string uticod, DateTime datedebut, DateTime datefin);
        Task<List<DemcongeDto>> GetEmpDemconge(string soccod, string empcod);
        Task<List<Demconge>> GetAllEnAttenteByPeriod(string soccod, string uticod, DateTime datedebut, DateTime datefin);
        Task AddAsync(Demconge demconge);
    }
}
