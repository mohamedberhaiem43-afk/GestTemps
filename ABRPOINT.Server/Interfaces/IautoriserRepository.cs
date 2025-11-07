using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface IautoriserRepository : IRepository<Autoriser>
    {
        Autoriser GetByConcod(string soccod, string concod);
        Task<List<AutoriserEmployeDto>> GetAutoriserWithAbsenceAsync(string soccod, string uticod);
        Task AddMultipleAutorisation(List<Autoriser> autorisers);
        Task<AutDto?> GetAutLib(string? soccod, string? empcod, DateTime dmdate);
        Task<IEnumerable<Autoriser>>GetAllAsync(string? soccod, string? uticod);
    }
}
