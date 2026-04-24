using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface ICalendrierRepository : IRepository<Calendsoc>
    {
        Task<Dictionary<string, string>> GetCalLibsAsync();
        Task<Calendsoc?> GetCalendrierAsync(string soccod, string annee, string moisdeb, string type);
        Task<IEnumerable<CalendsocDto>> GetCumulAsync(string soccod, string annee);
        Task<IEnumerable<Lcalendsoc>> GetAnneeCalendrierAsync(string soccod,string annee);
        Task UpdateCalendrierAsync(string soccod, string caltype, string annee, float nbhJours, float nbhSamedi, string jourRepos, string mois, byte tousMois);
        Task<IDictionary<string, string>> GetCalendriersAsync(string soccod);
        Task<bool> CloneCalendrierAsync(string soccod, int annee);
        Task<bool> CloneLCalendrierAsync(string soccod, int annee);
        Task AddCalendrierAsync(string soccod, string annee, string caltype);
        Task<(string? calend,float? hours, DateTime? startDate, DateTime? endDate,int? jourferier,float? heuresferier)> GetNbHeuresParSemaineWithDatesAsync(string soccod, string mois, string annee, string semaine, string empcod);
    }
}
