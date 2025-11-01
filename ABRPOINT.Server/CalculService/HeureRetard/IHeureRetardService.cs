using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.CalculService.HeureRetard
{
    public interface IHeureRetardService
    {
        Task<int> CalculateHeureRetard(PresenceDto presence, Poste poste,AutDto autoisation);
    }
}
