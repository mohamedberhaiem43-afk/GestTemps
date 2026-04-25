using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface IContratRepository : IRepository<Contrat>
    {
        Task<Contrat> GetByConcod(string soccod, string concod);
        IEnumerable<object> GetEcheanceContrats(string soccod, string uticod);
        Task AddAsync(Contrat contrat);
        Task<IEnumerable<Contrat>> GetAllSearchAsync(string soccod, string srvcod, string sitcod, DateTime echdeb, DateTime echfin);
        Task<IEnumerable<Contrat>> GetAllByUticodAsync(string soccod, string uticod);
        Task<IEnumerable<Contrat>> SearchAsync(string soccod, string uticod, string? srvcod, string? sitcod, DateTime? echdeb, DateTime? echfin);
        Task<IEnumerable<Contrat>> GetAllByUticodPeriodAsync(string soccod, string uticod, DateTime echdeb, DateTime echfin);
        Task<List<EcheanceContrat>> GetEcheanceContratsByDate(string soccod, DateTime echdeb, DateTime echfin, string uticod);
        Task UpdateAsync(Contrat contrat);
        Task<Contrat> RenewAsync(RenouvellementContratDto renouvellement);
        Task DeleteAsync(Contrat contrat);
        Task<string> GetNextConcodAsync(string soccod);
    }
}
