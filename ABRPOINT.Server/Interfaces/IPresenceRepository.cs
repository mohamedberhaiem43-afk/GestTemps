using ABRPOINT.Server.Controllers;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface IPresenceRepository : IRepository<Presence>
    {
        PresenceDto Get(string soccod, string empcod, DateTime predat);
        Task<IEnumerable<EtatEmpPresence>> GetAllAsync(string soccod, DateTime dateDebut, DateTime dateFin, string regime, List<string>empcods);
        Task<IEnumerable<Presence>> GetEmpEtatPeriodiqueAsync(string soccod, string empcod);
        Task<IEnumerable<PresenceDto>> GetEmpEtatPeriodiqueAsync(string soccod, string empcod, DateTime dateDebut, DateTime dateFin);
        Task CalculatePresence(Presence presence);
        Task UpdateAsync(PresenceDto dbpresence);
        Task<PresenceDto> AddPresence(string soccod, string empcod, DateTime date, string poicod);
        Task<double?> GetPreRepas(string empcod, DateTime? predate);
        Task<float?> GetNbJours(string empcod, DateTime? dateDeb, DateTime? dateFin);
        Task<PresenceSemaineData> GetPresenceSemaineData(string soccod, string empcod, string mois, string annee, string semaine);
        Task<Presence> GetPresenceByEmployeeAndTime(string soccod, string empcode, DateTime time);
        Task<PresenceStatistics?> GetStatistics(DateTime startDate, DateTime today);
        Task<List<AbsenceInfo>?> GetRecentAbsences(DateTime startDate, DateTime today, int v);
        Task<GlobalStatistics?> GetGlobalStatistics();
    }
}
