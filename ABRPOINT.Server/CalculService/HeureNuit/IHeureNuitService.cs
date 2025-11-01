using ABRPOINT.Server.Dtaos;

namespace ABRPOINT.Server.CalculService.HeureNuit
{
    public interface IHeureNuitService
    {
        Task<float?> CalculateHeureNuit(PresenceDto presence);
    }
}
