using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface ICongeRepository : IRepository<Conge>
    {
        Conge GetByConcod(string soccod, string concod);
        Task<List<CongeAbsenceDto>> GetCongeWithAbsenceAsync(string soccod, string uticod);
        Task AddMultiple(List<Conge> conges);
        Task<NombreConge> GetNbJourEtHreEmpConge(string soccod, string empcod, DateTime? predat,string codpost);
        Task<DroitCongeDto> GetDroitConge(string soccod, string empcod, DateTime? datedebut, DateTime? datefin);
        Task<string> GetCongeLib(string? soccod,string empcod, DateTime dmdate);
        Task<Dictionary<(string Soccod, string Empcod, DateTime Date), string?>> GetCongeLibBatch(List<(string Soccod, string Empcod, DateTime Date)> demandes);
        Task<Dictionary<(string Soccod, string Empcod, DateTime Date), string?>> GetCongeEmployeLibBatch(string Soccod, string Empcod, DateTime debut,DateTime fin);
        Task<float> GetNbCongeRecue(string soccod, string empcod, string annee, string currentMonth);
        Task<List<CahierConge>> GetCahierConge(string soccod, DateTime datedebut, DateTime datefin, List<string> empcods);
        Task<Conge> GetEmpCongeByDate(string soccod, string empcod, DateTime date);
        Task<List<CongeDto>> GetCongesByPeriod(string soccod, string empcod, DateTime startDate, DateTime endDate);
    }
}
