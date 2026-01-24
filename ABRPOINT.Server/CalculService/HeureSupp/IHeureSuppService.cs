using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.CalculService.HeureSupp
{
    public interface IHeureSuppService
    {
        public Task<int> CalculateHeureSupp(PresenceDto presence,Poste poste);
        public Task<int> CalculateHeureSuppOptimise(PresenceDto presence,Poste poste);
    }
}
