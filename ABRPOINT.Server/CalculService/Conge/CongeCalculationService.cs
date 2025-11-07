using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;

namespace ABRPOINT.Server.CalculService.Conge
{
    public class CongeCalculationService : ICongeCalculationService
    {
        private readonly ICongeRepository _congeRepository;
        public CongeCalculationService(ICongeRepository congeRepository)
        {
            _congeRepository = congeRepository;
        }

        
        public async Task<NombreConge> CalculerNbJourAndHreCongePaye(string soccod, string empcod, DateTime? predat,string codpost)
        {
            try
            {
                var nbjourCng = await _congeRepository.GetNbJourEtHreEmpConge(soccod,empcod,predat,codpost);
                return nbjourCng;  
            }
            catch (Exception)
            {
                throw;
            }
        }
    }
}
        