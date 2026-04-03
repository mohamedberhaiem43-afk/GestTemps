using ABRPOINT.Server.Dtaos;

namespace ABRPOINT.Server.Interfaces
{
    public interface IModuleRepository
    {
        Task<List<ModuleDto>> GetModules();
        Task<bool> AddModules(ModuleDto module);
        Task<bool> DeleteModules(string modcod);
        Task<bool> UpdateModules(ModuleDto module);
    }
}
