using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.CalculService.HeureAbsences
{
    public class HeureAbsencesService : IHeureAbsencesService
    {
        private readonly IPosteRepository _posteRepository;
        private readonly ICongeRepository _congeRepository;
        public HeureAbsencesService(IPosteRepository posteRepository, ICongeRepository congeRepository)
        {
            _posteRepository = posteRepository;
            _congeRepository = congeRepository;
        }
        public async Task<float?> CalculateHeureAbsences(Presence presence, string soccod, string? poste,
            DateTime? date,AutDto? autorisation,float? hretrav)
        {
			try
			{
                float maxhrejour = (float)await _posteRepository.GetJourHeures(soccod, date, poste);
                float hreTravValue = hretrav ?? 0f;

                if (presence == null || presence.Tothre == "00:00")
                {
                    return await _posteRepository.GetJourHeures(soccod, date, poste);
                }
                else if(presence != null && presence.Prerepos == "0")
                {
                    var conge = await _congeRepository.GetEmpCongeByDate(soccod, presence.Empcod, (DateTime) date);
                    if (conge?.Connbjour == 1)
                        return 0;
                    else if (conge?.Connbjour == 0.5)
                    {
                        maxhrejour /= 2;
                        return MathF.Max(maxhrejour, maxhrejour - hreTravValue);
                    }
                    return MathF.Max(0f, maxhrejour - hreTravValue);
                }
                return maxhrejour;
            }
			catch (Exception)
			{
				throw;
			}
        }
    }
}
