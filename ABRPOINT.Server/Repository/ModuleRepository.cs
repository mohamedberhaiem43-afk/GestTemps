using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using AutoMapper;
using AutoMapper.QueryableExtensions;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Repository
{
    public class ModuleRepository : IModuleRepository
    {
        private readonly ApplicationDbContext _dbContext;
        private readonly IMapper _mapper;
        public ModuleRepository(ApplicationDbContext dbContext, IMapper mapper)
        {
            _dbContext = dbContext;
            _mapper = mapper;
        }

        public async Task<bool> AddModules(ModuleDto module)
        {
            try
            {
                await _dbContext.Modules.AddAsync(_mapper.Map<ModuleDto, Module>(module));
                var result = await _dbContext.SaveChangesAsync();
                return result > 0;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<bool> DeleteModules(string modcod)
        {
            try
            {
                var modulesToDelete = _dbContext.Modules.Where(m => m.Modcod == modcod);
                await modulesToDelete.ExecuteDeleteAsync();
                var result = await _dbContext.SaveChangesAsync();
                return result > 0;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<List<ModuleDto>> GetModules()
        {
            try
            {
                var modules = await _dbContext.Modules
                    .ProjectTo<ModuleDto>(_mapper.ConfigurationProvider)
                    .ToListAsync();
                return modules;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<bool> UpdateModules(ModuleDto module)
        {
            try
            {
                var moduleToUpdate = await _dbContext.Modules.FirstOrDefaultAsync(m => m.Modcod == module.Modcod);
                if (moduleToUpdate == null)
                    return false;

                moduleToUpdate.Modlib = module.Modlib;
                moduleToUpdate.Modsais = module.Modsais;
                moduleToUpdate.Modupd = module.Modupd;
                moduleToUpdate.Modsupp = module.Modsupp;
                moduleToUpdate.Modconsult = module.Modconsult;

                _dbContext.Modules.Update(moduleToUpdate);
                var result = await _dbContext.SaveChangesAsync();
                return result > 0;
            }
            catch (Exception)
            {
                throw;
            }
        }
    }
}
