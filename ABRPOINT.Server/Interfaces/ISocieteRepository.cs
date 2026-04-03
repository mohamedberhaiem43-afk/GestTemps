using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface ISocieteRepository : IRepository<Societe>
    {
        Societe GetBySoccod(string soccod);
        Task<SocHeures> GetSocHeures(string soccod);
        Task<Dictionary<string, string>> GetSoclibs();
        Task<bool> UpdateAsync(Societe societe);
        Task<bool> UpdateSocHeures(string soccod,string socpresence,string sochsup);
        Task UpdateSocieteImage(string? soccod, string filePath);
    }
}
