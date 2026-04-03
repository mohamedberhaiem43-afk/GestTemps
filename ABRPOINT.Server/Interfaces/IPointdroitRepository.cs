using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface IPointdroitRepository
    {
        Task<List<PointdroitDto?>> GetPointdroit(string soccod, string uticod);
        Task<bool> UpdatePointdroit(List<Pointdroit> pointdroits);
    }
}
