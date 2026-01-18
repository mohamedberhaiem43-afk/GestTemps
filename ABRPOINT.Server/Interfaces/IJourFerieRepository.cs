using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface IJourFerieRepository : IRepository<Ferier>
    {
        Task<Ferier> GetByFerdate(string soccod, DateTime ferdate);
        Task<float?> GetHeureFerieTrav(string soccod, DateTime? predat, string? tothre);
        Task<float?> GetNbHeures(PresenceDto presence, string codpost);
        Task<bool> IsFerier(string soccod, DateTime? predat);
        Task<float?> GetFerheure(string soccod, DateTime? ferdate);
        Task<float?> GetTotheureFerierParPeriode(string soccod,DateTime? debut, DateTime? fin);
        Task<Dictionary<DateTime, Ferier>> GetByFerdateBatch(string soccod, DateTime dateDeb, DateTime dateFin);
        Task<List<Ferier>> GetFeriersByPeriod(string soccod, DateTime startDate, DateTime endDate);
    }
}
