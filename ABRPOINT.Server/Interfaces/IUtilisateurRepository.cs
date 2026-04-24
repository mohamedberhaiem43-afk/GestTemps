using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface IUtilisateurRepository : IRepository<Utilisateur>
    {
        Task<UtilisateurDto> GetUtilisateurAsync(string uticod);
        Task<bool> UpdateUserAsync(UtilisateurUpdate utilisateur);
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
        Task<List<string>> GetAdminsEmailsAsync();
    }
}
