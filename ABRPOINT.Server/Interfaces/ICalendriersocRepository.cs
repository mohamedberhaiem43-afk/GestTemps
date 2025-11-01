using ABRPOINT.Server.Dtaos;

namespace ABRPOINT.Server.Interfaces
{
    public interface ICalendriersocRepository:IRepository<CalendsocDto>
    {
        Task<IEnumerable<CalendsocDto>> GetCumul(string soccod, string annee);
    }
}
