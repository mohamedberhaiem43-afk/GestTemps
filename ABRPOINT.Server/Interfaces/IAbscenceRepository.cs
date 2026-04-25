using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface IAbscenceRepository : IRepository<Absence>
    {
        Task<Absence?> GetByAbscodAsync(string soccod, string abscod);
        Task<IEnumerable<Absence>> GetAllAsync(string soccod);
        Task<Dictionary<string, string>> GetAbsLibsAsync(string soccod);
        Task<Dictionary<string, string>> GetCongeAbsLibsAsync(string soccod);
        Task<IEnumerable<Absence>> GetAutorisationAbsencesAsync(string soccod);
        Task<List<EtatAbsence>> GetEtatAbsenceAsync(string soccod, DateTime datedebut, DateTime datefin,
            bool absaut, bool absret, bool presNonOpt, bool sansPointageInvalide, string radioValue, List<string>? empcods);
    }
}
