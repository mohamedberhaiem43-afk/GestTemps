using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface IRubriqueService:IRepository<RubriqueDto>
    {
        Task<IEnumerable<RubriqueDto>> GetAllAsync(string soccod);
        Task<bool> AddRubriqueAsync(Rubrique rubrique);
        Task DeleteAsync(string soccod, string rubcod);
        Task<Rubrique?> GetRubriqueAsync(string soccod, string rubcod);
        Task<bool> UpdateRubriqueAsync(Rubrique rubrique);
        Task<IEnumerable<RubriquePaireDto>> GetPairesAsync(string soccod);
    }
}
