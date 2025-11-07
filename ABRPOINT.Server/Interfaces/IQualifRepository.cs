using ABRPOINT.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Interfaces
{
    public interface IQualifRepository : IRepository<Qualif>
    {
        Qualif GetByQuafcod(string quacod);
        Dictionary<string, string> GetQuaLibs();
    }
}