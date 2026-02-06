using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.CalculService.HeureRetard
{
    public interface IHeureRetardService
    {
        Task<(int nbRetard, DateTime? Preretame, DateTime? Preretameup, DateTime? Preretmate, DateTime? Preretmateup, DateTime? Preretmats, DateTime? Preretmatsup, DateTime? Preretams, DateTime? Preretamsup)>CalculateHeureRetard(PresenceDto presence, Poste poste, AutDto autoisation);
    }
}
