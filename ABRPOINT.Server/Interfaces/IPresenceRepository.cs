using ABRPOINT.Server.Controllers;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface IPresenceRepository : IRepository<Presence>
    {
        Task<IEnumerable<EtatEmpPresence>> GetAllAsync(string soccod, DateTime dateDebut, DateTime dateFin, string regime, List<string>empcods);
        Task<IEnumerable<Presence>> GetEmpEtatPeriodiqueAsync(string soccod, string empcod);
        Task<IEnumerable<PresenceDto>> GetEmpEtatPeriodiqueAsync(string soccod, string empcod, DateTime dateDebut, DateTime dateFin);
        Task CalculatePresenceAsync(Presence presence);
        Task UpdateAsync(PresenceDto dbpresence);
        Task<PresenceDto> AddPresenceAsync(string soccod, string empcod, DateTime date, string poicod);
        Task<double?> GetPreRepasAsync(string empcod, DateTime? predate);
        Task<float?> GetNbJoursAsync(string empcod, DateTime? dateDeb, DateTime? dateFin);
        Task<PresenceSemaineData> GetPresenceSemaineDataAsync(string soccod, string empcod, string mois, string annee, string semaine,string emppanier);
        Task<Presence?> GetPresenceByEmployeeAndTimeAsync(string soccod, string empcode, DateTime time);
        Task<PresenceStatistics?> GetStatisticsAsync(DateTime startDate, DateTime today);
        Task<List<AbsenceInfo>?> GetRecentAbsencesAsync(DateTime startDate, DateTime today, int v);
        Task<GlobalStatistics?> GetGlobalStatisticsAsync();
        Task<bool> UpdateTotcmpAsync(string soccod, string empcod, DateTime date, float totcmp);
        Task<PresenceDto> GetAsync(string soccod, string empcod, DateTime predat);
        Task<List<DailyPointageDto>> GetDailyPointageAsync(string soccod, DateTime date);
        Task<EntryReminderDto> GetEntryReminderAsync(string soccod, string empcod);
    }
}
