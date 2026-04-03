using ABRPOINT.Server.Dtaos;

namespace ABRPOINT.Server.CalculService.CalcTotHeures
{
    public interface ICalcTotHeuresService
    {
        List<TimeSpan> GetOverlappingPeriods((TimeSpan start, TimeSpan end) basePeriod, List<(TimeSpan start, TimeSpan end)> workedPeriods);
        Task<string?> CalcHreTrav(PresenceDto presence);
        Task<string?> CalcHreTravOptimise(PresenceDto presence);
        Task<(float? nbHeurSupp, int nbRetard)> CalculateDayWorkMetrics(PresenceDto presence);
        Task<(float? nbHeurSupp, int nbRetard)> CalculateDayWorkMetricsOptimise(PresenceDto presence);
    }
}
