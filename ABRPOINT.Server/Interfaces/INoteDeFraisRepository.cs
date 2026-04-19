using ABRPOINT.Server.Models;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace ABRPOINT.Server.Interfaces
{
    public interface INoteDeFraisRepository
    {
        Task<IEnumerable<NoteDeFrais>> GetAllBySoc(string soccod);
        Task<IEnumerable<NoteDeFrais>> GetByEmp(string soccod, string empcod);
        Task<NoteDeFrais?> GetById(int id);
        Task AddAsync(NoteDeFrais notedefrais);
        Task UpdateAsync(NoteDeFrais notedefrais);
        Task DeleteAsync(int id);
    }
}
