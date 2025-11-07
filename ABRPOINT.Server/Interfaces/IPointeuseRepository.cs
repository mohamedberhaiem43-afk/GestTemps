using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface IPointeuseRepository : IRepository<Pointeuse>
    {
        Task AddAsync(Pointeuse? pointeuse);
        IEnumerable<Pointeuse> GetAll(string soccod);
        Task<IEnumerable<Pointeuse>> GetAllAsync(string soccod);
        Task<List<string>> GetAllIps(string soccod);
        Task<Pointeuse> GetById(string poicod, string soccod);
        Task<string> GetByIp(string soccod, string ip);
        Task<string[]> GetIpsByPoicod(string[] poicod);
        Task<List<PointeuseType>> GetPointeuseTypesByPoicod(string[] poicods);
    }
}
