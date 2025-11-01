using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface IPaysRepoistory : IRepository<Nation>
    {
        Nation GetByNatcod(string natcod);
        Dictionary<string, string> GetNatlibs();
    }
}
