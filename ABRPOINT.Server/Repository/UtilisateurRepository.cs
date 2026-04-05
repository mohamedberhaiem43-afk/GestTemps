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
  

        public void Delete(Utilisateur utilisateur)
        {
            if (utilisateur != null)
            {
                _dbContext.Utilisateurs.Remove(utilisateur);
                _dbContext.SaveChanges();
            }
        }
        public async Task<List<string>> GetSitcodsAccess(string soccod, string uticod)
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
        public IEnumerable<Utilisateur> GetAll()
        {
            return _dbContext.Utilisateurs.ToList();
        }

        public Utilisateur Get(int id)
        {
            return _dbContext.Utilisateurs.Find(id);
        }



        public async Task<List<Utilisateur>> GetAllUsers(string soccod, string uticod)
        {
            try
            {
                // 1. Get accessible sitcods for the current user
                var sitcods = await GetSitcodsAccess(soccod, uticod);

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

        public void Add(Utilisateur utilisateur,Socuser socuser)
        {
            if (utilisateur != null)
            {
                utilisateur.Utimps = BCrypt.Net.BCrypt.HashPassword(utilisateur.Utimps);
                _dbContext.Utilisateurs.Add(utilisateur);
                _dbContext.Socusers.Add(socuser);
                _dbContext.SaveChanges();
            }
        }
        public async Task AddAsync(Utilisateur utilisateur,Socuser socuser)
        {
            try
            {
                if (utilisateur != null)
                {
                    utilisateur.Utimps = BCrypt.Net.BCrypt.HashPassword(utilisateur.Utimps);
                    await _dbContext.Utilisateurs.AddAsync(utilisateur);
                    await _dbContext.SaveChangesAsync();
                    await _dbContext.Socusers.AddAsync(socuser);
                    await _dbContext.SaveChangesAsync();

                    // Ajouter les droits d'accès pour les absences et les demandes de congé
                    var employeeModules = new[]
                    {
                        new { Code = "absence", Sais = "0", Upd = "0", Supp = "0", Consult = "1" }, // Consultation seulement pour les absences
                        new { Code = "dem_conge", Sais = "1", Upd = "1", Supp = "1", Consult = "1" } // Tous les droits pour les demandes de congé
                    };

                    foreach (var module in employeeModules)
                    {
                        var moduser = new Moduser
                        {
                            Modcod = module.Code,
                            Uticod = utilisateur.Uticod,
                            Appcod = "PAI", // Code application par défaut
                            Modsais = module.Sais,
                            Modupd = module.Upd,
                            Modsupp = module.Supp,
                            Modconsult = module.Consult
                        };
                        await _dbContext.Modusers.AddAsync(moduser);
                    }
                    await _dbContext.SaveChangesAsync();
                }
            }
            catch (Exception)
            {
                throw;
            }
        }

        public void Update(Utilisateur utilisateur)
        {
            if (utilisateur != null)
            {
                _dbContext.Utilisateurs.Update(utilisateur);
                _dbContext.SaveChanges();
            }

        }
        public async Task<UtilisateurDto> GetUtilisateur(string uticod)
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

        public void Add(Utilisateur entity)
        {
            throw new NotImplementedException();
        }

        public async Task<bool> UpdateUser(UtilisateurUpdate utilisateur)
        {
            try
            {
                // 1. Update Utilisateur
                await _dbContext.Utilisateurs
                    .Where(u => u.Uticod == utilisateur.Utilisateur.Uticod)
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(u => u.Utinom, utilisateur.Utilisateur.Utinom)
                        .SetProperty(u => u.Utiprn, utilisateur.Utilisateur.Utiprn)
                        .SetProperty(u => u.Utimail, utilisateur.Utilisateur.Utimail)
                        .SetProperty(u => u.Utiactif, utilisateur.Utilisateur.Utiactif)
                        .SetProperty(u => u.Utiadm, utilisateur.Utilisateur.Utiadm)
                    );

                // 2. Upsert Moduser records
                foreach (var mod in utilisateur.Moduser)
                {
                    var existing = await _dbContext.Modusers
                        .FirstOrDefaultAsync(m => m.Uticod == utilisateur.Utilisateur.Uticod && m.Modcod == mod.Modcod);

                    if (existing != null)
                    {
                        // Update existing
                        await _dbContext.Modusers
                            .Where(m => m.Uticod == utilisateur.Utilisateur.Uticod && m.Modcod == mod.Modcod)
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
                        // Insert new
                        await _dbContext.Modusers.AddAsync(new Moduser
                        {
                            Uticod = utilisateur.Utilisateur.Uticod,
                            Modcod = mod.Modcod,
                            Appcod = mod.Appcod,
                            Modupd = mod.Modupd,
                            Modconsult = mod.Modconsult,
                            Modsupp = mod.Modsupp,
                            Modsais = mod.Modsais
                        });
                        await _dbContext.SaveChangesAsync();
                    }
                }

                return true;
            }
            catch (Exception ex)
            {
                // Optionally log ex here
                throw;
            }
        }

        public async Task<UtiProfile?> GetProfile(string soccod, string uticod)
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

        public async Task<bool> ChangePassword(UpdatePassword pwd)
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

        public async Task UpdateProfileImage(string? userId, string filePath)
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
    }
}
