using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface IPosteRepository : IRepository<Poste>
    {
        Task<Poste?> GetPoste(string soccod, string? codposte);
        Task<Dictionary<string, string>> GetPostLibs(string soccod);
        Task<float?> GetJourHeures(string soccod,DateTime? date,string? codposte);
        Task<PosteHoraireDto?> GetPosteHoraire(string soccod, string codposte, string catcod);
        Task AddAsync(Poste poste);
        Task UpdateAsync(Poste poste);
        Task<bool> isExisting(string? soccod, string? codposte);
        Task DeleteAsync(Poste poste);
        Task<string?> GetEmpPoste(string soccod, string empcod, DateTime? date);
        Task<PosteHoraireDto?> GetAllPostes(string soccod, string codposte);
        Task<Dictionary<string, string?>> GetEmpPosteBatch(string soccod, List<(string Empcod, DateTime Date)> demandes);
        //Task<Dictionary<string, Poste>> GetPostesBatch(string soccod, object value);
        Task<Dictionary<string, Poste>> GetPostesBatch(string soccod, List<string> codPostes);
        Task<Dictionary<(string Empcod, DateTime Date), string?>> GetEmployePosteBatch(string soccod, string Empcod, DateTime debut,DateTime fin);


     }
}
