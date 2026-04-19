using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.CalculService.Conge
{
    public class CongeCalculationService : ICongeCalculationService
    {
        private readonly ICongeRepository _congeRepository;
        private readonly ISiteRepository _siteRepository;
        private readonly ICalendrierRepository _calendrierRepository;
        private readonly IParametreRepository _parametreRepository;
        private readonly ApplicationDbContext _dbContext;

        public CongeCalculationService(
            ICongeRepository congeRepository,
            ISiteRepository siteRepository,
            ICalendrierRepository calendrierRepository,
            IParametreRepository parametreRepository,
            ApplicationDbContext dbContext)
        {
            _congeRepository = congeRepository;
            _siteRepository = siteRepository;
            _calendrierRepository = calendrierRepository;
            _parametreRepository = parametreRepository;
            _dbContext = dbContext;
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

        public async Task<EmpEtatConge> GetEmpEtatCongeAsync(string soccod, string empcod, string moisdeb, string moisfin, string annee)
        {
            try
            {
                dynamic result = await Calc_solde_conge(soccod, empcod, moisdeb, moisfin, annee);

                double cm = double.IsFinite((double)result.cm) ? (double)result.cm : 0;
                double anciente = double.IsFinite((double)result.anciente) ? (double)result.anciente : 0;
                double droitConge = double.IsFinite((double)result.droitConge) ? (double)result.droitConge : 0;
                double sa = double.IsFinite((double)result.sa) ? (double)result.sa : 0;

                EmpEtatConge empEtatConge = new EmpEtatConge(
                    CustomRound(cm),
                    (int)Math.Round(anciente),
                    CustomRound(droitConge),
                    CustomRound(sa)
                );

                return empEtatConge;
            }
            catch (Exception ex)
            {
                throw new Exception("Erreur innatendu lors du calcul du solde: ", ex);
            }
        }

        private async Task<object> Calc_solde_conge(string soccod, string empcod, string moisdeb, string moisfin, string annee)
        {
            double droitConge = 0;
            double nbheuret = 208;
            double nbjourt = 26;
            double nbheurejour = 8;
            double droitmensuelle = 0;
            double nbtravmois = 0;
            double sa = 0;
            int anciente = 0;
            float congeRecue = 0;
            int parecart = 5;

            var employe = await _dbContext.Employes.FirstOrDefaultAsync(e => e.Soccod == soccod && e.Empcod == empcod);
            if (employe == null || employe.Empemb == null)
                throw new ArgumentNullException("Données employé ou date d'embauche manquantes");

            string caltype = employe.Caltype;
            var site = _siteRepository.GetBySitcod(soccod, employe.Sitcod);
            if (site == null)
                throw new ArgumentNullException("Données site manquantes");

            double cm = site.Sitconge.HasValue ? (double)site.Sitconge.Value / 12 : 0;

            if ((site.Sitsancm == "1" && employe.Empreg == "M") ||
                (site.Sitsanch == "1" && employe.Empreg == "H"))
                anciente = 0;
            else
            {
                anciente = int.Parse(annee) - employe.Empemb.Value.Year;
                if (anciente != 0 &&employe.Empemb.HasValue && employe.Empemb.Value.AddYears(anciente) > new DateTime(int.Parse(annee), 1, 1))
                    anciente--;
            }

            if (anciente != 0)
            {
                parecart = await _parametreRepository.GetParancemp(soccod);
                droitConge += Math.Floor((double)anciente / parecart);
            }

            for (int i = 0; i < int.Parse(moisfin.TrimStart('0')); i++)
            {
                string currentMonth = (i + 1).ToString("D2");
                var calendsoc = await _calendrierRepository.GetCalendrier(soccod, annee, currentMonth, caltype);
                float nbConge = await _congeRepository.GetNbCongeRecue(soccod, empcod, annee, currentMonth);

                if (!float.IsInfinity(nbConge) && !float.IsNaN(nbConge))
                {
                    congeRecue += nbConge;
                }

                if (calendsoc != null)
                {
                    nbheuret = (double)calendsoc.CalNbh;
                    nbjourt = (double)calendsoc.CalTrav;
                    nbheurejour = (double)calendsoc.CalHjour;

                    nbtravmois = Math.Max(0, nbjourt - await calc_absences_par_mois(soccod, currentMonth, annee, empcod));

                    if (employe.Empreg == "M" && nbjourt != 0)
                        droitmensuelle += (nbtravmois * cm) / nbjourt;
                    else if (employe.Empreg == "H" && nbheuret != 0)
                        droitmensuelle += (nbtravmois * nbheurejour * cm) / nbheuret;
                }
            }

            if (anciente < parecart)
                anciente = 0;

            droitConge += droitmensuelle;
            sa = droitConge - congeRecue;

            return new { anciente, cm, droitConge, sa };
        }

        private async Task<double> calc_absences_par_mois(string soccod, string mois, string annee, string empcod)
        {
            double nbjabsence = 0;
            int anneeInt = int.Parse(annee);
            int moisInt = int.Parse(mois);
            DateTime wcng_deb = new DateTime(anneeInt, moisInt, 1);
            DateTime wcng_fin = wcng_deb.AddMonths(1).AddDays(-1);

            nbjabsence = await _dbContext.Sanctions
                .Where(s => s.Soccod == soccod && s.Empcod == empcod && s.Condep >= wcng_deb && s.Condep <= wcng_fin)
                .SumAsync(s => (double)(s.Connbjour ?? 0));

            return nbjabsence;
        }

        private double CustomRound(double value)
        {
            return Math.Round(Math.Ceiling(value), 2);
        }
    }
}
        