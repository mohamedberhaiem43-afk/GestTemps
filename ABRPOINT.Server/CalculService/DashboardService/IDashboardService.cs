using ABRPOINT.Server.Dtaos;

namespace ABRPOINT.Server.CalculService.DashboardService
{
    public interface IDashboardService
    {
        Task<DashboardData> GetDashboardData(string soccod,DateTime dateDebut,DateTime dateFin,string? departement,List<string>? empcods);
        Task<DashboardData> GetDashboardData(string soccod,DateTime date,string? departement,List<string>? empcods);
        Task<List<EvolutionJournaliere>> GetEvolutionHebdomadaire(string soccod, DateTime dateDebut, DateTime dateFin, string? dep, List<string> empcods);
        Task<List<EmployeStatut>> GetEmployesStatutJour(string soccod, DateTime date, string dep, List<string> empcods);
        Task<List<PointageInvalideDto>> GetPointagesInvalides(DashboardRequest request);
    }
}
