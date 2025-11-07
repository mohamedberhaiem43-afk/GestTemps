using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Mvc;

namespace ABRPOINT.Server.Interfaces
{
    public interface IDemCongeRepository : IRepository<Demconge>
    {
        Task<List<DemcongeEmpAbsDto>> GetDemongeWithAbsenceAsync(string soccod, string uticod);
        Demconge GetByConcod(string soccod, string concod);
        Task<bool> AcceptDemCongeAsync(string soccod, string concod);
    }
}
