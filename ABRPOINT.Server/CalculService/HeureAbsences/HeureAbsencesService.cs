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

                    // Détection d'un shift entièrement non pointé. Sur un poste à plages
                    // séparées (matin + après-midi), si l'employé n'a pointé QUE le matin
                    // (ou QUE l'après-midi), les heures de la plage manquée doivent
                    // remonter en absence — peu importe le seuil de tolérance ci-dessous,
                    // qui était calibré pour filtrer les variations de ponctualité.
                    // Sans cette détection, après un ajustement de pointage qui efface
                    // la plage AM (ex. 4h matin / 3h aprem), Tothabs restait à 00:00.
                    //
                    // ⚠ Garde-fou (correctif 2026-05-12) : on ne déclenche la détection
                    // QUE si les heures travaillées effectives sont strictement < à la
                    // durée planifiée du jour. Cas concret : un employé pointe 07:16 et
                    // sort à 17:00 sans saisir séparément entrée/sortie AM (pointage
                    // continu) — son Tothre couvre déjà toute la journée, donc aucune
                    // plage n'est "manquée". Sans ce garde, on créditait 3h d'absence
                    // factice sur l'AM "vide" alors qu'il était clairement présent.
                    var posteEntity = await _posteRepository.GetPoste(soccod, poste);
                    if (posteEntity != null && date.HasValue && hreTravValue + 0.01f < maxhrejour)
                    {
                        var (mStart, mEnd, eStart, eEnd) = GenericMethodes.GetStartsWorkDay(date, posteEntity);
                        bool hasMorningPunch = !string.IsNullOrEmpty(presence.Preentmatup) || !string.IsNullOrEmpty(presence.Presortmatup);
                        bool hasAfternoonPunch = !string.IsNullOrEmpty(presence.Preentamidiup) || !string.IsNullOrEmpty(presence.Presortamidiup);

                        float morningHours = 0f, afternoonHours = 0f;
                        if (TimeSpan.TryParse(mStart, out var ms) && TimeSpan.TryParse(mEnd, out var me))
                            morningHours = (float)(me > ms ? (me - ms).TotalHours : ((me + TimeSpan.FromHours(24)) - ms).TotalHours);
                        if (TimeSpan.TryParse(eStart, out var es) && TimeSpan.TryParse(eEnd, out var ee))
                            afternoonHours = (float)(ee > es ? (ee - es).TotalHours : ((ee + TimeSpan.FromHours(24)) - es).TotalHours);

                        float missedShiftHours = 0f;
                        if (!hasMorningPunch && morningHours > 0) missedShiftHours += morningHours;
                        if (!hasAfternoonPunch && afternoonHours > 0) missedShiftHours += afternoonHours;
                        if (missedShiftHours > 0)
                            return MathF.Max(0, missedShiftHours - authHoursCredit);
                    }

                    // Cas général : différence brute, en filtrant les variations < 15 min
                    // (anciennement 2h, trop laxiste — masquait des absences réelles
                    // d'1h à 2h sur des journées partielles).
                    float diff = maxhrejour - hreTravValue - authHoursCredit;
                    if (diff > 0.25f) return diff;
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
