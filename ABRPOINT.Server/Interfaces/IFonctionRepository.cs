using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface IFonctionRepository : IRepository<Fonction>
    {
        Fonction GetByFonccod(string soccod, string fonccod);
        Dictionary<string, string> GetFonLibs();
        IEnumerable<Fonction> GetAll(string soccod);
    }
}
