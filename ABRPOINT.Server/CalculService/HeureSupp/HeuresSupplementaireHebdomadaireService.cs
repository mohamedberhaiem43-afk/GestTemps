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
        // ─── Validation des heures supplémentaires (table autoriser / [HEURES SUP]) ───
        // Exigence produit 2026-05 : « les h.supp ne sont calculées que si elles
        // sont approuvées ». On garde le total calculé brut (HreSupCalcule) pour
        // l'audit/transparence, et on bascule HreSupSemaine sur HreSupApprouvees
        // dès qu'au moins une demande existe pour la semaine. Si aucune demande
        // n'existe (cas legacy / tenant n'utilisant pas le workflow de validation),
        // on garde le total calculé pour éviter de zéroter rétroactivement
        // l'historique.
        /// <summary>Heures sup. calculées depuis les pointages (montant brut, avant filtrage par approbation).</summary>
        public float? HreSupCalcule { get; set; }
        /// <summary>Heures sup. couvertes par des demandes Approved sur la semaine (clé condep.Date ∈ [WeekStartDate, WeekEndDate]).</summary>
        public float? HreSupApprouvees { get; set; }
        /// <summary>Heures sup. correspondant à des demandes Pending (non encore traitées).</summary>
        public float? HreSupEnAttente { get; set; }
        /// <summary>Heures sup. dont la demande a été Rejected — affichées en mention dans l'UI sans être comptées dans HreSupSemaine.</summary>
        public float? HreSupRefusees { get; set; }
        /// <summary>true s'il existe au moins une demande d'h.supp dans la semaine — sert au front pour savoir si l'on est en mode validation (badge Approuvées/Refusées affiché) ou en mode legacy auto-calcul.</summary>
        public bool HreSupHasRequests { get; set; }
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
        private readonly IautoriserRepository _autoriserRepository;

        public HeuresSupplementairesHebdomadairesService(
            IparTrancheRepository parTrancheRepository,
            ICalendrierRepository calendrierRepository,
            IParametreRepository parametreRepository,
            IPresenceRepository presenceRepository,
            IEmployeRepository employeRepository,
            IOptimizedPresenceService optimizedPresenceService,
            IautoriserRepository autoriserRepository)
        {
            _parTrancheRepository = parTrancheRepository;
            _calendrierRepository = calendrierRepository;
            _parametreRepository = parametreRepository;
            _presenceRepository = presenceRepository;
            _employeRepository = employeRepository;
            _optimizedPresenceService = optimizedPresenceService;
            _autoriserRepository = autoriserRepository;
        }

        /// <summary>
        /// Applique le filtre d'approbation à un <see cref="HeuresSupplementairesResultat"/>
        /// déjà calculé : remplit HreSupCalcule/Approuvees/EnAttente/Refusees/HasRequests,
        /// et bascule HreSupSemaine (+ tranches) sur les seules heures approuvées si au
        /// moins une demande existe sur la semaine. Si aucune demande n'existe, on garde
        /// les valeurs calculées (compat ascendante — un tenant qui n'utilise pas le
        /// workflow de validation ne perd pas son historique d'h.supp).
        /// </summary>
        private async Task ApplyApprovalFilterAsync(
            HeuresSupplementairesResultat result,
            string soccod,
            string empcod,
            float? tranche1,
            float? tranche2)
        {
            // Conserve la valeur calculée pour l'audit/transparence.
            result.HreSupCalcule = result.HreSupSemaine;

            if (!result.WeekStartDate.HasValue || !result.WeekEndDate.HasValue)
            {
                // Pas de plage → rien à filtrer, on laisse HreSupSemaine tel quel.
                result.HreSupApprouvees = result.HreSupSemaine;
                result.HreSupEnAttente = 0f;
                result.HreSupRefusees = 0f;
                result.HreSupHasRequests = false;
                return;
            }

            var approvals = await _autoriserRepository.GetOvertimeApprovalBatchAsync(
                soccod, empcod, result.WeekStartDate.Value, result.WeekEndDate.Value);

            float approved = 0f, pending = 0f, rejected = 0f;
            foreach (var s in approvals.Values)
            {
                approved += s.ApprovedHours;
                pending += s.PendingHours;
                rejected += s.RejectedHours;
            }

            result.HreSupApprouvees = approved;
            result.HreSupEnAttente = pending;
            result.HreSupRefusees = rejected;
            result.HreSupHasRequests = approvals.Count > 0;

            if (!result.HreSupHasRequests)
                return; // Mode legacy : HreSupSemaine = calculé. Pas de modification.

            // Mode strict : seules les h.supp approuvées comptent. On replafonne
            // également les deux tranches sur ce total approuvé en respectant la
            // même règle de répartition (tranche1 jusqu'à son seuil, le reste en
            // tranche2). Le total Tothre est ajusté du delta calculé → approuvé
            // pour rester cohérent avec ce qu'affichait la ligne "Total".
            var newHreSup = approved;
            var delta = newHreSup - (result.HreSupCalcule ?? 0f);
            if (result.Tothre.HasValue)
                result.Tothre += delta;

            result.HreSupSemaine = newHreSup;
            result.HeuresSupTranche1 = (float?)Math.Min(newHreSup, tranche1 ?? 0f);
            var remaining = newHreSup - (result.HeuresSupTranche1 ?? 0f);
            result.HeuresSupTranche2 = (float?)Math.Min(remaining, tranche2 ?? 0f);
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
                        // ⚠ Pas de droit aux heures sup ⇒ on borne HeuresNormales aux heures
                        // réellement comptabilisées (Tothre = travaillé + férié payé + congé payé),
                        // plafonné à la base hebdomadaire contractuelle. Avant on forçait
                        // HeuresNormales = NbhCalendSem sans tenir compte de la présence : un
                        // employé absent affichait 35 h « normales » et touchait la Prime Qualité
                        // (variable paie #9) à plein, ce qui était à la fois trompeur côté
                        // tableau et incorrect côté paie.
                        var tot = (float)Math.Max(0, result.Tothre ?? 0);
                        var cap = result.NbhCalendSem ?? 0;
                        result.HeuresNormales = (float)Math.Min(tot, cap);
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

                // Filtrage par approbation — n'a aucun effet si aucune demande
                // n'existe pour la semaine (cf. compat ascendante dans le helper).
                await ApplyApprovalFilterAsync(result, soccod, empcod, tranche1, tranche2);
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
                        // ⚠ Même règle que la version single-week : on borne HeuresNormales aux
                        // heures réellement comptabilisées (Tothre = travaillé + férié payé + congé
                        // payé) plafonnées à la base hebdo contractuelle. Empêche les semaines
                        // d'absence complète d'afficher 35 h « normales » et de générer la Prime
                        // Qualité sans présence réelle.
                        var tot = (float)Math.Max(0, result.Tothre ?? 0);
                        var cap = result.NbhCalendSem ?? 0;
                        result.HeuresNormales = (float)Math.Min(tot, cap);
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

                        // ⚠ On compare désormais Tothre (le total affiché à l'utilisateur :
                        // travaillé + férié payé + congé payé, après ajustements Parreptrv)
                        // à l'objectif hebdo. Avant, on utilisait NbHeuresDebutCalcul qui
                        // pouvait diverger de Tothre (notamment via les heures férié calculées
                        // sur le poste plutôt que sur le calendrier), produisant des HS
                        // « +1h » sans correspondance avec ce que l'utilisateur lisait.
                        if (result.Tothre > result.NbhCalendSem)
                            heuresSupp = result.Tothre - result.NbhCalendSem;

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

                    // Filtrage approbation — applique le mode strict dès qu'au
                    // moins une demande [HEURES SUP] existe pour cette semaine.
                    // Idempotent côté legacy : sans demande, HreSupSemaine reste
                    // égal au calcul (HreSupCalcule).
                    await ApplyApprovalFilterAsync(result, soccod, empcod, tranche1, tranche2);

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
