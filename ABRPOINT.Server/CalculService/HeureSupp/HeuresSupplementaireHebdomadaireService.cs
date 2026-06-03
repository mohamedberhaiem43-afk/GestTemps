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
        // Télétravail (axe A/D/E) : jours télétravaillés de la semaine + indemnité forfaitaire.
        public float? NbJoursTeletravail { get; set; }
        public float? MontantIndemniteTeletravail { get; set; }
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
        /// Calcule en pur (sans DB) la paire (HeuresNormales, HeuresSupplementaires)
        /// hebdomadaires à partir des données déjà agrégées par <see cref="OptimizedPresenceService"/>.
        ///
        /// Règle métier "Éliminer férié" (<c>Parametre.Parelimftrv</c>) :
        ///   • "1" → on retire les heures travaillées sur jour férié AVANT le seuil
        ///           hebdo (NbhCalendSem, généralement 35h). Logique : un férié travaillé
        ///           ne compte pas comme heure régulière de la semaine, il est compensé
        ///           séparément (cf. colonne HreFerieTrv / HreFerieTrv2).
        ///   • "0" → on garde les heures férié dans le compte régulier.
        ///   • "2" → ancienne sémantique « après seuil » — alias rétro-compat (même effet
        ///           que "1" depuis l'unification 2026-05-27).
        ///
        /// La règle ne s'applique qu'au régime horaire (<c>empreg == "H"</c>).
        ///
        /// ⚠ Régression corrigée 2026-05-27 : l'ancien code soustrayait NbhFerierTrv
        /// DEUX fois quand EliminerFerier=="1" (une avant le seuil, une après dans le
        /// total supp). Résultat : un employé H ayant travaillé 14h sur un férié voyait
        /// son H.Supp diminué de moitié (~5.5h au lieu de 7h en EtatPeriodique pour le
        /// même jour). Asymétrie aggravante : la 1ère condition utilisait `=="1"`, la
        /// 2ème `!="0"`, rendant le cas "2" encore plus imprévisible. On unifie : UNE
        /// seule déduction, AVANT le seuil hebdo. Méthode statique pour la tester
        /// isolément sans monter toute la stack du service.
        /// </summary>
        /// <summary>
        /// Applique le plafond <c>MaxFerier</c> aux heures travaillées sur jour férié
        /// (<paramref name="nbhFerierTrv"/>) et répartit en deux tranches :
        ///   • <c>HreFerieTrv</c>  = heures payées au taux férié majoré standard (≤ cap)
        ///   • <c>HreFerieTrv2</c> = surplus au-delà du cap (taux majoré différent / hors barème)
        ///
        /// Sémantique du <paramref name="maxFerier"/> :
        ///   • <c>null</c> (champ jamais saisi dans ParamSoc) → AUCUN PLAFOND. Toutes les
        ///     heures effectivement travaillées sur férié vont en HreFerieTrv ; HreFerieTrv2=0.
        ///     Régression corrigée 2026-05-27 : l'ancien défaut `?? 0` clampait à 0 → la
        ///     colonne H.Fér.Trv affichait 0 sur tous les tenants n'ayant pas explicitement
        ///     saisi ce paramètre (cas le plus fréquent — paramétrage non visible dans l'UI
        ///     historique).
        ///   • <c>0</c> explicite → cap = 0. Toutes les heures travaillées vont en HreFerieTrv2.
        ///     Sémantique conservée pour les tenants qui ont volontairement saisi 0.
        ///   • <c>N</c> (>0) → cap à N heures, surplus en HreFerieTrv2.
        /// </summary>
        public static (float? hreFerieTrv, float? hreFerieTrv2) ApplyFerierWorkedCap(
            float? nbhFerierTrv, float? maxFerier)
        {
            var worked = nbhFerierTrv ?? 0f;
            float capped = maxFerier.HasValue ? Math.Min(worked, maxFerier.Value) : worked;
            return (capped, worked - capped);
        }

        public static (float? heuresNormales, float? heuresSupp) ComputeWeeklyNormalAndOvertime(
            float? tothre,
            float? heureRepos,
            float? hreFerier,
            float? nbhFerierTrv,
            float? nbhCalendSem,
            string? eliminerFerier,
            string? empreg)
        {
            float? heuresNormales = tothre - ((heureRepos ?? 0f) + (hreFerier ?? 0f));

            if ((eliminerFerier == "1" || eliminerFerier == "2") && empreg == "H")
            {
                heuresNormales -= nbhFerierTrv ?? 0f;
            }

            float? heuresSupp = 0f;
            if (heuresNormales > nbhCalendSem)
                heuresSupp = heuresNormales - nbhCalendSem;

            heuresSupp = (float?)Math.Max(0, (double)(heuresSupp ?? 0));
            return (heuresNormales, heuresSupp);
        }

        /// <summary>
        /// Applique le filtre d'approbation à un <see cref="HeuresSupplementairesResultat"/>
        /// déjà calculé. Règle métier (2026-05) : <strong>les h.supp ne sont comptabilisées
        /// QUE si elles ont été approuvées par un manager/admin</strong>. Sans demande
        /// approuvée, HreSupSemaine = 0 — même si les pointages révèlent un dépassement.
        /// Le total calculé brut reste accessible via HreSupCalcule pour audit/transparence.
        /// </summary>
        private async Task ApplyApprovalFilterAsync(
            HeuresSupplementairesResultat result,
            string soccod,
            string empcod,
            float? tranche1,
            float? tranche2)
        {
            // Conserve la valeur calculée pour l'audit/transparence (UI peut afficher
            // « 5h supp détectées dont 0h approuvées »).
            result.HreSupCalcule = result.HreSupSemaine;

            if (!result.WeekStartDate.HasValue || !result.WeekEndDate.HasValue)
            {
                // Pas de plage → impossible d'interroger les approbations.
                // On bascule en mode strict prudent : 0 h.supp comptées.
                result.HreSupApprouvees = 0f;
                result.HreSupEnAttente = 0f;
                result.HreSupRefusees = 0f;
                result.HreSupHasRequests = false;
                result.HreSupSemaine = 0f;
                result.HeuresSupTranche1 = 0f;
                result.HeuresSupTranche2 = 0f;
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

            // Mode strict permanent : seules les h.supp approuvées comptent. Pas de
            // bypass legacy — un dépassement non validé n'apparaît plus dans le total
            // payable. Les tranches sont replafonnées sur ce total approuvé en
            // respectant la règle de répartition (tranche1 jusqu'à son seuil, le
            // reste en tranche2).
            //
            // 2026-05-28 — Double plafonnement supplémentaire : une demande approuvée
            // ne peut JAMAIS faire dépasser le total réellement constaté côté
            // pointage (HreSupCalcule = Tothre − NbhCalendSem, clampé à 0).
            // Sans ce cap, un manager qui valide « 8h » alors que l'employé a
            // travaillé 35h pile (= 0 h.supp factuelles) verrait 8h apparaître
            // dans Pointage du mois, ce qui rend la paie incohérente avec la
            // feuille de présence. Règle métier : l'approbation est une CONDITION
            // NÉCESSAIRE mais non suffisante — il faut AUSSI un dépassement
            // hebdomadaire effectif au-delà des heures calendrier de la société.
            //
            // ⚠ Tothre n'est PAS ajusté : il représente le total d'heures physiquement
            // pointées (gross), pas le total payable. Le découplage gross/net est
            // exactement ce que le workflow de validation matérialise.
            var rawExcess = Math.Max(0f, result.HreSupCalcule ?? 0f);
            var payable = (float)Math.Min(approved, rawExcess);

            result.HreSupSemaine = payable;
            result.HeuresSupTranche1 = (float?)Math.Min(payable, tranche1 ?? 0f);
            var remaining = payable - (result.HeuresSupTranche1 ?? 0f);
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
                var (hreFerieTrv, hreFerieTrv2) = ApplyFerierWorkedCap(res.NbhFerierTrv, paramSupp.MaxFerier);
                result.HreFerieTrv = hreFerieTrv;
                result.HreFerieTrv2 = hreFerieTrv2;
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
                result.NbJoursTeletravail = res.NbJoursTeletravail;
                result.MontantIndemniteTeletravail = res.MontantIndemniteTeletravail;
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
                result.Tothre = res.TotalHours;
                var (heuresNormales, heuresSupp) = ComputeWeeklyNormalAndOvertime(
                    tothre: res.TotalHours,
                    heureRepos: res.HeureRepos,
                    hreFerier: res.HreFerier,
                    nbhFerierTrv: res.NbhFerierTrv,
                    nbhCalendSem: result.NbhCalendSem,
                    eliminerFerier: paramSupp.EliminerFerier,
                    empreg: empreg);
                result.HeuresNormales = heuresNormales;
                result.HreSupSemaine = heuresSupp;
                result.Tothre += heuresSupp;
                result.HeuresSupTranche1 = Math.Min(heuresSupp ?? 0, tranche1 ?? 0);
                heuresSupp -= result.HeuresSupTranche1;
                result.HeuresSupTranche2 = Math.Min(heuresSupp ?? 0, tranche2 ?? 0);

                // Mode heures sup (parametre.parhsupmode) :
                //   "A" = calcul AUTOMATIQUE → on garde l'excédent calculé tel quel.
                //   null/"V" = sur DEMANDE + VALIDATION → seules les heures sup approuvées
                //   comptent (filtrage par approbation). Défaut historique = validation.
                if (!string.Equals(paramSupp.Hsupmode, "A", StringComparison.OrdinalIgnoreCase))
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
                    result.NbJoursTeletravail = res.NbJoursTeletravail;
                    result.MontantIndemniteTeletravail = res.MontantIndemniteTeletravail;
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

                    // Mode heures sup (parametre.parhsupmode) : "A" = automatique (pas de
                    // filtrage) ; null/"V" = validation requise (seules les demandes
                    // [HEURES SUP] approuvées comptent). Défaut historique = validation.
                    if (!string.Equals(paramSupp.Hsupmode, "A", StringComparison.OrdinalIgnoreCase))
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
