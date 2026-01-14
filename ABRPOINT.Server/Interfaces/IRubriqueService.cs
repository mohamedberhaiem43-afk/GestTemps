using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface IRubriqueService:IRepository<RubriqueDto>
    {
        Task<IEnumerable<RubriqueDto>> GetAll(string soccod);
        Task<bool> AddRubrique(Rubrique rubrique);
        Task DeleteAsync(string soccod, string rubcod);
        Task<Rubrique> GetRubrique(string soccod, string rubcod);
        Task<bool> UpdateRubrique(Rubrique rubrique);
        Task<IEnumerable<RubriquePaireDto>> GetPaires(string soccod);
    }
}
