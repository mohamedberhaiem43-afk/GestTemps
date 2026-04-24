using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface IautoriserRepository : IRepository<Autoriser>
    {
        Task<Autoriser?> GetByConcodAsync(string soccod, string concod);
        Task<List<AutoriserEmployeDto>> GetAutoriserWithAbsenceAsync(string soccod, string uticod);
        Task AddMultipleAutorisation(List<Autoriser> autorisers);
        Task<AutDto?> GetAutLib(string? soccod, string? empcod, DateTime dmdate);
        Task<IEnumerable<Autoriser>>GetAllAsync(string? soccod, string? uticod);
        Task<Dictionary<(string Empcod, DateTime Date), AutDto?>> GetAutLibBatch(string soccod, string empcod, DateTime dateDeb, DateTime dateFin);
        Task<Dictionary<(string Empcod, DateTime Date), AutDto>> GetAutLibBatch(string soccod, List<(string Empcod, DateTime Date)> demandes);
        Task<List<AutDto>> GetAutorisationsByPeriod(string soccod, string empcod, DateTime startDate, DateTime endDate);
    }
}
