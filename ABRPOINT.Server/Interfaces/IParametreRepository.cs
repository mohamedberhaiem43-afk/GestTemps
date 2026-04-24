using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface IParametreRepository : IRepository<Parametre>
    {
        Task<ParametreMoisPointageDto> GetParametreMoisPointageAsync(string soccod);
        Task<Parametre?> GetAllAsync(string soccod);
        Task<int> GetParancempAsync(string soccod);
        Task<ParametreNuitDto> GetParametresNuitAsync(string soccod);
        Task<bool> DroitHeureSuppAsync(string soccod,string empniv);
        Task<string> GetJourReposAsync(string soccod);
        Task<SuppAndFerierParam> GetSuppAndFerierParamAsync(string soccod, string empniveau);
        Task<(bool,string)> IsEmpcodReposAsync(string soccod, DateTime? predat,string codpost,string empcod);
        Task<bool> IsEmpfeReposAsync(string soccod, DateTime? predat,string codpost,string empferepos);
        Task<bool> UpdateParametresAsync(Parametre parametre);
        Task<EtatPresenceParametreDto> GetEtatPresenceParametresAsync(string soccod);
        Task<short?> GetLongbdgAsync(string soccod);
        Task<string> GetPaieAsync(string soccod);
        Task<float?> GetNbhCongeAsync(string soccod);
        Task<int?> GetNbhFerierAsync(string soccod);
        //Task<float?> GetTotheureCongeParPeriode(string soccod,List<string> empcod, DateTime? debut, DateTime? fin);
        Task<Dictionary<string, float>> GetTotheureCongeParPeriodeAsync(string soccod, List<string> empcods, DateTime? debut, DateTime? fin);
        Task<ArrondiParam?> GetEtatPeriodiqueParamAsync(string soccod);
        Task<bool> IsReposAsync(string soccod, DateTime? predat, string codpost);
        Task<Dictionary<DateTime, bool>> GetReposDaysByPeriodAsync(string soccod, string empcod, List<DateTime> allDates);
        Task<ParametrePresenceCalculDto?> GetParametresPresenceCalculAsync(string soccod);
    }
}
