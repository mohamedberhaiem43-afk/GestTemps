using ABRPOINT.Server.Data;
using ABRPOINT.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Authorization;

/// <summary>
/// Seed des 3 rôles système (Administrator/Manager/Employee) avec leurs permissions par défaut.
/// Idempotent : ne réécrase pas une matrice tweakée par l'admin du tenant. Utilisé à la fois
/// par le ProvisioningService (au signup d'un nouveau tenant) et par l'endpoint
/// POST /api/Roles/seed-system (rattrapage pour un tenant créé avant la phase RBAC).
/// </summary>
public static class SystemRoleSeeder
{
    public sealed record SeedReport(int RolesCreated, int RolesUpdated, int PermissionsCreated, int LegacyUsersMigrated);

    public static async Task<SeedReport> SeedAsync(ApplicationDbContext db, CancellationToken ct = default)
    {
        var existingByName = await db.Roles
            .Include(r => r.Permissions)
            .Where(r => PermissionCatalog.SystemRoles.Select(s => s.Name).Contains(r.RoleName))
            .ToDictionaryAsync(r => r.RoleName, StringComparer.OrdinalIgnoreCase, ct);

        var rolesCreated = 0;
        var rolesUpdated = 0;
        var permsCreated = 0;

        foreach (var spec in PermissionCatalog.SystemRoles)
        {
            if (!existingByName.TryGetValue(spec.Name, out var role))
            {
                role = new Role
                {
                    RoleName = spec.Name,
                    RoleDescription = spec.Description,
                    RoleColor = spec.Color,
                    RoleIsSystem = true,
                    RoleCreatedAt = DateTime.UtcNow,
                    Permissions = new List<RolePermission>(),
                };
                db.Roles.Add(role);
                rolesCreated++;
            }
            else
            {
                role.RoleDescription ??= spec.Description;
                role.RoleColor ??= spec.Color;
                role.RoleIsSystem = true;
                role.Permissions ??= new List<RolePermission>();
                rolesUpdated++;
            }

            foreach (var module in PermissionCatalog.Modules.All)
            {
                var matrix = spec.Matrix.TryGetValue(module, out var m) ? m : "0000";
                var perm = role.Permissions!.FirstOrDefault(p => p.RpModule == module);
                if (perm is null)
                {
                    role.Permissions!.Add(new RolePermission
                    {
                        RpModule = module,
                        RpConsult = matrix.Length > 0 ? matrix[0].ToString() : "0",
                        RpAdd = matrix.Length > 1 ? matrix[1].ToString() : "0",
                        RpModify = matrix.Length > 2 ? matrix[2].ToString() : "0",
                        RpDelete = matrix.Length > 3 ? matrix[3].ToString() : "0",
                    });
                    permsCreated++;
                }
                // Permission existe déjà : on n'écrase pas (préserve la matrice tweakée).
            }
        }
        await db.SaveChangesAsync(ct);

        // Migration des Utirole legacy évidents vers les noms RBAC modernes :
        //   - "admin" (toute casse) → Administrator
        //   - Utiadm="1" SANS utirole → Administrator
        // Les autres alias (manager/rh/superviseur/standard) ne sont PAS auto-migrés
        // pour ne pas écraser des conventions custom du tenant.
        var legacyMigrated = 0;
        var users = await db.Utilisateurs
            .Where(u => u.Utiadm == "1" || u.Utirole != null)
            .ToListAsync(ct);

        foreach (var u in users)
        {
            var role = u.Utirole?.Trim();
            var shouldMigrate =
                string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase) ||
                (string.IsNullOrEmpty(role) && u.Utiadm == "1");

            if (shouldMigrate)
            {
                u.Utirole = PermissionCatalog.Roles.Administrator;
                u.Utiadm = "1";
                legacyMigrated++;
            }
            else if (PermissionCatalog.IsAdminRole(role))
            {
                // Cohérence : Administrator → Utiadm=1.
                if (u.Utiadm != "1")
                {
                    u.Utiadm = "1";
                    legacyMigrated++;
                }
            }
        }
        if (legacyMigrated > 0) await db.SaveChangesAsync(ct);

        return new SeedReport(rolesCreated, rolesUpdated, permsCreated, legacyMigrated);
    }
}
