using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface ISectionRepository : IRepository<Section>
    {
        Section GetBySeccod(string seccod, string soccod);
        Dictionary<string, string> GetSecLibs(string soccod);
        IEnumerable<Section> GetAll(string soccod);
    }
}