using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Mvc;

namespace ABRPOINT.Server.Interfaces
{
    public interface IDirectionRepository : IRepository<Direction>
    {
        Task<Dictionary<string, string>> GetDirLibsAsync(string soccod);
        Task<Direction?> GetAsync(string soccod, string dircod);
        Task<IEnumerable<Direction>> GetAllAsync(string soccod);
    }
}
