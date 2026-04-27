using ABRPOINT.Helper;
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

                // Authorized absence credit. When unpaid (Abspayer != "O"), auth hours are NOT in Tothre,
                // so we must subtract them here to avoid double-counting them as absence.
                // When paid, Tothre already includes auth hours via CalcHreTrav, so no extra subtraction.
                float authHoursCredit = 0f;
                if (autorisation?.Condep != null && autorisation?.Conret != null && autorisation.Abspayer != "O")
                {
                    authHoursCredit = (float)(autorisation.Conret.Value - autorisation.Condep.Value).TotalHours;
                    if (authHoursCredit < 0) authHoursCredit = 0;
                }

                if (presence == null || presence.Tothre == "00:00" || GenericMethodes.NotPresent(presence))
                {
                    float dayHours = (float)(await _posteRepository.GetJourHeures(soccod, date, poste) ?? 0);
                    return MathF.Max(0, dayHours - authHoursCredit);
                }
                else if(presence != null /*&& presence.Prerepos == "0"*/)
                {
                    var conge = await _congeRepository.GetEmpCongeByDateAsync(soccod, presence.Empcod, (DateTime) date);
                    if (conge?.Connbjour == 1)
                        return 0;
                    else if (conge?.Connbjour == 0.5)
                    {
                        maxhrejour /= 2;
                        return MathF.Max(0, maxhrejour - hreTravValue - authHoursCredit);
                    }
                    float diff = maxhrejour - hreTravValue - authHoursCredit;
                    if (diff > 2) return diff;
                    return 0;
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
