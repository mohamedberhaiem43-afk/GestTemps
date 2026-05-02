using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface IMissionRepository
    {
        Task<IEnumerable<Mission>> GetBySocAsync(string soccod);
        Task<IEnumerable<Mission>> GetByEmpAsync(string soccod, string empcod);
        Task<Mission?> GetByIdAsync(int id);
        Task AddAsync(Mission mission);
        Task UpdateAsync(Mission mission);
        Task DeleteAsync(int id);
        Task<bool> AbsenceCodeIsFormationMissionAsync(string soccod, string abscod);
    }
}
