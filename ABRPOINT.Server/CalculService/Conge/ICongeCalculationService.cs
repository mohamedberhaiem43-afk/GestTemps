using ABRPOINT.Server.Dtaos;

namespace ABRPOINT.Server.CalculService.Conge
{
    public interface ICongeCalculationService
    {
        public Task<NombreConge> CalculerNbJourAndHreCongePaye(string soccod,string empcod,DateTime? predat,string codpost);
        Task<EmpEtatConge> GetEmpEtatCongeAsync(string soccod, string empcod, string moisdeb, string moisfin, string annee);
    }
}
