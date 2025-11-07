using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface IVilleRepository : IRepository<Ville>
    {
        Ville GetByVilcod(string vilcod);
        Dictionary<string, string> GetVillibs();
    }
}
