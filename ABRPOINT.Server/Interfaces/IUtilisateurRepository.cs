using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface IUtilisateurRepository : IRepository<Utilisateur>
    {
        void Add(Utilisateur utilisateur, Socuser socuser);
        Task<UtilisateurDto> GetUtilisateur(string uticod);
        Task<bool> UpdateUser(UtilisateurUpdate utilisateur);
        Task<List<string>> GetSitcodsAccess(string soccod, string uticod);
        Task<List<Utilisateur>> GetAllUsers(string soccod,string uticod);
        Task<UtiProfile> GetProfile(string uticod);
        Task<bool> ChangePassword(UpdatePassword pwd);
    }
}
