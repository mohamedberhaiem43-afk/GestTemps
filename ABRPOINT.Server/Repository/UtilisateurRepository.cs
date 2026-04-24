using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using AutoMapper;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Repository
{
    public class UtilisateurRepository : IUtilisateurRepository
    {
        private readonly ApplicationDbContext _dbContext;
        private readonly IMapper _mapper;
        public UtilisateurRepository(ApplicationDbContext dbContext,IMapper mapper)
        {
            _dbContext = dbContext;
            _mapper = mapper;
        }
  

        public async Task DeleteAsync(Utilisateur utilisateur)
        {
            if (utilisateur != null)
            {
                _dbContext.Utilisateurs.Remove(utilisateur);
                await _dbContext.SaveChangesAsync();
            }
        }

        public async Task<bool> DeleteUtilisateurAsync(string uticod)
        {
            var executionStrategy = _dbContext.Database.CreateExecutionStrategy();

            return await executionStrategy.ExecuteAsync(async () =>
            {
                using var transaction = await _dbContext.Database.BeginTransactionAsync();
                try
                {
                    var utilisateur = await _dbContext.Utilisateurs.FindAsync(uticod);
                    if (utilisateur == null)
                        return false;

                    // Remove associated entries
                    var socusers = await _dbContext.Socusers
                        .Where(s => s.Uticod == uticod).ToListAsync();
                    _dbContext.Socusers.RemoveRange(socusers);

                    var modusers = await _dbContext.Modusers
                        .Where(m => m.Uticod == uticod).ToListAsync();
                    _dbContext.Modusers.RemoveRange(modusers);

                    _dbContext.Utilisateurs.Remove(utilisateur);

                    await _dbContext.SaveChangesAsync();
                    await transaction.CommitAsync();
                    return true;
                }
                catch (Exception)
                {
                    await transaction.RollbackAsync();
                    throw;
                }
            });
        }

        public async Task<List<string>> GetSitcodsAccessAsync(string soccod, string uticod)
        {
            try
            {
                List<string> sitcods = await _dbContext.Socusers
                   .Where(s => s.Soccod == soccod && s.Uticod == uticod)
                   .Select(s => s.Sitcod)
                   .ToListAsync();
                return sitcods;
            }
            catch (Exception)
            {
                throw;
            }
        }
        public async Task<IEnumerable<Utilisateur>> GetAllAsync()
        {
            return await _dbContext.Utilisateurs.ToListAsync();
        }

        public Utilisateur Get(int id)
        {
            return _dbContext.Utilisateurs.Find(id);
        }



        public async Task<List<Utilisateur>> GetAllUsersAsync(string soccod, string uticod)
        {
            try
            {
                // 1. Get accessible sitcods for the current user
                var sitcods = await GetSitcodsAccessAsync(soccod, uticod);

                // 2. Get all socusers that match the accessible sitcods
                var socuserUticods = await _dbContext.Socusers
                    .Where(u => sitcods.Contains(u.Sitcod))
                    .Select(u => u.Uticod)
                    .Distinct()
                    .ToListAsync();

                // 3. Get utilisateurs whose uticod exists in the filtered socusers
                var utilisateurs = await _dbContext.Utilisateurs
                    .Where(u => socuserUticods.Contains(u.Uticod))
                    .ToListAsync();

                return utilisateurs;
            }
            catch (Exception ex)
            {
                throw new ApplicationException("Error retrieving users", ex);
            }
        }


        public async Task AddAsync(Utilisateur utilisateur, Socuser socuser)
        {
            try
            {
                if (utilisateur != null)
                {
                    utilisateur.Utimps = BCrypt.Net.BCrypt.HashPassword(utilisateur.Utimps);
                    
                    // Set default role if not provided
                    if (string.IsNullOrEmpty(utilisateur.Utirole))
                    {
                        utilisateur.Utirole = "Utilisateur Standard";
                    }

                    await _dbContext.Utilisateurs.AddAsync(utilisateur);
                    await _dbContext.SaveChangesAsync();
                    await _dbContext.Socusers.AddAsync(socuser);
                    await _dbContext.SaveChangesAsync();

                    // Fetch permissions for the assigned role
                    var rolePermissions = await _dbContext.Roles
                        .Include(r => r.Permissions)
                        .Where(r => r.RoleName == utilisateur.Utirole)
                        .SelectMany(r => r.Permissions)
                        .ToListAsync();

                    if (rolePermissions != null && rolePermissions.Any())
                    {
                        foreach (var perm in rolePermissions)
                        {
                            // Map labels to codes if necessary (Modcod has 15 chars limit)
                            string modCode = perm.RpModule;
                            if (modCode.Length > 15)
                            {
                                // Simple mapping for common labels from the migration
                                if (modCode.Contains("Absences")) modCode = "absence";
                                else if (modCode.Contains("Pointage")) modCode = "etat_point";
                                else if (modCode.Contains("Employés")) modCode = "employe";
                                else if (modCode.Contains("Contrats")) modCode = "emp_ctr";
                                else if (modCode.Contains("Paie")) modCode = "paie";
                                else modCode = modCode.Substring(0, 15);
                            }

                            var moduser = new Moduser
                            {
                                Modcod = modCode,
                                Uticod = utilisateur.Uticod,
                                Appcod = "GRH", // Fixed: appcod is max 3 characters in DB schema
                                Modsais = perm.RpAdd,
                                Modupd = perm.RpModify,
                                Modsupp = perm.RpDelete,
                                Modconsult = perm.RpConsult
                            };
                            await _dbContext.Modusers.AddAsync(moduser);
                        }
                    }
                    else
                    {
                        // Fallback to legacy minimal defaults if no role permissions found
                        var employeeModules = new[]
                        {
                            new { Code = "absence", Sais = "0", Upd = "0", Supp = "0", Consult = "1" }, 
                            new { Code = "dem_conge", Sais = "1", Upd = "1", Supp = "1", Consult = "1" }
                        };

                        foreach (var module in employeeModules)
                        {
                            var moduser = new Moduser
                            {
                                Modcod = module.Code,
                                Uticod = utilisateur.Uticod,
                                Appcod = "GRH", // Fixed: appcod is max 3 characters
                                Modsais = module.Sais,
                                Modupd = module.Upd,
                                Modsupp = module.Supp,
                                Modconsult = module.Consult
                            };
                            await _dbContext.Modusers.AddAsync(moduser);
                        }
                    }
                    await _dbContext.SaveChangesAsync();
                }
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task UpdateAsync(Utilisateur utilisateur)
        {
            if (utilisateur != null)
            {
                _dbContext.Utilisateurs.Update(utilisateur);
                await _dbContext.SaveChangesAsync();
            }

        }
        public async Task<UtilisateurDto> GetUtilisateurAsync(string uticod)
        {
            if (string.IsNullOrWhiteSpace(uticod))
                throw new ArgumentException("User code cannot be empty", nameof(uticod));

            var utilisateur = await _dbContext.Utilisateurs
                .Join(_dbContext.Socusers,
                    u => u.Uticod,
                    s => s.Uticod,
                    (u, s) => new UtilisateurDto
                    {
                        Uticod = u.Uticod,
                        Utinom = u.Utinom,
                        Utiprn = u.Utiprn,
                        Utimps = u.Utimps,
                        Utiactif = u.Utiactif,
                        Utiadm = u.Utiadm,
                        Utimail = u.Utimail,
                        Soccod = s.Soccod,
                        Sitcod = s.Sitcod
                    })
                .FirstOrDefaultAsync(u => u.Uticod == uticod);

            return utilisateur;
        }

        public async Task AddAsync(Utilisateur entity)
        {
            throw new NotImplementedException();
        }

        public async Task<bool> UpdateUserAsync(UtilisateurUpdate utilisateur)
        {
            try
            {
                // 1. Update base properties (always)
                await _dbContext.Utilisateurs
                    .Where(u => u.Uticod == utilisateur.Utilisateur.Uticod)
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(u => u.Utinom, utilisateur.Utilisateur.Utinom)
                        .SetProperty(u => u.Utiprn, utilisateur.Utilisateur.Utiprn)
                        .SetProperty(u => u.Utimail, utilisateur.Utilisateur.Utimail)
                        .SetProperty(u => u.Utiactif, utilisateur.Utilisateur.Utiactif)
                        .SetProperty(u => u.Utirole, utilisateur.Utilisateur.Utirole)
                        .SetProperty(u => u.Utiadm, utilisateur.Utilisateur.Utiadm)
                    );

                // 2. Update password separately only if provided
                if (!string.IsNullOrEmpty(utilisateur.Utilisateur.Utimps))
                {
                    var hashedPassword = BCrypt.Net.BCrypt.HashPassword(utilisateur.Utilisateur.Utimps);

                    await _dbContext.Utilisateurs
                        .Where(u => u.Uticod == utilisateur.Utilisateur.Uticod)
                        .ExecuteUpdateAsync(setters => setters
                            .SetProperty(u => u.Utimps, hashedPassword)
                        );
                }

                // 3. Upsert Moduser records
                if (utilisateur.Moduser != null)
                {
                    foreach (var mod in utilisateur.Moduser)
                    {
                        var existing = await _dbContext.Modusers
                            .FirstOrDefaultAsync(m => m.Uticod == utilisateur.Utilisateur.Uticod
                                                   && m.Modcod == mod.Modcod);
                        if (existing != null)
                        {
                            await _dbContext.Modusers
                                .Where(m => m.Uticod == utilisateur.Utilisateur.Uticod
                                         && m.Modcod == mod.Modcod)
                                .ExecuteUpdateAsync(setters => setters
                                    .SetProperty(m => m.Appcod, mod.Appcod)
                                    .SetProperty(m => m.Modupd, mod.Modupd)
                                    .SetProperty(m => m.Modconsult, mod.Modconsult)
                                    .SetProperty(m => m.Modsupp, mod.Modsupp)
                                    .SetProperty(m => m.Modsais, mod.Modsais)
                                );
                        }
                        else
                        {
                            _dbContext.Modusers.Add(new Moduser
                            {
                                Uticod = utilisateur.Utilisateur.Uticod,
                                Modcod = mod.Modcod,
                                Appcod = mod.Appcod,
                                Modupd = mod.Modupd,
                                Modconsult = mod.Modconsult,
                                Modsupp = mod.Modsupp,
                                Modsais = mod.Modsais
                            });
                        }
                    }

                    await _dbContext.SaveChangesAsync();
                    return true;
                }

                return false;
            }
            catch
            {
                throw;
            }
        }

        public async Task<UtiProfile?> GetProfileAsync(string soccod, string uticod)
        {
            var utilisateur = await _dbContext.Utilisateurs
                .Where(u => u.Uticod == uticod)
                .Join(_dbContext.Socusers.Where(s => s.Soccod == soccod),
                    uti => uti.Uticod,
                    soc => soc.Uticod,
                    (uti, soc) => new { Utilisateur = uti, SocUser = soc })
                .SingleOrDefaultAsync();

            if (utilisateur == null)
                return null;

            var profile = _mapper.Map<UtiProfile>(utilisateur.Utilisateur);
            profile.Sitcod = utilisateur.SocUser.Sitcod;
            profile.Soccod = utilisateur.SocUser.Soccod;

            return profile;
        }

        public async Task<bool> ChangePasswordAsync(UpdatePassword pwd)
        {
            try
            {
                // 1. Get the user from database
                var utilisateur = await _dbContext.Utilisateurs
                    .FirstOrDefaultAsync(u => u.Uticod == pwd.uticod);

                if (utilisateur == null)
                    return false;

                // 2. Verify current password
                if (!BCrypt.Net.BCrypt.Verify(pwd.currentPassword, utilisateur.Utimps))
                    return false;

                // 3. Hash and update new password
                utilisateur.Utimps = BCrypt.Net.BCrypt.HashPassword(pwd.newPassword);

                _dbContext.Utilisateurs.Update(utilisateur);
                await _dbContext.SaveChangesAsync();

                return true;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task UpdateProfileImageAsync(string? userId, string filePath)
        {
            try
            {
                await _dbContext.Utilisateurs
                    .Where(u => u.Uticod == userId)
                    .ExecuteUpdateAsync(setters =>
                        setters.SetProperty(u => u.Utiimg, filePath));
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<bool> ResetPasswordAsync(string uticod, string newPassword)
        {
            var user = await _dbContext.Utilisateurs.FindAsync(uticod);
            if (user == null) return false;

            user.Utimps = BCrypt.Net.BCrypt.HashPassword(newPassword);
            await _dbContext.SaveChangesAsync();
            return true;
        }

        public async Task<bool> ToggleStatusAsync(string uticod)
        {
            var user = await _dbContext.Utilisateurs.FindAsync(uticod);
            if (user == null) return false;

            // Toggle between '1'/'Oui' and '0'/'Non' or whatever convention is used
            // Looking at the codebase, utiactif is often '1' or 'Oui'
            bool currentlyActive = user.Utiactif == "1" || user.Utiactif == "Oui";
            user.Utiactif = currentlyActive ? "0" : "1";

            await _dbContext.SaveChangesAsync();
            return true;
        }

        public async Task<string?> GetRoleByUticodAsync(string uticod)
        {
            var user = await _dbContext.Utilisateurs
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Uticod == uticod);
            return user?.Utirole;
        }

        public async Task UpdateRoleAsync(string uticod, string newRole)
        {
            await _dbContext.Utilisateurs
                .Where(u => u.Uticod == uticod)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(u => u.Utirole, newRole));
        }

        public async Task<List<string>> GetAdminsEmailsAsync()
        {
            return await _dbContext.Utilisateurs
                .Where(u => u.Utiadm == "1" && !string.IsNullOrEmpty(u.Utimail))
                .Select(u => u.Utimail!)
                .ToListAsync();
        }
    }
}
