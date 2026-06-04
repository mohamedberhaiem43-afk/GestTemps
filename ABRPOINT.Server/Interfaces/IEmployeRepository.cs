using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface IEmployeRepository : IRepository<Employe>
    {

        Task AddAsync(Employe employe);
        Task<Employe> GetByEmpcod(string soccod, string empcod);
        /// <summary>Service (Sercod) du manager appelant ; null pour admin/RH (= pas de scoping).</summary>
        Task<string?> GetManagerServiceCodeAsync(string soccod, string uticod);
        Task<Dictionary<string, string>> GetEmpLibs(string soccod, string uticod, string? sitcod = null, string? sercod = null, string? dircod = null, string? empreg = null);
        Task<Dictionary<string, string>> GetFemmeLibs(string soccod, string uticod);
        Task<Dictionary<string?, EmployeStat>> GetStatistics(string soccod, string? uticod = null);
        Task<IList<EmployeePresenceDto>> GetBySitcodAndDircod(string soccod, string uticod, string site, List<string>? empcods = null, string? empreg = null,
                                                                           string? service = null, DateTime? debut = null, DateTime? fin = null);
        Task<Dictionary<string, int>> GetEmployeeCountBySexAsync(string soccod, string? uticod = null);
        Task<EmpEtatConge> GetEmpEtatConge(string soccod, string empcod, string moisdeb, string moisfin, string annee);
        Task<IEnumerable<EmployeDto>> GetAllAsync(string soccod, string uticod);
        Task<IEnumerable<EmpHoraireDto>> GetEmployesHoraire(string soccod, string empcod);
        Task<(TimeSpan? Debut, TimeSpan? Fin)> GetEmpNuitIntervalle(string soccod, string empcod);
        Task<string> GetEmpReg(string soccod, string empcod);
        Task<EmpRegNiveau> GetEmpRegNiveau(string soccod, string empcod);
        Task<string?> GetEmpPoste(string soccod, string empcod,DateTime? date);
        Task<bool> GetEmpRetard(string? soccod, string? empcod);
        Task AddMultipleEmploye(List<Employe> employe);
        Task<List<EmpDepassMxHre>> GetEmployesDepassantMaxHeure(string soccod,string uticod);
        Task<Employe> UpdateEmployeAsync(Employe employe);
        Task<string> GetByEmpMat(string user_id);
        Task<(bool Success, string Message)> DeleteEmployeAsync(Employe employe);
        Task<string?> GetEmpPanier(string soccod,string empcod);
        Task<Dictionary<DateTime, string>> GetEmpPostesByPeriod(string soccod, string empcod, DateTime startDate, DateTime endDate);
        Task<EmpparamPointageMois> GetEmpparam(string soccod, string empcod, DateTime date,string codpost);
        Task<IEnumerable<Employe>> GetByEmpLib(string soccod, string name);
        Task<List<Employe>> SearchByTerms(string soccod, List<string> terms);
        Task<List<Employe>> GetEmpMatList(string soccod, string term);
        Task<EmployeeKpiDto> GetMyKPIs(string soccod, string uticod);
    }
}
