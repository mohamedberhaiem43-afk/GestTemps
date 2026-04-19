using ABRPOINT.Server.Data;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Helpers
{
    public static class PermissionChecker
    {
        public static async Task<bool> HasPermissionAsync(ApplicationDbContext context, string userUticod, string moduleCode, string action)
        {
            if (string.IsNullOrEmpty(userUticod)) return false;

            // 1. Get user and their role
            var user = await context.Utilisateurs.AsNoTracking().FirstOrDefaultAsync(u => u.Uticod == userUticod);
            if (user == null) return false;

            // Admin has all permissions
            if (user.Utiadm == "1") return true;

            if (string.IsNullOrEmpty(user.Utirole)) return false;

            // 2. Map Module Code to RolePermission Label
            string moduleLabel = MapCodeToLabel(moduleCode);

            // 3. Check RolePermissions
            var permission = await context.RolePermissions
                .Include(rp => rp.Role)
                .FirstOrDefaultAsync(rp => rp.Role.RoleName == user.Utirole && rp.RpModule == moduleLabel);

            if (permission == null) return false;

            return action.ToLower() switch
            {
                "consult" => permission.RpConsult == "1",
                "add" => permission.RpAdd == "1",
                "modify" => permission.RpModify == "1",
                "delete" => permission.RpDelete == "1",
                _ => false
            };
        }

        private static string MapCodeToLabel(string code)
        {
            return code.ToLower() switch
            {
                "employe" => "Gestion Employés",
                "absence" => "Absences et Sanctions",
                "sanction" => "Absences et Sanctions",
                "pointeuse" => "Pointage et Temps",
                "etat_point" => "Pointage et Temps",
                "contrat" => "Contrats et Avenants",
                "emp_ctr" => "Contrats et Avenants",
                "conge" => "Gestion des Congés",
                "dem_conge" => "Gestion des Congés",
                "paie" => "Paie et Rémunération",
                "base" => "Données de Base",
                "param" => "Paramètres de Temps",
                "rapport" => "Rapports et Statistiques",
                "admin" => "Administration",
                _ => code // Return original if no mapping
            };
        }
    }
}
