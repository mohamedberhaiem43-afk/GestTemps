using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.CalculService.HeureAbsences
{
    public interface IHeureAbsencesService
    {
        public Task<float?> CalculateHeureAbsences(Presence presence,string soccod,string? poste,DateTime? date,AutDto autorisation,float? hretrav);
    }
}
