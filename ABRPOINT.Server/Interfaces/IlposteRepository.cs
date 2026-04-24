using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface IlposteRepository : IRepository<Lposte>
    {
        Task<IEnumerable<Lposte>> GetLposteAsync(string soccod, string codposte);
    }
}
