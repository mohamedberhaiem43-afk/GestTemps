using ABRPOINT.Server.Authorization;
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

                    // Rôle par défaut si non fourni : "Employee" (rôle système employé).
                    // Important : utiliser le nom officiel du rôle (PermissionCatalog.Roles.Employee)
                    // afin que la jointure RolePermissions retrouve les droits associés ; un rôle
                    // libre comme "Utilisateur Standard" n'a aucun mapping et donne 0 permission.
                    if (string.IsNullOrEmpty(utilisateur.Utirole))
                    {
                        utilisateur.Utirole = ABRPOINT.Server.Authorization.PermissionCatalog.Roles.Employee;
                    }

                    // ⚠ IgnoreQueryFilters() : si l'employé portant ce code a été soft-deleted,
                    // la ligne Utilisateur (et Socuser) reste physiquement en base avec DeletedAt set.
                    // Sans ce bypass, AddAsync échoue en violation PK car la ligne soft-deleted est
                    // invisible aux requêtes filtrées mais bien présente côté SQL.
                    var existingUser = await _dbContext.Utilisateurs
                        .IgnoreQueryFilters()
                        .FirstOrDefaultAsync(u => u.Uticod == utilisateur.Uticod);
                    if (existingUser != null)
                    {
                        if (existingUser.DeletedAt == null)
                            throw new InvalidOperationException($"Utilisateur {utilisateur.Uticod} existe déjà.");
                        existingUser.DeletedAt = null;
                        existingUser.Utiactif = utilisateur.Utiactif;
                        existingUser.Utiadm = utilisateur.Utiadm;
                        existingUser.Utinom = utilisateur.Utinom;
                        existingUser.Utiprn = utilisateur.Utiprn;
                        existingUser.Utimps = utilisateur.Utimps;
                        existingUser.Utimail = utilisateur.Utimail;
                        existingUser.Utirole = utilisateur.Utirole;
                    }
                    else
                    {
                        await _dbContext.Utilisateurs.AddAsync(utilisateur);
                    }
                    await _dbContext.SaveChangesAsync();

                    var existingSocuser = await _dbContext.Socusers
                        .IgnoreQueryFilters()
                        .FirstOrDefaultAsync(s => s.Soccod == socuser.Soccod
                                              && s.Sitcod == socuser.Sitcod
                                              && s.Uticod == socuser.Uticod);
                    if (existingSocuser != null)
                    {
                        if (existingSocuser.DeletedAt == null)
                            throw new InvalidOperationException(
                                $"Socuser {socuser.Soccod}/{socuser.Sitcod}/{socuser.Uticod} existe déjà.");
                        existingSocuser.DeletedAt = null;
                    }
                    else
                    {
                        await _dbContext.Socusers.AddAsync(socuser);
                    }
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
                        Utirole = u.Utirole,
                        Soccod = s.Soccod,
                        Sitcod = s.Sitcod,
                        Sercod = s.Sercod
                    })
                .FirstOrDefaultAsync(u => u.Uticod == uticod);

            return utilisateur;
        }

        public async Task AddAsync(Utilisateur entity)
        {
            throw new NotImplementedException();
        }

        public async Task<bool> UpdateUserAsync(UtilisateurUpdate utilisateur, string? soccod = null, string? sitcod = null, string? sercod = null)
        {
            try
            {
                // 1. Mise à jour des propriétés de base.
                // ⚠ Le frontend (SaisieUtilisateur.tsx, profile, etc.) n'envoie PAS toujours
                // tous les champs (Utiactif/Utirole/Utiadm sont souvent omis). Avec un
                // ExecuteUpdate qui SetProperty(... null), le compte se retrouvait désactivé
                // (Utiactif = NULL) après la moindre modification de mail/nom. On bascule donc
                // sur un Load → patch sélectif → SaveChanges, en ne touchant un champ que si
                // une valeur a été explicitement fournie.
                var existing = await _dbContext.Utilisateurs
                    .FirstOrDefaultAsync(u => u.Uticod == utilisateur.Utilisateur.Uticod);
                if (existing == null) return false;

                if (utilisateur.Utilisateur.Utinom  != null) existing.Utinom  = utilisateur.Utilisateur.Utinom;
                if (utilisateur.Utilisateur.Utiprn  != null) existing.Utiprn  = utilisateur.Utilisateur.Utiprn;
                if (utilisateur.Utilisateur.Utimail != null) existing.Utimail = utilisateur.Utilisateur.Utimail;
                if (!string.IsNullOrWhiteSpace(utilisateur.Utilisateur.Utiactif))
                    existing.Utiactif = utilisateur.Utilisateur.Utiactif;
                if (!string.IsNullOrWhiteSpace(utilisateur.Utilisateur.Utirole))
                {
                    existing.Utirole = utilisateur.Utilisateur.Utirole;
                    // Utiadm est DÉRIVÉ du rôle (source de vérité), pas du flag envoyé par
                    // le front. Sans ça, un changement de rôle vers "Administrator" pouvait
                    // laisser Utiadm='0' (le front ne cochait l'admin que pour le libellé
                    // exact "Administrator") → /me renvoyait isAdmin=false et l'utilisateur
                    // restait bloqué sur la vue "simple employé" malgré son nouveau rôle.
                    existing.Utiadm = ABRPOINT.Server.Authorization.PermissionCatalog.IsAdminRole(existing.Utirole)
                        ? "1" : "0";
                }
                else if (!string.IsNullOrWhiteSpace(utilisateur.Utilisateur.Utiadm))
                {
                    existing.Utiadm = utilisateur.Utilisateur.Utiadm;
                }

                // Recovery : éditer/enregistrer un utilisateur depuis la page admin
                // (ex. changement de rôle Employé → Administrateur) lève le verrou
                // anti-bruteforce. Sinon, un compte déjà verrouillé (HTTP 423 sur
                // /connect) restait bloqué et l'admin ne disposait d'aucun moyen de
                // le débloquer hormis attendre l'expiration du lock.
                existing.UtiFailedLogins = 0;
                existing.UtiLockoutUntil = null;
                await _dbContext.SaveChangesAsync();

                // 1b. Affectation site/service (table Socuser). Le SITE fait partie de la PK
                //     (soccod, uticod, sitcod) : un changement de site = suppression de
                //     l'ancienne ligne + (ré)insertion de la nouvelle. Le service (sercod) est
                //     une colonne normale, mise à jour en place. On gère la 1re affectation de
                //     l'utilisateur (le formulaire Utilisateur ne gère qu'un site/service).
                //     Avant : la modification du site dans la popup n'était JAMAIS persistée.
                if (!string.IsNullOrWhiteSpace(soccod) && !string.IsNullOrWhiteSpace(sitcod))
                {
                    var uticod = utilisateur.Utilisateur.Uticod;
                    var current = await _dbContext.Socusers.IgnoreQueryFilters()
                        .FirstOrDefaultAsync(s => s.Uticod == uticod && s.DeletedAt == null);
                    var target = await _dbContext.Socusers.IgnoreQueryFilters()
                        .FirstOrDefaultAsync(s => s.Soccod == soccod && s.Sitcod == sitcod && s.Uticod == uticod);

                    if (current != null && (current.Soccod != soccod || current.Sitcod != sitcod))
                        _dbContext.Socusers.Remove(current); // l'utilisateur change de site/société

                    if (target != null)
                    {
                        target.DeletedAt = null;   // réactive une éventuelle ligne soft-deleted
                        target.Sercod = sercod;
                    }
                    else
                    {
                        _dbContext.Socusers.Add(new Socuser
                        {
                            Soccod = soccod,
                            Uticod = uticod,
                            Sitcod = sitcod,
                            Sercod = sercod,
                            Exercice = current?.Exercice,
                        });
                    }
                    await _dbContext.SaveChangesAsync();

                    // Sync service (Sercod) Socuser → Employe : si la personne possède aussi
                    // une fiche employé dans cette société, on aligne son service. Garantit la
                    // cohérence quand le service est modifié depuis l'écran Utilisateur.
                    // Bidirectionnel avec EmployeRepository.UpdateEmployeAsync (Employe → Socuser).
                    var empRows = await _dbContext.Employes
                        .Where(e => e.Soccod == soccod && e.Empcod == uticod)
                        .ToListAsync();
                    var empChanged = false;
                    foreach (var emp in empRows)
                    {
                        if (emp.Sercod != sercod) { emp.Sercod = sercod; empChanged = true; }
                    }
                    if (empChanged) await _dbContext.SaveChangesAsync();
                }

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
                        var existingMod = await _dbContext.Modusers
                            .FirstOrDefaultAsync(m => m.Uticod == utilisateur.Utilisateur.Uticod
                                                   && m.Modcod == mod.Modcod);
                        if (existingMod != null)
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
            profile.Soclib = await _dbContext.Societes
                .Where(s => s.Soccod == soccod)
                .Select(s => s.Soclib)
                .FirstOrDefaultAsync();

            var employe = await _dbContext.Employes
                .Where(e => e.Soccod == soccod && e.Empcod == uticod)
                .SingleOrDefaultAsync();

            if (employe != null)
            {
                profile.Employee = _mapper.Map<EmployeDto>(employe);
                // Utirole vit sur Utilisateur (Employe.Utirole est [NotMapped]), on le copie
                // explicitement pour que le mobile puisse l'afficher dans la fiche profil.
                profile.Employee.Utirole = utilisateur.Utilisateur.Utirole;
            }

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
            // Recovery : une réinitialisation admin du mot de passe lève aussi le
            // verrou anti-bruteforce. Sans ça, un compte verrouillé (HTTP 423 sur
            // /connect après échecs répétés) restait inaccessible même après reset —
            // l'admin n'avait aucun moyen de débloquer l'utilisateur.
            user.UtiFailedLogins = 0;
            user.UtiLockoutUntil = null;
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

            // Réactivation = action admin délibérée → on lève aussi le verrou
            // anti-bruteforce pour que l'utilisateur puisse se reconnecter.
            if (!currentlyActive)
            {
                user.UtiFailedLogins = 0;
                user.UtiLockoutUntil = null;
            }

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

        public async Task PromoteToAdminAsync(string uticod)
        {
            if (string.IsNullOrWhiteSpace(uticod)) return;
            // Met à la fois Utirole (RBAC) et Utiadm="1" (flag legacy) pour rester
            // cohérent avec les deux systèmes de permissions qui coexistent dans le code.
            await _dbContext.Utilisateurs
                .Where(u => u.Uticod == uticod)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(u => u.Utirole, PermissionCatalog.Roles.Administrator)
                    .SetProperty(u => u.Utiadm, "1"));
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
