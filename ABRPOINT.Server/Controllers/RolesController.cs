using ABRPOINT.Server.Data;
using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
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
                return StatusCode(500, new { Message = "Error fetching roles", Error = ex.Message });
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
                return StatusCode(500, new { Message = "Error fetching role", Error = ex.Message });
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

                // Create default permissions for all modules
                var modules = new[]
                {
                    "Absences et Sanctions",
                    "Pointage et Temps",
                    "Gestion Employés",
                    "Contrats et Avenants",
                    "Paie et Rémunération",
                    "Gestion des Congés",
                    "Données de Base",
                    "Paramètres de Temps",
                    "Rapports et Statistiques",
                    "Administration"
                };

                role.Permissions = modules.Select(m => new RolePermission
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
                return StatusCode(500, new { Message = "Error creating role", Error = ex.Message });
            }
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
                return StatusCode(500, new { Message = "Error updating role", Error = ex.Message });
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
                return StatusCode(500, new { Message = "Error updating permissions", Error = ex.Message });
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
                return StatusCode(500, new { Message = "Error fetching role pointdroits", Error = ex.Message });
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
                return StatusCode(500, new { Message = "Error updating role pointdroits", Error = ex.Message });
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
                return StatusCode(500, new { Message = "Error deleting role", Error = ex.Message });
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
