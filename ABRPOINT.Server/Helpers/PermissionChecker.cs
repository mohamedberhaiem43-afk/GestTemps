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
                // Gestion Employés
                "employe" => "Gestion Employés",
                "emp_allait" => "Gestion Employés",

                // Absences et Sanctions
                "absence" => "Absences et Sanctions",
                "sanction" => "Absences et Sanctions",
                "emp_abs" => "Absences et Sanctions",
                "emp_aut" => "Absences et Sanctions",
                "tout_auto" => "Absences et Sanctions",

                // Pointage et Temps
                "pointeuse" => "Pointage et Temps",
                "etat_point" => "Pointage et Temps",
                "etat_period" => "Pointage et Temps",
                "ppimp" => "Pointage et Temps",

                // Contrats et Avenants
                "contrat" => "Contrats et Avenants",
                "emp_ctr" => "Contrats et Avenants",

                // Gestion des Congés
                "conge" => "Gestion des Congés",
                "dem_conge" => "Gestion des Congés",
                "frm_conge" => "Gestion des Congés",
                "tout_conge" => "Gestion des Congés",
                "frm_dcong" => "Gestion des Congés",

                // Paie et Rémunération
                "paie" => "Paie et Rémunération",

                // Données de Base
                "base" => "Données de Base",
                "frm_ferie" => "Données de Base",

                // Paramètres de Temps
                "param" => "Paramètres de Temps",
                "poste" => "Paramètres de Temps",

                // Rapports et Statistiques
                "rapport" => "Rapports et Statistiques",
                "etat_ret" => "Rapports et Statistiques",
                "etat_mens" => "Rapports et Statistiques",
                "etat_abs" => "Rapports et Statistiques",
                "etat_conge" => "Rapports et Statistiques",
                "ech_ctr" => "Rapports et Statistiques",
                "dec_conge" => "Rapports et Statistiques",

                // Administration
                "admin" => "Administration",

                _ => code // Return original if no mapping
            };
        }
    }
}
