using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.CalculService.HeureSupp
{
    public class HeuresSupplementairesResultat
    {
        public float? NbhCalendSem { get; set; }
        public float? HeuresNormales { get; set; }
        public float? Retard { get; set; }
        public float? TotalAbsence { get; set; }
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
        public IDictionary<string,string> WeekDetails { get; set; }
        public DateTime? WeekStartDate { get; set; }
        public DateTime? WeekEndDate { get; set; }
    }

    public class HeuresSupplementairesHebdomadairesService : IHeuresSupplementaireHebdomadairesService
    {
        private readonly IparTrancheRepository _parTrancheRepository;
        private readonly ICalendrierRepository _calendrierRepository;
        private readonly IEmployeRepository _employeRepository;
        private readonly IParametreRepository _parametreRepository;
        private readonly IPresenceRepository _presenceRepository;
        public HeuresSupplementairesHebdomadairesService(IparTrancheRepository parTrancheRepository, ICalendrierRepository calendrierRepository,
                IParametreRepository parametreRepository, IPresenceRepository presenceRepository, IEmployeRepository employeRepository)
        {
            _parTrancheRepository = parTrancheRepository;
            _calendrierRepository = calendrierRepository;
            _parametreRepository = parametreRepository;
            _presenceRepository = presenceRepository;
            _employeRepository = employeRepository;
        }

        public async Task<HeuresSupplementairesResultat> CalculerHeuresSupplementairesHebdomadaires(string soccod, string empcod, string mois,
                                                                            string annee, string semaine, string empreg, string empniveau)
        {
            try
            {
                var result = new HeuresSupplementairesResultat();
                float? tranche1 = 0, taux1 = 0, tranche2 = 0, taux2 = 0, heuresTravaillees = 0;
                // Get hours with date range
                string? emppanier = await _employeRepository.GetEmpPanier(soccod,empcod);
                var (hours, startDate, endDate,jourferier,heuresferier,panier) = await _calendrierRepository
                    .GetNbHeuresParSemaineWithDates(soccod, mois, annee, semaine, empcod,emppanier);

                result.Panier = panier;
                result.NbhCalendSem = hours;
                result.WeekStartDate = startDate;
                result.WeekEndDate = endDate;
                result.JourFerier = jourferier;
                result.HeureFerier = heuresferier;
                PresenceSemaineData res = await _presenceRepository.GetPresenceSemaineData(soccod, empcod, mois, annee, semaine);
                SuppAndFerierParam param = await _parametreRepository.GetSuppAndFerierParam(soccod, empniveau);
                heuresTravaillees = res.TotalHours;
                var workDayHours = res.WorkDayHours;
                result.HreFerieTrv = Math.Min(res.NbhFerierTrv.Value, param.MaxFerier.Value);
                result.HreFerieTrv2 = res.NbhFerierTrv - result.HreFerieTrv;
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
                result.Retard = res.TotalRetards;
                result.NbNuits = res.NbNuits;
                result.HreNuits = res.HreNuits;
                result.TotalAbsence = res.TotalAbsence;
                IList<Partranche> partranche = await _parTrancheRepository.GetPartranche(soccod);
                if (empreg == "H")
                {

                    tranche1 = partranche.Where(t => t.Empreg == "H").SingleOrDefault()?.Partranche1;
                    taux1 = partranche.Where(t => t.Empreg == "H").SingleOrDefault()?.Partaux1;
                    tranche2 = partranche.Where(t => t.Empreg == "H").SingleOrDefault()?.Partranche2;
                    taux2 = partranche.Where(t => t.Empreg == "H").SingleOrDefault()?.Partaux2;
                }
                else
                {
                    tranche1 = partranche.Where(t => t.Empreg == "M").SingleOrDefault()?.Partranche1;
                    taux1 = partranche.Where(t => t.Empreg == "M").SingleOrDefault()?.Partaux1;
                    tranche2 = partranche.Where(t => t.Empreg == "M").SingleOrDefault()?.Partranche2;
                    taux2 = partranche.Where(t => t.Empreg == "M").SingleOrDefault()?.Partaux2;
                    if (!param.HasSupp)
                    {
                        result.HeuresNormales = result.NbhCalendSem;
                        result.HreSupSemaine = 0;

                        result.HeuresSupTranche1 = 0;

                        result.HeuresSupTranche2 = 0;
                        return result;

                    }
                }


                float? heuresSupp = 0;
                result.HeuresNormales = heuresTravaillees;
                result.Tothre = heuresTravaillees;
                result.HeuresNormales = result.Tothre - (res.HeureRepos + res.NbhFerierTrv);
                if (param.EliminerFerier == "1" && empreg == "H")
                {
                    result.HeuresNormales -= res.NbhFerierTrv;
                }
                if(result.HeuresNormales > result.NbhCalendSem)
                    heuresSupp = result.HeuresNormales - result.NbhCalendSem;

                if (param.EliminerFerier != "0" && empreg == "H")
                {
                    heuresSupp -= res.NbhFerierTrv;
                    heuresSupp = (float?)Math.Max(0, (double)heuresSupp);
                }

                result.HreSupSemaine = heuresSupp;
                result.HeuresSupTranche1 = Math.Min(heuresSupp ?? 0, tranche1 ?? 0);
                heuresSupp -= result.HeuresSupTranche1;

                result.HeuresSupTranche2 = Math.Min(heuresSupp ?? 0, tranche2 ?? 0);
                heuresSupp -= result.HeuresSupTranche2;
                return result;
            }
            catch (Exception)
            {
                throw;
            }
            
        }

    }
}

