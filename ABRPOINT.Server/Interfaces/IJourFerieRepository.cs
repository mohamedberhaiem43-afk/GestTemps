using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface IJourFerieRepository : IRepository<Ferier>
    {
        /// <summary>
        /// Met à jour un jour férié identifié par sa clé d'origine (soccod + originalFerdate).
        /// La date dans `ferier` peut être différente : on autorise donc le changement de
        /// (Soccod, Ferdate) — ce qui n'est pas possible avec UpdateAsync(ferier) seul puisque
        /// la PK serait introuvable après modification.
        /// </summary>
        Task UpdateByOriginalKeyAsync(string soccod, DateTime originalFerdate, Ferier ferier);
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
