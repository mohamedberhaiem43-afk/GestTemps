using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface IDemCongeRepository : IRepository<Demconge>
    {
        Task<List<DemcongeEmpAbsDto>> GetDemongeWithAbsenceAsync(string soccod, string uticod);
        Demconge GetByConcod(string soccod, string concod);
        Task<(bool Success, string Message)> AcceptDemCongeAsync(string soccod, string concod, string empcod);
    }
}
