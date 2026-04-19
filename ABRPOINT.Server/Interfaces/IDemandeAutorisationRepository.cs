using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface IDemandeAutorisationRepository
    {
        Task<List<DemandeAutorisationDto>> GetAllBySocieteAsync(string soccod, string uticod);
        Task<List<DemandeAutorisationDto>> GetByEmployeAsync(string soccod, string empcod);
        Task<DemandeAutorisation?> GetByIdAsync(int id);
        Task<DemandeAutorisation> AddAsync(DemandeAutorisation demande);
        Task<DemandeAutorisation?> UpdateAsync(DemandeAutorisation demande);
        Task<bool> DeleteAsync(int id);
        Task<(bool Success, string Message)> ApproveAsync(int id, string traitePar, string? commentaire);
        Task<(bool Success, string Message)> RefuseAsync(int id, string traitePar, string? commentaire);
    }
}