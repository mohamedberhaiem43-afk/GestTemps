using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface IPaysRepoistory : IRepository<Nation>
    {
        Task<Nation?> GetByNatcodAsync(string natcod);
        Task<Dictionary<string, string>> GetNatlibsAsync();
    }
}
