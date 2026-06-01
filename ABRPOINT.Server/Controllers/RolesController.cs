using ABRPOINT.Server.Annotations.AdminAttributes;
using ABRPOINT.Server.Authorization;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Models;
using ABRPOINT.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    [Admin]
    public class RolesController : ControllerBase
    {
        private readonly ApplicationDbContext _dbContext;

        public RolesController(ApplicationDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        // GET: api/Roles
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            try
            {
                var roles = await _dbContext.Roles
                    .Include(r => r.Permissions)
                    .Include(r => r.Pointdroits)
                    .OrderBy(r => r.RoleId)
                    .ToListAsync();
                return Ok(roles);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = "Error fetching roles", Error = "Erreur interne. Consultez les logs serveur pour le détail." });
            }
        }

        // GET: api/Roles/5
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            try
            {
                var role = await _dbContext.Roles
                    .Include(r => r.Permissions)
                    .FirstOrDefaultAsync(r => r.RoleId == id);

                if (role == null) return NotFound(new { Message = "Role not found" });
                return Ok(role);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = "Error fetching role", Error = "Erreur interne. Consultez les logs serveur pour le détail." });
            }
        }

        // POST: api/Roles
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateRoleRequest request)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(request.RoleName))
                    return BadRequest(new { Message = "Role name is required" });

                // Check for duplicate name
                var exists = await _dbContext.Roles.AnyAsync(r => r.RoleName == request.RoleName);
                if (exists)
                    return BadRequest(new { Message = "A role with this name already exists" });

                var role = new Role
                {
                    RoleName = request.RoleName,
                    RoleDescription = request.RoleDescription,
                    RoleColor = request.RoleColor ?? "#64748b",
                    RoleIsSystem = false,
                    RoleCreatedAt = DateTime.UtcNow
                };

                // Permissions par défaut sur tous les modules — refus par défaut.
                role.Permissions = PermissionCatalog.Modules.All.Select(m => new RolePermission
                {
                    RpModule = m,
                    RpConsult = "0",
                    RpAdd = "0",
                    RpModify = "0",
                    RpDelete = "0"
                }).ToList();

                _dbContext.Roles.Add(role);
                await _dbContext.SaveChangesAsync();

                return Ok(role);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = "Error creating role", Error = "Erreur interne. Consultez les logs serveur pour le détail." });
            }
        }

        /// <summary>
        /// Rattrape un tenant existant qui a été créé avant l'introduction des rôles système RBAC :
        /// crée Administrator/Manager/Employee + leurs permissions par défaut s'ils n'existent pas.
        /// Idempotent : ne touche pas une matrice déjà personnalisée par l'admin.
        /// </summary>
        [HttpPost("seed-system")]
        public async Task<IActionResult> SeedSystemRoles(CancellationToken ct)
        {
            try
            {
                var report = await SystemRoleSeeder.SeedAsync(_dbContext, ct);

                // Rattrapage natures d'absence par défaut (CP/FM/AUT/RTT/CET) pour les sociétés
                // du tenant qui n'en ont aucune — pour les tenants créés avant l'introduction
                // de ce seed au provisioning. Idempotent (ne touche pas une grille existante).
                var soccods = await _dbContext.Societes
                    .Where(s => s.Soccod != null)
                    .Select(s => s.Soccod!)
                    .ToListAsync(ct);
                var absencesCreated = 0;
                foreach (var soccod in soccods)
                    absencesCreated += await Provisioning.DefaultAbsenceSeeder.SeedAsync(_dbContext, soccod, ct);
                if (absencesCreated > 0) await _dbContext.SaveChangesAsync(ct);

                // Rattrapage des modèles de documents par défaut + liaisons signature pour chaque
                // société du tenant qui n'en a pas (tenants créés avant l'introduction de ce seed).
                // Idempotent ; le seeder gère son propre SaveChanges.
                var letterTemplatesCreated = 0;
                var signatureMapsCreated = 0;
                foreach (var soccod in soccods)
                {
                    var (tpl, maps) = await Provisioning.DefaultLetterTemplateSeeder.SeedAsync(_dbContext, soccod, ct);
                    letterTemplatesCreated += tpl;
                    signatureMapsCreated += maps;
                }

                return Ok(new
                {
                    message = "Seed terminé.",
                    rolesCreated = report.RolesCreated,
                    rolesUpdated = report.RolesUpdated,
                    permissionsCreated = report.PermissionsCreated,
                    legacyUsersMigrated = report.LegacyUsersMigrated,
                    absenceNaturesCreated = absencesCreated,
                    letterTemplatesCreated,
                    signatureMapsCreated,
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = "Erreur durant le seed des rôles système.", Error = "Erreur interne. Consultez les logs serveur pour le détail." });
            }
        }

        /// <summary>
        /// Crée les tables nécessaires aux fonctionnalités mobiles (push_tokens, push_reminder_log)
        /// si absentes. À jouer une fois sur chaque tenant existant. Idempotent.
        /// </summary>
        [HttpPost("install-mobile-tables")]
        public async Task<IActionResult> InstallMobileTables(CancellationToken ct)
        {
            try
            {
                var report = await MobileTablesInstaller.InstallAsync(_dbContext, ct);
                return Ok(new
                {
                    message = "Tables mobiles installées.",
                    pushTokensCreated = report.PushTokensCreated,
                    pushReminderLogCreated = report.PushReminderLogCreated,
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = "Erreur lors de l'installation des tables mobiles.", Error = "Erreur interne. Consultez les logs serveur pour le détail." });
            }
        }

        /// <summary>
        /// Envoie une notification push de test à tous les devices d'un utilisateur.
        /// Pratique pour vérifier que l'enregistrement du token + la livraison Expo fonctionnent
        /// avant de débugger les hooks métier (congés, autorisations, rappels).
        /// </summary>
        [HttpPost("test-push/{uticod}")]
        public async Task<IActionResult> TestPush(string uticod, [FromServices] IUserNotificationService notify, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(uticod))
                return BadRequest(new { message = "uticod requis" });
            var sent = await notify.NotifyUserAsync(
                uticod,
                "🔔 Notification de test",
                "Si vous recevez ce message, les notifications push sont opérationnelles.",
                new { type = "test_push" }, ct);
            return Ok(new { sent });
        }

        // PUT: api/Roles/5
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateRoleRequest request)
        {
            try
            {
                var role = await _dbContext.Roles.FindAsync(id);
                if (role == null) return NotFound(new { Message = "Role not found" });
                if (role.RoleIsSystem)
                    return BadRequest(new { Message = "System roles cannot be modified" });

                role.RoleName = request.RoleName ?? role.RoleName;
                role.RoleDescription = request.RoleDescription ?? role.RoleDescription;
                role.RoleColor = request.RoleColor ?? role.RoleColor;

                await _dbContext.SaveChangesAsync();
                return Ok(role);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = "Error updating role", Error = "Erreur interne. Consultez les logs serveur pour le détail." });
            }
        }

        // PUT: api/Roles/5/permissions
        [HttpPut("{id}/permissions")]
        public async Task<IActionResult> UpdatePermissions(int id, [FromBody] List<UpdatePermissionRequest> permissions)
        {
            try
            {
                var role = await _dbContext.Roles
                    .Include(r => r.Permissions)
                    .FirstOrDefaultAsync(r => r.RoleId == id);

                if (role == null) return NotFound(new { Message = "Role not found" });

                foreach (var permReq in permissions)
                {
                    var existing = role.Permissions?.FirstOrDefault(p => p.RpModule == permReq.Module);
                    if (existing != null)
                    {
                        existing.RpConsult = permReq.Consult ? "1" : "0";
                        existing.RpAdd = permReq.Add ? "1" : "0";
                        existing.RpModify = permReq.Modify ? "1" : "0";
                        existing.RpDelete = permReq.Delete ? "1" : "0";
                    }
                    else
                    {
                        // Add new module permission
                        var newPerm = new RolePermission
                        {
                            RpRoleId = id,
                            RpModule = permReq.Module,
                            RpConsult = permReq.Consult ? "1" : "0",
                            RpAdd = permReq.Add ? "1" : "0",
                            RpModify = permReq.Modify ? "1" : "0",
                            RpDelete = permReq.Delete ? "1" : "0"
                        };
                        _dbContext.RolePermissions.Add(newPerm);
                    }
                }

                await _dbContext.SaveChangesAsync();
                return Ok(new { Message = "Permissions updated successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = "Error updating permissions", Error = "Erreur interne. Consultez les logs serveur pour le détail." });
            }
        }

        // GET: api/Roles/{id}/pointdroit/{soccod}
        [HttpGet("{id}/pointdroit/{soccod}")]
        public async Task<IActionResult> GetRolePointdroits(int id, string soccod)
        {
            try
            {
                var role = await _dbContext.Roles.FindAsync(id);
                if (role == null) return NotFound(new { Message = "Role not found" });

                // Get all pointeuses for the company
                var pointeuses = await _dbContext.Pointeuses
                    .Where(p => p.Soccod == soccod)
                    .ToListAsync();

                // Get existing role pointdroits
                var existingDroits = await _dbContext.RolePointdroits
                    .Where(d => d.RpdRoleId == id && d.RpdSoccod == soccod)
                    .ToListAsync();

                // Build response combining pointeuses with their droits
                var result = pointeuses.Select(p =>
                {
                    var droit = existingDroits.FirstOrDefault(d => d.RpdPoicod == p.Poicod);
                    return new RolePointdroitDto
                    {
                        Poicod = p.Poicod,
                        Poilib = p.Poilib,
                        Soccod = soccod,
                        RoleId = id,
                        Lire = droit?.RpdLire ?? "0",
                        Purger = droit?.RpdPurger ?? "0",
                        Config = droit?.RpdConfig ?? "0"
                    };
                }).ToList();

                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = "Error fetching role pointdroits", Error = "Erreur interne. Consultez les logs serveur pour le détail." });
            }
        }

        // PUT: api/Roles/{id}/pointdroit
        [HttpPut("{id}/pointdroit")]
        public async Task<IActionResult> UpdateRolePointdroits(int id, [FromBody] List<UpdateRolePointdroitRequest> pointdroits)
        {
            try
            {
                var role = await _dbContext.Roles.FindAsync(id);
                if (role == null) return NotFound(new { Message = "Role not found" });

                foreach (var req in pointdroits)
                {
                    var existing = await _dbContext.RolePointdroits
                        .FirstOrDefaultAsync(d => d.RpdRoleId == id && d.RpdPoicod == req.Poicod && d.RpdSoccod == req.Soccod);

                    if (existing != null)
                    {
                        existing.RpdLire = req.Lire ? "1" : "0";
                        existing.RpdPurger = req.Purger ? "1" : "0";
                        existing.RpdConfig = req.Config ? "1" : "0";
                    }
                    else
                    {
                        _dbContext.RolePointdroits.Add(new RolePointdroit
                        {
                            RpdRoleId = id,
                            RpdPoicod = req.Poicod,
                            RpdSoccod = req.Soccod,
                            RpdLire = req.Lire ? "1" : "0",
                            RpdPurger = req.Purger ? "1" : "0",
                            RpdConfig = req.Config ? "1" : "0"
                        });
                    }
                }

                await _dbContext.SaveChangesAsync();
                return Ok(new { Message = "Role pointdroits updated successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = "Error updating role pointdroits", Error = "Erreur interne. Consultez les logs serveur pour le détail." });
            }
        }

        // DELETE: api/Roles/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var role = await _dbContext.Roles
                    .Include(r => r.Permissions)
                    .FirstOrDefaultAsync(r => r.RoleId == id);

                if (role == null) return NotFound(new { Message = "Role not found" });
                if (role.RoleIsSystem)
                    return BadRequest(new { Message = "System roles cannot be deleted" });

                // Remove permissions first
                if (role.Permissions != null)
                    _dbContext.RolePermissions.RemoveRange(role.Permissions);

                _dbContext.Roles.Remove(role);
                await _dbContext.SaveChangesAsync();

                return Ok(new { Message = "Role deleted successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = "Error deleting role", Error = "Erreur interne. Consultez les logs serveur pour le détail." });
            }
        }
    }

    // DTOs
    public class CreateRoleRequest
    {
        public string RoleName { get; set; } = string.Empty;
        public string? RoleDescription { get; set; }
        public string? RoleColor { get; set; }
    }

    public class UpdateRoleRequest
    {
        public string? RoleName { get; set; }
        public string? RoleDescription { get; set; }
        public string? RoleColor { get; set; }
    }

    public class UpdatePermissionRequest
    {
        public string Module { get; set; } = string.Empty;
        public bool Consult { get; set; }
        public bool Add { get; set; }
        public bool Modify { get; set; }
        public bool Delete { get; set; }
    }

    public class RolePointdroitDto
    {
        public string? Poicod { get; set; }
        public string? Poilib { get; set; }
        public string? Soccod { get; set; }
        public int RoleId { get; set; }
        public string? Lire { get; set; }
        public string? Purger { get; set; }
        public string? Config { get; set; }
    }

    public class UpdateRolePointdroitRequest
    {
        public string Poicod { get; set; } = string.Empty;
        public string Soccod { get; set; } = string.Empty;
        public bool Lire { get; set; }
        public bool Purger { get; set; }
        public bool Config { get; set; }
    }
}
