using ABRPOINT.Server.Dtaos;

namespace ABRPOINT.Server.CalculService.HeureSupp
{
    public interface IOptimizedPresenceService
    {
        Task<PresenceSemaineData> GetPresenceSemaineDataOptimized(
            string soccod, string empcod, string mois, string annee, string semaine);

        Task<(string? calend, float? hours, DateTime? startDate, DateTime? endDate, int? jourferier, float? heuresferier)>
            GetNbHeuresParSemaineWithDates(string soccod, string mois, string annee, string semaine, string empcod);
    }
}
