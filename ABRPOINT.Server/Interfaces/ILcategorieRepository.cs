using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface ILcategorieRepository : IRepository<Lcategorie>
    {
        Task<Lcategorie> GetByNumOrdre(string soccod, int numOrdre);
        IEnumerable<LcategorieDto> Getlcat(string soccod, string catperiode);
        Task<Dictionary<string, string>> GetHorLibs(string soccod);
        Task<IEnumerable<Categorie>> GetcatAsync(string soccod, string catcod);
        Task<string?> GetCathsup(string soccod,string empcod);
        Task UpdateAsync(LcategorieDto lcategorie);
        Task AddAsync(LcategorieDto absence);
        Task DeleteAsync(LcategorieDto lcategorie);
        Task<string?> GetCatcodByEmp(string soccod, string empcod, DateTime? date);
    }
}
