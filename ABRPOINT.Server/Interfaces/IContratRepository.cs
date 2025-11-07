using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface IContratRepository : IRepository<Contrat>
    {
        Contrat GetByConcod(string soccod, string concod);
        IEnumerable<object> GetEcheanceContrats(string soccod, string uticod);
        IEnumerable<Contrat> GetAll(string soccod, string srvcod, string sitcod, DateTime echdeb, DateTime echfin);
        Task<IEnumerable<Contrat>> GetAll(string soccod, string uticod);
        IEnumerable<Contrat> GetAll(string soccod, string uticod, DateTime echdeb, DateTime echfin);
        Task<List<EcheanceContrat>> GetEcheanceContratsByDate(string soccod, DateTime echdeb, DateTime echfin, string uticod);
    }
}
