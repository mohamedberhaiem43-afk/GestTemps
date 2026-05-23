using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface IautoriserRepository : IRepository<Autoriser>
    {
        Task<Autoriser?> GetByConcodAsync(string soccod, string concod);
        Task<List<AutoriserEmployeDto>> GetAutoriserWithAbsenceAsync(string soccod, string uticod);
        Task AddMultipleAutorisation(List<Autoriser> autorisers);
        Task<AutDto?> GetAutLib(string? soccod, string? empcod, DateTime dmdate);
        Task<IEnumerable<Autoriser>>GetAllAsync(string? soccod, string? uticod);
        Task<Dictionary<(string Empcod, DateTime Date), AutDto?>> GetAutLibBatch(string soccod, string empcod, DateTime dateDeb, DateTime dateFin);
        Task<Dictionary<(string Empcod, DateTime Date), AutDto>> GetAutLibBatch(string soccod, List<(string Empcod, DateTime Date)> demandes);
        Task<List<AutDto>> GetAutorisationsByPeriod(string soccod, string empcod, DateTime startDate, DateTime endDate);

        /// <summary>
        /// Charge en une requête l'état des demandes d'heures supplémentaires
        /// (lignes <c>autoriser</c> portant le marker <c>[HEURES SUP]</c> dans
        /// <c>conmotif</c>) d'un employé sur une plage de dates. La clé du
        /// dictionnaire est la date du jour concerné (<c>condep.Date</c>), et la
        /// valeur cumule les heures par état (Approved/Pending/Rejected) pour ce
        /// jour. Les lignes sans <c>conetat</c> sont considérées "Pending"
        /// (legacy, cf. <see cref="ABRPOINT.Server.Models.Autoriser.Conetat"/>).
        /// </summary>
        Task<Dictionary<DateTime, OvertimeApprovalSummary>> GetOvertimeApprovalBatchAsync(
            string soccod, string empcod, DateTime startDate, DateTime endDate);
    }
}
