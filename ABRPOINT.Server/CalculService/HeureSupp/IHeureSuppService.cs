using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.CalculService.HeureSupp
{
    public interface IHeureSuppService
    {
        public Task<double> CalculateHeureSupp(PresenceDto presence,Poste poste);
        public Task<double> CalculateHeureSuppOptimise(PresenceDto presence,Poste poste);
    }
}
