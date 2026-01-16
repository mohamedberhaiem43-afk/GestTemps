using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface IParametreRepository : IRepository<Parametre>
    {
        Task<ParametreMoisPointageDto> GetParametreMoisPointage(string soccod);
        Parametre GetAll(string soccod);
        Task<int> GetParancemp(string soccod);
        Task<ParametreNuitDto> GetParametresNuitAsync(string soccod);
        Task<bool> DroitHeureSupp(string soccod,string empniv);
        Task<string> GetJourRepos(string soccod);
        Task<SuppAndFerierParam> GetSuppAndFerierParam(string soccod, string empniveau);
        Task<bool> IsRepos(string soccod, DateTime? predat,string codpost);
        Task<bool> UpdateParametres(Parametre parametre);
        Task<EtatPresenceParametreDto> GetEtatPresenceParametres(string soccod);
        Task<short?> GetLongbdg(string soccod);
        Task<string> GetPaie(string soccod);
        Task<float?> GetNbhConge(string soccod);
        Task<int?> GetNbhFerier(string soccod);
        //Task<float?> GetTotheureCongeParPeriode(string soccod,List<string> empcod, DateTime? debut, DateTime? fin);
        Task<Dictionary<string, float>> GetTotheureCongeParPeriode(string soccod, List<string> empcods, DateTime? debut, DateTime? fin);
        Task<ArrondiParam?> GetEtatPeriodiqueParamAsync(string soccod);

    }
}
