using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface IAbscenceRepository : IRepository<Absence>
    {
        Absence GetByAbscod(string soccod, string abscod);
        IEnumerable<Absence> GetAll(string soccod);
        Task<Dictionary<string, string>> GetAbsLibs(string soccod);
        Task<List<EtatAbsence>> GetEtatAbsence(string soccod, DateTime datedebut, DateTime datefin,
            bool absaut, bool absret, bool presNonOpt, bool sansPointageInvalide, string radioValue, List<string>? empcods);
    }
}

