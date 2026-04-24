using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface ICongeRepository : IRepository<Conge>
    {
        Task<Conge?> GetByConcodAsync(string soccod, string concod);
        Task<List<CongeAbsenceDto>> GetCongeWithAbsenceAsync(string soccod, string uticod);
        Task AddMultipleAsync(List<Conge> conges);
        Task<NombreConge> GetNbJourEtHreEmpCongeAsync(string soccod, string empcod, DateTime? predat,string codpost);
        Task<DroitCongeDto> GetDroitCongeAsync(string soccod, string empcod, DateTime? datedebut, DateTime? datefin);
        Task<string> GetCongeLibAsync(string? soccod,string empcod, DateTime dmdate);
        Task<Dictionary<(string Soccod, string Empcod, DateTime Date), (string? Abslib, float? Connbjour)>> GetCongeLibBatchAsync(List<(string Soccod, string Empcod, DateTime Date)> demandes);

        //Task<Dictionary<(string Soccod, string Empcod, DateTime Date, float? Connbjour), (string? Abslib, float? Connbjour)>> GetCongeLibBatch(List<(string Soccod, string Empcod, DateTime Date, float? Connbjour)> demandes);

        Task<Dictionary<(string Soccod, string Empcod, DateTime Date,float? connbjour), string?>> GetCongeEmployeLibBatchAsync(string Soccod, string Empcod, DateTime debut,DateTime fin);
        Task<float> GetNbCongeRecueAsync(string soccod, string empcod, string annee, string currentMonth);
        Task<List<CahierConge>> GetCahierCongeAsync(string soccod, DateTime datedebut, DateTime datefin, List<string> empcods);
        Task<Conge?> GetEmpCongeByDateAsync(string soccod, string empcod, DateTime date);
        Task<List<CongeDto>> GetCongesByPeriodAsync(string soccod, string empcod, DateTime startDate, DateTime endDate);
    }
}
