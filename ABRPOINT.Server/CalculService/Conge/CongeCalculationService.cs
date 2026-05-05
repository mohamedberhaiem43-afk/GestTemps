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
                var nbjourCng = await _congeRepository.GetNbJourEtHreEmpCongeAsync(soccod,empcod,predat,codpost);
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

        // Constantes loi française (Code du travail, article L. 3141-3) :
        // 5 semaines de congés payés × 6 jours ouvrables = 30 jours / an = 2,5 j / mois.
        private const double FRENCH_LEGAL_DAYS_PER_YEAR = 30.0;
        private const double DEFAULT_WORKING_DAYS_PER_MONTH = 26.0; // jours ouvrables fallback
        private const double DEFAULT_HOURS_PER_MONTH = 208.0;       // 26 × 8
        private const double DEFAULT_HOURS_PER_DAY = 8.0;

        private async Task<object> Calc_solde_conge(string soccod, string empcod, string moisdeb, string moisfin, string annee)
        {
            double droitConge = 0;
            double droitmensuelle = 0;
            double sa = 0;
            int anciente = 0;
            float congeRecue = 0;
            int parecart = 5;

            // 🟢 Initial balance from the 'solde' table (report N-1 + saisie admin éventuelle)
            var soldeEntry = await _dbContext.Soldes.FirstOrDefaultAsync(s => s.Soccod == soccod && s.Empcod == empcod);
            if (soldeEntry != null)
            {
                droitConge = soldeEntry.Conge ?? 0;
            }

            var employe = await _dbContext.Employes.FirstOrDefaultAsync(e => e.Soccod == soccod && e.Empcod == empcod);
            // Tolérant : si l'employé ou la date d'embauche manque, on retourne un état vide
            // au lieu de jeter (cassait l'écran KPI dès qu'un employé n'avait pas de date).
            if (employe == null || employe.Empemb == null)
                return new { anciente = 0, cm = 0.0, droitConge = 0.0, sa = 0.0 };

            string caltype = employe.Caltype;
            var site = await _siteRepository.GetBySitcodAsync(soccod, employe.Sitcod);

            // 🟢 Droit annuel : on prend la config Site (Sitconge) si fournie, sinon on
            // applique le minimum légal français de 30 jours ouvrables (2,5 j/mois).
            double droitAnnuel = (site?.Sitconge.HasValue == true && site.Sitconge.Value > 0)
                ? (double)site.Sitconge.Value
                : FRENCH_LEGAL_DAYS_PER_YEAR;
            double cm = droitAnnuel / 12.0;

            // Ancienneté : ignorée si la convention site la "sanctionne" pour ce type d'employé.
            if (site != null && (
                (site.Sitsancm == "1" && employe.Empreg == "M") ||
                (site.Sitsanch == "1" && employe.Empreg == "H")))
            {
                anciente = 0;
            }
            else
            {
                anciente = int.Parse(annee) - employe.Empemb.Value.Year;
                if (anciente != 0 && employe.Empemb.Value.AddYears(anciente) > new DateTime(int.Parse(annee), 1, 1))
                    anciente--;
            }

            // Bonus ancienneté (convention) : 1 jour supplémentaire tous les `parecart` ans.
            if (anciente > 0)
            {
                parecart = await _parametreRepository.GetParancempAsync(soccod);
                if (parecart > 0)
                    droitConge += Math.Floor((double)anciente / parecart);
            }

            int targetYear = int.Parse(annee);

            // 🟢 Mois de démarrage de l'acquisition. Année antérieure à l'embauche → aucun droit.
            int startMonth = 1;
            int hireDayInStartMonth = 1;
            if (employe.Empemb.Value.Year == targetYear)
            {
                startMonth = employe.Empemb.Value.Month;
                hireDayInStartMonth = employe.Empemb.Value.Day;
            }
            else if (employe.Empemb.Value.Year > targetYear)
            {
                return new { anciente = 0, cm, droitConge = 0.0, sa = 0.0 };
            }

            // Mois de sortie éventuelle : pas de droit acquis après la date de sortie.
            int? exitMonth = null;
            if (employe.Empsort.HasValue && employe.Empsort.Value.Year == targetYear)
            {
                exitMonth = employe.Empsort.Value.Month;
            }
            else if (employe.Empsort.HasValue && employe.Empsort.Value.Year < targetYear)
            {
                return new { anciente, cm, droitConge = 0.0, sa = 0.0 };
            }

            int finalMonth = int.Parse(moisfin.TrimStart('0'));

            for (int i = 0; i < finalMonth; i++)
            {
                int currentMonthInt = i + 1;
                string currentMonth = currentMonthInt.ToString("D2");

                // Cumul des congés déjà reçus / posés (déduit du droit en fin de calcul).
                float nbConge = await _congeRepository.GetNbCongeRecueAsync(soccod, empcod, annee, currentMonth);
                if (!float.IsInfinity(nbConge) && !float.IsNaN(nbConge))
                    congeRecue += nbConge;

                // Pas d'acquisition avant le mois d'embauche ni après la sortie.
                if (currentMonthInt < startMonth) continue;
                if (exitMonth.HasValue && currentMonthInt > exitMonth.Value) continue;

                var calendsoc = await _calendrierRepository.GetCalendrierAsync(soccod, annee, currentMonth, caltype);

                // Fallbacks conformes à la loi : si le calendrier n'est pas configuré,
                // on suppose un mois standard (26 jours ouvrables, 208h/8h par jour).
                double nbjourt = (calendsoc?.CalTrav ?? 0) > 0 ? (double)calendsoc!.CalTrav! : DEFAULT_WORKING_DAYS_PER_MONTH;
                double nbheuret = (calendsoc?.CalNbh ?? 0) > 0 ? (double)calendsoc!.CalNbh! : DEFAULT_HOURS_PER_MONTH;
                double nbheurejour = (calendsoc?.CalHjour ?? 0) > 0 ? (double)calendsoc!.CalHjour! : DEFAULT_HOURS_PER_DAY;

                // Pro-rata du mois d'embauche : (jours restants après embauche) / total mois.
                // Permet à un salarié embauché le 15 d'un mois de 30 jours d'acquérir
                // ~50 % du droit mensuel pour ce mois — règle la plus fréquente en France.
                double prorataMoisEmbauche = 1.0;
                if (currentMonthInt == startMonth && hireDayInStartMonth > 1)
                {
                    int daysInMonth = DateTime.DaysInMonth(targetYear, currentMonthInt);
                    prorataMoisEmbauche = Math.Max(0.0, (daysInMonth - hireDayInStartMonth + 1.0) / daysInMonth);
                }

                // Pro-rata du mois de sortie : (jours travaillés avant sortie) / total mois.
                double prorataMoisSortie = 1.0;
                if (exitMonth.HasValue && currentMonthInt == exitMonth.Value && employe.Empsort.HasValue)
                {
                    int daysInMonth = DateTime.DaysInMonth(targetYear, currentMonthInt);
                    prorataMoisSortie = Math.Max(0.0, (double)employe.Empsort.Value.Day / daysInMonth);
                }

                // Jours travaillés effectifs = jours ouvrables - absences sanctionnantes.
                double absences = await calc_absences_par_mois(soccod, currentMonth, annee, empcod);
                double nbtravmois = Math.Max(0, nbjourt - absences);

                double creditMois;
                if (employe.Empreg == "H" && nbheuret != 0)
                {
                    creditMois = (nbtravmois * nbheurejour * cm) / nbheuret;
                }
                else if (nbjourt != 0)
                {
                    creditMois = (nbtravmois * cm) / nbjourt;
                }
                else
                {
                    creditMois = 0;
                }

                droitmensuelle += creditMois * prorataMoisEmbauche * prorataMoisSortie;
            }

            // Le bonus d'ancienneté ne s'applique qu'au-delà du palier (loi convention).
            if (anciente < parecart) anciente = 0;

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
        