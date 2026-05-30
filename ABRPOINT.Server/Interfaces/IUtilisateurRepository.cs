using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface IUtilisateurRepository : IRepository<Utilisateur>
    {
        Task<UtilisateurDto> GetUtilisateurAsync(string uticod);
        Task<bool> UpdateUserAsync(UtilisateurUpdate utilisateur, string? soccod = null, string? sitcod = null, string? sercod = null);
        Task<List<string>> GetSitcodsAccessAsync(string soccod, string uticod);
        Task<List<Utilisateur>> GetAllUsersAsync(string soccod,string uticod);
        Task<UtiProfile?> GetProfileAsync(string soccod,string uticod);
        Task<bool> ChangePasswordAsync(UpdatePassword pwd);
        Task UpdateProfileImageAsync(string? userId, string filePath);
        Task AddAsync(Utilisateur utilisateur, Socuser socuser);
        Task<bool> DeleteUtilisateurAsync(string uticod);
        Task<bool> ResetPasswordAsync(string uticod, string newPassword);
        Task<bool> ToggleStatusAsync(string uticod);
        Task<string?> GetRoleByUticodAsync(string uticod);
        Task UpdateRoleAsync(string uticod, string newRole);
        /// <summary>
        /// Promeut un utilisateur au rôle Administrator (et flag legacy Utiadm="1").
        /// No-op silencieux si l'uticod n'existe pas. Idempotent : ré-applique la
        /// même valeur sans erreur si déjà admin.
        /// </summary>
        Task PromoteToAdminAsync(string uticod);
        Task<List<string>> GetAdminsEmailsAsync();
    }
}
