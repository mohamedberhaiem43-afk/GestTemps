using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface ICalendrierRepository : IRepository<Calendsoc>
    {
        Dictionary<string, string> GetCalLibs();
        Task<Calendsoc> GetCalendrier(string soccod, string annee, string moisdeb, string type);
        Task<IEnumerable<CalendsocDto>> GetCumul(string soccod, string annee);
        Task<IEnumerable<Lcalendsoc>> GetAnneeCalendrier(string soccod,string annee);
        Task UpdateCalendrier(string soccod, string caltype, string annee, float nbhJours, float nbhSamedi, string jourRepos, string mois, byte tousMois);
        Task<float?> GetNbHeuresParSemaine(string soccod, string mois, string annee, string semaine, string empcod);
        Task<IDictionary<string, string>> GetCalendriers(string soccod);
        Task<bool> CloneCalendrier(string soccod, int annee);
        Task<bool> CloneLCalendrier(string soccod, int annee);

    }
}
