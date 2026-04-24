using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface ISocieteRepository : IRepository<Societe>
    {
        Task<Societe?> GetBySoccodAsync(string soccod);
        Task<SocHeures> GetSocHeuresAsync(string soccod);
        Task<Dictionary<string, string>> GetSoclibsAsync();
        Task<bool> UpdateSocieteAsync(Societe societe);
        Task<bool> UpdateSocHeuresAsync(string soccod,string socpresence,string sochsup);
        Task UpdateSocieteImageAsync(string? soccod, string filePath);
    }
}
