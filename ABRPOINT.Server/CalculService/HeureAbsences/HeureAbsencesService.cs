using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.CalculService.HeureAbsences
{
    public class HeureAbsencesService : IHeureAbsencesService
    {
        private readonly IPosteRepository _posteRepository;
        public HeureAbsencesService(IPosteRepository posteRepository)
        {
            _posteRepository = posteRepository;
        }
        public async Task<float?> CalculateHeureAbsences(Presence presence, string soccod, string? poste, DateTime? date,AutDto autorisation)
        {
			try
			{
				float hreabs = 0;
                if(presence == null || presence.Tothre == "00:00")
                {
                    return await _posteRepository.GetJourHeures(soccod, date, poste);
                }
                else if(presence != null && presence.Prerepos == "0")
                {
                    return await _posteRepository.GetJourHeures(presence.Soccod, date, presence.Codposte);
                }
                return hreabs;
            }
			catch (Exception)
			{
				throw;
			}
        }
    }
}
