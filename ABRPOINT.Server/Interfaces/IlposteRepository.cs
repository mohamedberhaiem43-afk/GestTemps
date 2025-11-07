using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface IlposteRepository : IRepository<Lposte>
    {
        IEnumerable<Lposte> GetLposte(string soccod, string codposte);
    }
}
