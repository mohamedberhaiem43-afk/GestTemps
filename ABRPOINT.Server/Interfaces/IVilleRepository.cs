using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface IVilleRepository : IRepository<Ville>
    {
        Task<Ville?> GetByVilcodAsync(string vilcod);
        Task<Dictionary<string, string>> GetVillibsAsync();
    }
}
