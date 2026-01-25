using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface IEmployeRepository : IRepository<Employe>
    {
        IEnumerable<Employe> GetAll(string? soccod, string uticod);
        Task AddAsync(Employe employe);
        Task<Employe> GetByEmpcod(string soccod, string empcod);
        Task<Dictionary<string, string>> GetEmpLibs(string soccod, string uticod);
        Task<Dictionary<string, string>> GetFemmeLibs(string soccod, string uticod);
        Task<Dictionary<string?, EmployeStat>> GetStatistics(string soccod);
        Task<IList<EmployeePresenceDto>> GetBySitcodAndDircod(string soccod, string uticod, string site, List<string>? empcods = null, string? empreg = null,
                                                                           string? service = null, DateTime? debut = null, DateTime? fin = null);
        Task<Dictionary<string, int>> GetEmployeeCountBySexAsync(string soccod);
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
        Task<Employe> UpdateAsync(Employe employe);
        Task<string> GetByEmpMat(string user_id);
        Task<(bool Success, string Message)> DeleteAsync(Employe employe);
        Task<string?> GetEmpPanier(string soccod,string empcod);
        Task<Dictionary<DateTime, string>> GetEmpPostesByPeriod(string soccod, string empcod, DateTime startDate, DateTime endDate);
        Task<EmpparamPointageMois> GetEmpparam(string soccod, string empcod);
    }
}
