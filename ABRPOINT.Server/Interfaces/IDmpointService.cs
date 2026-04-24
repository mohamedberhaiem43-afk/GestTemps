using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface IDmpointService : IRepository<Dmpoint>
    {
        Task AddPointageAsync(Presence presence,DateTime timeSpan, string poicod);
        Task<string?> GetPoicodAsync(string soccod, string empcod, DateTime? dmdate);
        Task<Dictionary<(string Empcod, DateTime Date), string?>> GetPoicodBatchAsync(string soccod, string empcod, DateTime dateDeb, DateTime dateFin);
    }
}
