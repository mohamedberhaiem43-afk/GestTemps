using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using AutoMapper;
using AutoMapper.QueryableExtensions;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Repository
{
    public class ModuserRepository : IModuserRepository
    {
        private readonly ApplicationDbContext _dbContext;
        private readonly IModuleRepository _moduleRepository;
        private readonly IMapper _mapper;
        public ModuserRepository(ApplicationDbContext dbContext, IMapper mapper, IModuleRepository moduleRepository)
        {
            _dbContext = dbContext;
            _mapper = mapper;
            _moduleRepository = moduleRepository;
        }

        public async Task<bool> AddModuser(Moduser moduser)
        {
            try
            {
                await _dbContext.Modusers.AddAsync(moduser);
                return await _dbContext.SaveChangesAsync() > 0;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<bool> DeleteModuser(int ordre)
        {
            try
            {
                await _dbContext.Modusers
                    .Where(m => m.Ordre == ordre)
                    .ExecuteDeleteAsync();
                return await _dbContext.SaveChangesAsync() > 0;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<List<ModuserDto>> GetModusers(string uticod)
        {
            try
            {
                var modusers = await (
                    from mu in _dbContext.Modusers
                    join m in _dbContext.Modules on mu.Modcod equals m.Modcod
                    where mu.Uticod == uticod
                    orderby mu.Ordre
                    select new ModuserDto
                    {
                        Ordre = mu.Ordre,
                        Modcod = mu.Modcod,
                        Uticod = mu.Uticod,
                        Appcod = mu.Appcod,
                        Modsais = mu.Modsais,
                        Modupd = mu.Modupd,
                        Modsupp = mu.Modsupp,
                        Modconsult = mu.Modconsult,
                        Modlib = m.Modlib
                    }
                ).ToListAsync();

                // If no existing moduser entries, return default access from all modules
                if (modusers.Count == 0)
                {
                    modusers = await _dbContext.Modules
                        .Select(m => new ModuserDto
                        {
                            Modcod = m.Modcod,
                            Modlib = m.Modlib,
                            Uticod = uticod,
                            Appcod = m.Appcod,
                            Modsais = "0",
                            Modupd = "0",
                            Modsupp = "0",
                            Modconsult = "0",
                        })
                        .ToListAsync();
                }

                return modusers;
            }
            catch (Exception)
            {
                throw;
            }
        }


        public async Task<bool> UpdateModuser(Moduser moduser)
        {
            try
            {
                Moduser moduleToUpdate = await _dbContext.Modusers.FirstOrDefaultAsync(m => m.Ordre == moduser.Ordre);
                if (moduleToUpdate == null)
                    return false;

                moduleToUpdate.Modsais = moduser.Modsais;
                moduleToUpdate.Modupd = moduser.Modupd;
                moduleToUpdate.Modsupp = moduser.Modsupp;
                moduleToUpdate.Modconsult = moduser.Modconsult;

                _dbContext.Modusers.Update(moduleToUpdate);
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
