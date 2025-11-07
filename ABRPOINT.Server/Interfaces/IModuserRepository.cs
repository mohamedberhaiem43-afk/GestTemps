using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface IModuserRepository
    {
        Task<List<ModuserDto>> GetModusers(string uticod);
        Task<bool> AddModuser(Moduser moduser);
        Task<bool> DeleteModuser(int ordre);
        Task<bool> UpdateModuser(Moduser moduser);
    }
}
