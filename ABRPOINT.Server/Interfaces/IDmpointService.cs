using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface IDmpointService : IRepository<Dmpoint>
    {
        Task AddAsync(Presence presence,DateTime timeSpan, string poicod);
        Task<string?> GetPoicod(string soccod, string empcod, DateTime? dmdate);
    }
}
