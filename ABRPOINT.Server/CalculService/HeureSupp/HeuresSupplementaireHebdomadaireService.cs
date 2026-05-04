using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.CalculService.HeureSupp
{
    public class HeuresSupplementairesResultat
    {
        public float? NbhFerierTrv { get; set; }
        public float? NbhCalendSem { get; set; }
        public float? HeuresNormales { get; set; }
        public float? Retard { get; set; }
        public float? TotalAbsence { get; set; }
        public string? Caltype { get; set; }
        public float? HreNuits { get; set; }
        public int? NbNuits { get; set; }
        public float? HeuresSupTranche1 { get; set; }
        public float? HeuresSupTranche2 { get; set; }
        public float? HreSupSemaine { get; set; }
        public int? JourFerier { get; set; }
        public float? HeureFerier { get; set; }
        public int? NbJourFerier { get; set; }
        public float? HreFerieTrv { get; set; }
        public float? HreFerier { get; set; }
        public float? HreFerieTrv2 { get; set; }
        public float? HreAllaitement { get; set; }
        public float? NbJourPointer { get; set; }
        public float? NbJourCngPaye { get; set; }
        public float? NbHeureConge { get; set; }
        public float? Tothre { get; set; }
        public float? HeureRepos { get; set; }
        public int JourRepos { get; set; }
        public float? Deplacement { get; set; }
        public float? NbJours { get; set; }
        public float? Maladie { get; set; }
        public float? CT { get; set; }
        public float? FM { get; set; }
        public float? MAP { get; set; }
        public float? CSS { get; set; }
        public float? Absj { get; set; }
        public float? Absnj { get; set; }
        public float? Absnp { get; set; }
        public float? CSF { get; set; }
        public float? HCSF { get; set; }
        public float? ACT { get; set; }
        public int? Panier { get; set; }
        public float? JourSamediTrv { get; set; }
        public float? HreSamediTrv { get; set; }
        public IDictionary<string, string> WeekDetails { get; set; } = new Dictionary<string, string>();
        public DateTime? WeekStartDate { get; set; }
        public float? NbHeuresDebutCalcul { get; set; }
        public DateTime? WeekEndDate { get; set; }
        // Dates within this week for which no poste could be resolved (warning surfaced to UI).
        public List<DateTime> MissingPosteDates { get; set; } = new();
    }

    public class WeeklyPresenceComputation
    {
        public string? Caltype { get; set; }
        public float? CalendarHours { get; set; }
        public int FerierDays { get; set; }
        public float FerierHours { get; set; }
        public DateTime WeekStart { get; set; }
        public DateTime WeekEnd { get; set; }
        public PresenceSemaineData Presence { get; set; }
    }

    public class HeuresSupplementairesHebdomadairesService : IHeuresSupplementaireHebdomadairesService
    {
        private readonly IparTrancheRepository _parTrancheRepository;
        private readonly ICalendrierRepository _calendrierRepository;
        private readonly IEmployeRepository _employeRepository;
        private readonly IParametreRepository _parametreRepository;
        private readonly IOptimizedPresenceService _optimizedPresenceService;
        private readonly IPresenceRepository _presenceRepository;

        public HeuresSupplementairesHebdomadairesService(
            IparTrancheRepository parTrancheRepository,
            ICalendrierRepository calendrierRepository,
            IParametreRepository parametreRepository,
            IPresenceRepository presenceRepository,
            IEmployeRepository employeRepository,
            IOptimizedPresenceService optimizedPresenceService)
        {
            _parTrancheRepository = parTrancheRepository;
            _calendrierRepository = calendrierRepository;
            _parametreRepository = parametreRepository;
            _presenceRepository = presenceRepository;
            _employeRepository = employeRepository;
            _optimizedPresenceService = optimizedPresenceService;
        }

        public async Task<HeuresSupplementairesResultat> CalculerHeuresSupplementairesHebdomadaires(string soccod, string empcod, string mois, string annee, string semaine, string empreg, string empniveau)
        {
            try
            {
                var result = new HeuresSupplementairesResultat();

                // Get calendar hours for the week
                var (calend, hours, startDate, endDate, jourferier, heuresferier) =
                    await _optimizedPresenceService.GetNbHeuresParSemaineWithDates(soccod, mois, annee, semaine, empcod);

                result.NbhCalendSem = hours;
                result.WeekStartDate = startDate;
                result.WeekEndDate = endDate;
                result.JourFerier = jourferier;
                result.HeureFerier = heuresferier;
                result.Caltype = calend;

                // Get detailed presence/absence/conge data
                PresenceSemaineData res = await _optimizedPresenceService
                    .GetPresenceSemaineDataOptimized(soccod, empcod, mois, annee, semaine);
                var paramSupp = await _parametreRepository.GetSuppAndFerierParamAsync(soccod, empniveau);
                result.Panier = res.Panier;
                result.JourSamediTrv = res.JourSamediTrv;
                result.HreSamediTrv = res.HreSamediTrv;
                result.HreFerieTrv = Math.Min(res.NbhFerierTrv ?? 0, (await _parametreRepository.GetSuppAndFerierParamAsync(soccod, empniveau)).MaxFerier ?? 0);
                result.HreFerieTrv2 = (res.NbhFerierTrv ?? 0) - (result.HreFerieTrv ?? 0);
                result.NbJourFerier = res.NbJourFerier;
                result.HreFerier = res.HreFerier;
                result.HreAllaitement = res.NbhAllaitement;
                result.NbJourPointer = res.NbJourPointer;
                result.NbJourCngPaye = res.NbJourCngPaye;
                result.NbHeureConge = res.NbHeureConge;
                result.HeureRepos = res.HeureRepos;
                result.JourRepos = res.JourRepos;
                result.Deplacement = res.Deplacement;
                result.NbJours = res.NbJours;
                result.CSF = res.CSF;
                result.MAP = res.MAP;
                result.Absj = res.Absj;
                result.Absnj = res.Absnj;
                result.CT = res.CT;
                result.CSS = res.CSS;
                result.Maladie = res.Maladie;
                result.ACT = res.ACT;
                result.HCSF = res.HCSF;
                result.Absnp = res.Absnp;
                result.WeekDetails = res.WeekDetails;
                result.MissingPosteDates = res.MissingPosteDates ?? new List<DateTime>();
                result.Retard = res.TotalRetards;
                result.NbNuits = res.NbNuits;
                result.HreNuits = res.HreNuits;
                result.TotalAbsence = res.TotalAbsence;
                result.Tothre = res.TotalHours;
                result.Tothre = res.TotalHours + res.HreFerier + res.NbHeureConge;
                if (empreg == "M")
                {
                    if (paramSupp.Parreptrv == "3")
                        result.Tothre -= res.ResHreSamediTrv - res.HreDimTrv;
                    else if (paramSupp.Parreptrv == "2")
                        result.Tothre -= res.HreDimTrv;
                    else if (paramSupp.Parreptrv == "0")
                        result.Tothre -= result.HeureRepos;
                }
                // Get par tranche info
                IList<Partranche> partranche = await _parTrancheRepository.GetPartranche(soccod);
                float? tranche1 = 0, taux1 = 0, tranche2 = 0, taux2 = 0;
                if (empreg == "H")
                {
                    var p = partranche.SingleOrDefault(t => t.Empreg == "H");
                    tranche1 = p?.Partranche1;
                    tranche2 = p?.Partranche2;
                    taux1 = p?.Partaux1;
                    taux2 = p?.Partaux2;
                }
                else
                {
                    var p = partranche.SingleOrDefault(t => t.Empreg == "M");
                    tranche1 = p?.Partranche1;
                    tranche2 = p?.Partranche2;
                    taux1 = p?.Partaux1;
                    taux2 = p?.Partaux2;

                    var param = await _parametreRepository.GetSuppAndFerierParamAsync(soccod, empniveau);
                    if (!param.HasSupp)
                    {
                        result.HeuresNormales = result.NbhCalendSem;
                        result.HreSupSemaine = 0;
                        result.HeuresSupTranche1 = 0;
                        result.HeuresSupTranche2 = 0;
                        return result;
                    }
                }

                // Calculate weekly overtime
                float? heuresTravaillees = res.TotalHours;
                float? heuresSupp = 0;
                result.Tothre = heuresTravaillees;
                result.HeuresNormales = result.Tothre - (res.HeureRepos + res.HreFerier);

                if (paramSupp.EliminerFerier == "1" && empreg == "H")
                {
                    result.HeuresNormales -= res.NbhFerierTrv;
                }

                if (result.HeuresNormales > result.NbhCalendSem)
                    heuresSupp = result.HeuresNormales - result.NbhCalendSem;

                if (paramSupp.EliminerFerier != "0" && empreg == "H")
                {
                    heuresSupp -= res.NbhFerierTrv;
                    heuresSupp = (float?)Math.Max(0, (double)heuresSupp);
                }
                result.HreSupSemaine = heuresSupp;
                result.Tothre += heuresSupp;
                result.HeuresSupTranche1 = Math.Min(heuresSupp ?? 0, tranche1 ?? 0);
                heuresSupp -= result.HeuresSupTranche1;
                result.HeuresSupTranche2 = Math.Min(heuresSupp ?? 0, tranche2 ?? 0);
                return result;
            }
            catch (Exception)
            {
                throw;
            }
        }


        public async Task<List<HeuresSupplementairesResultat>> CalculerHeuresSupplementairesMultiSemaines(
    string soccod, string empcod, string mois, string annee, string empreg, string empniveau)
        {
            try
            {
                var results = new List<HeuresSupplementairesResultat>();

                // Get parameters ONCE
                var paramSupp = await _parametreRepository.GetSuppAndFerierParamAsync(soccod, empniveau);

                // Get par tranche info ONCE
                IList<Partranche> partranche = await _parTrancheRepository.GetPartranche(soccod);
                float? tranche1 = 0, tranche2 = 0;

                if (empreg == "H")
                {
                    var p = partranche.SingleOrDefault(t => t.Empreg == "H");
                    tranche1 = p?.Partranche1;
                    tranche2 = p?.Partranche2;
                }
                else
                {
                    var p = partranche.SingleOrDefault(t => t.Empreg == "M");
                    tranche1 = p?.Partranche1;
                    tranche2 = p?.Partranche2;
                }
                // Check if employee has supp rights
                bool hasSupp = empreg == "H" || paramSupp.HasSupp;

                float totalNbJoursMois = 0;

                // Process each week (1 to 6)
                for (int i = 1; i <= 6; i++)
                {
                    var result = new HeuresSupplementairesResultat();
                    string semaine = i.ToString();

                    // Get calendar hours for this specific week
                    var (calend, hours, startDate, endDate, jourferier, heuresferier) =
                        await _optimizedPresenceService.GetNbHeuresParSemaineWithDates(
                            soccod, mois, annee, semaine, empcod);

                    // If week doesn't exist, skip
                    if (startDate == null || endDate == null)
                        break;

                    // 🆕 Stop processing weeks that haven't started yet — pas de "semaines fantômes"
                    // remplies de zéros (ou pire, comptées comme absences) pour des semaines
                    // entièrement dans le futur.
                    if (startDate.Value.Date > DateTime.Today)
                        break;

                    result.NbhCalendSem = hours;
                    result.WeekStartDate = startDate;
                    result.WeekEndDate = endDate;
                    result.JourFerier = jourferier;
                    result.HeureFerier = heuresferier;
                    result.Caltype = calend;

                    // ✅ Get presence data for THIS SPECIFIC WEEK
                    // La méthode GetPresenceSemaineDataOptimized charge automatiquement empparam en interne
                    var res = await _optimizedPresenceService
                        .GetPresenceSemaineDataOptimized(soccod, empcod, mois, annee, semaine);

                    // Map presence data to result
                    result.NbHeuresDebutCalcul = res.NbHeuresDebutCalcul;
                    result.Panier = res.Panier;
                    result.JourSamediTrv = res.JourSamediTrv;
                    result.HreSamediTrv = res.HreSamediTrv;
                    result.NbhFerierTrv = res.NbhFerierTrv;
                    result.HreFerieTrv = Math.Min(res.NbhFerierTrv ?? 0, paramSupp.MaxFerier ?? 0);
                    result.HreFerieTrv2 = (res.NbhFerierTrv ?? 0) - (result.HreFerieTrv ?? 0);
                    result.NbJourFerier = res.NbJourFerier;
                    result.HreFerier = res.HreFerier;
                    result.HreAllaitement = res.NbhAllaitement;
                    result.NbJourPointer = res.NbJourPointer;
                    result.NbJourCngPaye = res.NbJourCngPaye;
                    result.NbHeureConge = res.NbHeureConge;
                    result.HeureRepos = res.HeureRepos;
                    result.JourRepos = res.JourRepos;
                    result.Deplacement = res.Deplacement;
                    result.CSF = res.CSF;
                    result.MAP = res.MAP;
                    result.Absj = res.Absj;
                    result.Absnj = res.Absnj;
                    result.CT = res.CT;
                    result.CSS = res.CSS;
                    result.Maladie = res.Maladie;
                    result.ACT = res.ACT;
                    result.HCSF = res.HCSF;
                    result.Absnp = res.Absnp;
                    result.WeekDetails = res.WeekDetails;
                    result.MissingPosteDates = res.MissingPosteDates ?? new List<DateTime>();
                    result.Retard = res.TotalRetards;
                    result.NbNuits = res.NbNuits;
                    result.HreNuits = res.HreNuits;
                    result.TotalAbsence = res.TotalAbsence;
                    result.NbJours = res.NbJours;
                    result.Tothre = res.TotalHours + res.HreFerier + res.NbHeureConge;

                    // ✅ Récupérer empparam pour calculer Empmaxjour
                    var empparam = await _employeRepository.GetEmpparam(
                        soccod,
                        empcod,
                        startDate.Value,
                        null
                    );

                    float nbJoursSemaine = res.NbJours ?? 0;
                    if (empparam.Empmaxjour.HasValue && empparam.Empmaxjour.Value > 0)
                    {
                        float joursDisponibles = (float)empparam.Empmaxjour.Value - totalNbJoursMois;

                        if (joursDisponibles <= 0)
                        {
                            nbJoursSemaine = 0;
                        }
                        else if (nbJoursSemaine > joursDisponibles)
                        {
                            nbJoursSemaine = joursDisponibles;
                        }

                        totalNbJoursMois += nbJoursSemaine;
                    }
                    else
                    {
                        totalNbJoursMois += nbJoursSemaine;
                    }
                    result.NbJours = nbJoursSemaine;

                    if (empreg == "M" && result.Tothre != 0)
                    {
                        if (paramSupp.Parreptrv == "3")
                            result.Tothre -= res.ResHreSamediTrv - res.HreDimTrv;
                        else if (paramSupp.Parreptrv == "2")
                            result.Tothre -= res.HreDimTrv;
                        else if (paramSupp.Parreptrv == "0")
                            result.Tothre -= result.HeureRepos;
                    }

                    // Calculate overtime for this week
                    if (!hasSupp)
                    {
                        result.HeuresNormales = result.NbhCalendSem;
                        result.HreSupSemaine = 0;
                        result.HeuresSupTranche1 = 0;
                        result.HeuresSupTranche2 = 0;
                    }
                    else
                    {
                        float? heuresSupp = 0;

                        result.HeuresNormales = result.Tothre - res.HeureRepos;

                        if (paramSupp.EliminerFerier == "1" && empreg == "H")
                        {
                            result.HeuresNormales -= res.NbhFerierTrv;
                        }

                        if (result.NbHeuresDebutCalcul > result.NbhCalendSem)
                            heuresSupp = result.NbHeuresDebutCalcul - result.NbhCalendSem;

                        if (paramSupp.EliminerFerier != "0" && empreg == "H")
                        {
                            heuresSupp -= res.NbhFerierTrv;
                            heuresSupp = (float?)Math.Max(0, (double)heuresSupp);
                        }
                        if (paramSupp.MajNuitNorm == 0)
                            result.HeuresNormales -= result.HreNuits;
                        result.HreSupSemaine = heuresSupp;
                        result.HeuresSupTranche1 = Math.Min(heuresSupp ?? 0, tranche1 ?? 0);
                        heuresSupp -= result.HeuresSupTranche1;
                        result.HeuresSupTranche2 = Math.Min(heuresSupp ?? 0, tranche2 ?? 0);
                    }

                    // [HS DIAG] Log temporaire — à retirer une fois le calcul vérifié.
                    Console.WriteLine(
                        $"[HS DIAG] soccod={soccod} empcod={empcod} reg={empreg} niv={empniveau} " +
                        $"S{i} ({result.WeekStartDate:yyyy-MM-dd}→{result.WeekEndDate:yyyy-MM-dd}) " +
                        $"hasSupp={hasSupp} NbhCalendSem={result.NbhCalendSem} " +
                        $"NbHeuresDebutCalcul={result.NbHeuresDebutCalcul} Tothre={result.Tothre} " +
                        $"HreSupSemaine={result.HreSupSemaine} " +
                        $"Tr1={result.HeuresSupTranche1}/{tranche1} Tr2={result.HeuresSupTranche2}/{tranche2}"
                    );

                    results.Add(result);
                }

                return results;
            }
            catch (Exception)
            {
                throw;
            }
        }
    }
}
