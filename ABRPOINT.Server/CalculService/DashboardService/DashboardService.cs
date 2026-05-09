using ABRPOINT.Helper;
using ABRPOINT.Server.CalculService.CalcTotHeures;
using ABRPOINT.Server.CalculService.HeureAbsences;
using ABRPOINT.Server.CalculService.HeureRetard;
using ABRPOINT.Server.CalculService.HeureSupp;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using Microsoft.EntityFrameworkCore;
using System.Globalization;

namespace ABRPOINT.Server.CalculService.DashboardService
{
    public class DashboardService : IDashboardService
    {
        private readonly ApplicationDbContext _context;
        private readonly IHeureRetardService _heureRetardService;
        private readonly ICalcTotHeuresService _calcHeuresService;
        private readonly IHeureAbsencesService _heureAbsencesService;
        private readonly IHeuresSupplementaireHebdomadairesService _heureSuppService;
        private readonly IPosteRepository _posteRepository;
        private readonly ICongeRepository _congeRepository;
        private readonly IautoriserRepository _autorisationRepository;

        public DashboardService(ApplicationDbContext context,IHeureRetardService heureRetardService,ICalcTotHeuresService calcHeuresService,
            IHeureAbsencesService heureAbsencesService,IHeuresSupplementaireHebdomadairesService heureSuppService,IPosteRepository posteRepository,
            ICongeRepository congeRepository,IautoriserRepository autorisationRepository)
        {
            _context = context;
            _heureRetardService = heureRetardService;
            _calcHeuresService = calcHeuresService;
            _heureAbsencesService = heureAbsencesService;
            _heureSuppService = heureSuppService;
            _posteRepository = posteRepository;
            _congeRepository = congeRepository;
            _autorisationRepository = autorisationRepository;
        }
        public async Task<DashboardData> GetDashboardData(string soccod,DateTime dateDebut,DateTime dateFin,string? dep,List<string>? empcods)
        {
            try
            {
                var dashboardData = new DashboardData
                {
                    DateDebut = dateDebut,
                    DateFin = dateFin,
                    Departement = dep
                };

                // =========================
                // 1. Employés (base query)
                // =========================
                var employesQuery = _context.Employes
                    .Where(e => e.Soccod == soccod && e.Actif == "A");

                if (!string.IsNullOrEmpty(dep))
                    employesQuery = employesQuery.Where(e => e.Dircod == dep);

                if (empcods != null && empcods.Any())
                    employesQuery = employesQuery.Where(e => empcods.Contains(e.Empcod));

                var empcodesFiltres = await employesQuery
                    .Select(e => e.Empcod)
                    .ToListAsync();

                dashboardData.EffectifTotal = empcodesFiltres.Count;

                // =========================
                // 2. Presences période
                // =========================
                var presences = await _context.Presences
                    .Where(p =>
                        p.Soccod == soccod &&
                        p.Predat.HasValue &&
                        p.Predat.Value.Date >= dateDebut.Date &&
                        p.Predat.Value.Date <= dateFin.Date &&
                        empcodesFiltres.Contains(p.Empcod))
                    .ToListAsync();

                // =========================
                // 3. Présents
                // =========================
                var employesPresents = presences
                    .Where(p => !string.IsNullOrEmpty(p.Preentmatup))
                    .Select(p => p.Empcod)
                    .Distinct()
                    .Count();

                dashboardData.EffectifPresent = employesPresents;
                dashboardData.PourcentagePresence = dashboardData.EffectifTotal > 0
                    ? Math.Round((decimal)employesPresents / dashboardData.EffectifTotal * 100, 2)
                    : 0;

                // =========================
                // 4. Heures / Retards
                // =========================
                float? heuresTravaillees = 0;
                int retards = 0;
                // BUG fix : on comptait `entreesEnRetard` par présence en retard, donc un
                // employé arrivé en retard 3 jours sur la période était compté 3 fois — d'où
                // « 6 employés en retard » alors que l'effectif total n'était que de 4.
                // On dédoublonne explicitement par Empcod : `empsEnRetard` est le KPI
                // exposé à l'utilisateur (nb d'employés distincts), tandis que
                // `occurrencesEnRetard` reste le nb d'entrées en retard sur la période,
                // utilisé pour calculer le % ponctualité (entrées à l'heure / total entrées).
                var empsEnRetard = new HashSet<string>();
                int occurrencesEnRetard = 0;
                int pointagesIncomplets = 0;

                foreach (var p in presences.Where(p => !string.IsNullOrEmpty(p.Preentmatup)))
                {
                    var dto = new PresenceDto
                    {
                        Soccod = p.Soccod,
                        Empcod = p.Empcod,
                        Codposte = p.Codposte,
                        Dmdate = p.Predat,
                        Preentmatup = p.Preentmatup,
                        Presortmatup = p.Presortmatup,
                        Preentamidiup = p.Preentamidiup,
                        Presortamidiup = p.Presortamidiup,
                        Tothre = p.Tothre
                    };

                    heuresTravaillees += GenericMethodes.ConvertHHmmToDouble(p.Tothre) + GenericMethodes.ConvertHHmmToDouble(p.Tothsup);
                    (var sup,var retard) = await _calcHeuresService.CalculateDayWorkMetrics(dto);
                    retards += retard;
                    if (retard > 0)
                    {
                        occurrencesEnRetard++;
                        if (!string.IsNullOrEmpty(p.Empcod)) empsEnRetard.Add(p.Empcod);
                    }

                    if (!GenericMethodes.IsPresent(p))
                        pointagesIncomplets++;
                }

                // ── Heures supplémentaires HEBDOMADAIRES ────────────────────────────
                // Au lieu de sommer Tothsup jour par jour (qui compte tout dépassement
                // quotidien comme heure supp), on délègue au service hebdomadaire qui ne
                // déclenche les HS qu'après dépassement du seuil hebdo (NbhCalendSem,
                // typiquement 40h ou 35h selon convention). Plus conforme au droit du
                // travail tunisien et plus précis pour la paie.
                float heuresSupplementaires = 0;
                var moisAnneeKeys = presences
                    .Where(p => p.Predat.HasValue)
                    .Select(p => new { p.Empcod, Mois = p.Predat!.Value.Month.ToString("D2"), Annee = p.Predat!.Value.Year.ToString() })
                    .Distinct()
                    .ToList();

                // Charger Empreg/Empniv des employés concernés en une seule requête.
                var empcodsHs = moisAnneeKeys.Select(k => k.Empcod).Distinct().ToList();
                var empsParams = await _context.Employes
                    .Where(e => e.Soccod == soccod && empcodsHs.Contains(e.Empcod))
                    .Select(e => new { e.Empcod, e.Empreg, e.Empniv })
                    .ToDictionaryAsync(e => e.Empcod);

                foreach (var key in moisAnneeKeys)
                {
                    if (!empsParams.TryGetValue(key.Empcod, out var emp)) continue;
                    try
                    {
                        var weeks = await _heureSuppService.CalculerHeuresSupplementairesMultiSemaines(
                            soccod, key.Empcod, key.Mois, key.Annee, emp.Empreg ?? "", emp.Empniv ?? "");

                        foreach (var w in weeks)
                        {
                            // On ne compte que les HS des semaines qui chevauchent la
                            // période demandée (sinon un dashboard "du 1 au 10" sommerait
                            // les HS d'une semaine 1-7 qui s'étend hors période).
                            if (!w.WeekStartDate.HasValue || !w.WeekEndDate.HasValue) continue;
                            if (w.WeekEndDate.Value.Date < dateDebut.Date) continue;
                            if (w.WeekStartDate.Value.Date > dateFin.Date) continue;
                            heuresSupplementaires += w.HreSupSemaine ?? 0;
                        }
                    }
                    catch (Exception)
                    {
                        // Un employé sans poste/calendrier valide : on l'ignore plutôt
                        // que de faire planter le dashboard entier.
                    }
                }

                dashboardData.HeuresTravaillees = MathF.Round((float)heuresTravaillees, 2);
                dashboardData.HeuresSupplementaires = MathF.Round(heuresSupplementaires, 2);
                dashboardData.NombreRetards = retards;
                dashboardData.NombreEmployesEnRetard = empsEnRetard.Count;
                dashboardData.PointagesIncomplets = pointagesIncomplets;

                // Ponctualité : % d'entrées à l'heure par rapport au nombre total d'entrées.
                // Utilise `occurrencesEnRetard` (nb d'entrées en retard, pas dédoublonné)
                // car le ratio doit refléter les entrées de la période, pas les personnes.
                var totalEntrees = presences.Count(p => !string.IsNullOrEmpty(p.Preentmatup));
                dashboardData.PourcentagePonctualite = totalEntrees > 0
                    ? Math.Round((decimal)(totalEntrees - occurrencesEnRetard) / totalEntrees * 100, 2)
                    : 0;

                // =========================
                // 5. Heures prévues
                // =========================
                var joursDistincts = presences
                    .Where(p => p.Predat.HasValue)
                    .Select(p => p.Predat.Value.Date)
                    .Distinct()
                    .Count();

                dashboardData.HeuresPreveues = joursDistincts * employesPresents * 8;
                dashboardData.PourcentageHeures = dashboardData.HeuresPreveues > 0
                    ? MathF.Round(dashboardData.HeuresTravaillees / dashboardData.HeuresPreveues * 100, 2)
                    : 0;

                // =========================
                // 6. Congés
                // =========================
                var conges = await _context.Conges
                    .Where(c =>
                        c.Soccod == soccod &&
                        c.Condep <= dateFin &&
                        c.Conret >= dateDebut &&
                        empcodesFiltres.Contains(c.Empcod))
                    .ToListAsync();

                dashboardData.AbsencesJustifiees = conges.Count;
                dashboardData.TotalAbsences = dashboardData.EffectifTotal - employesPresents;
                dashboardData.AbsencesNonJustifiees =
                    Math.Max(0, dashboardData.TotalAbsences - dashboardData.AbsencesJustifiees);

                // =========================
                // 7. Demandes en attente
                // =========================
                dashboardData.DemandesCongesEnAttente = await CountPendingLeaveRequestsAsync(
                    soccod,
                    empcodesFiltres,
                    dateDebut,
                    dateFin
                );

                dashboardData.TotalDemandesEnAttente = dashboardData.DemandesCongesEnAttente;
                // =========================
                // 8. Evolution KPI
                // =========================

                var (compStart, compEnd) = GetComparisonPeriod(dateDebut, dateFin);

                var previousKpi = await CalculateKpi(soccod, compStart, compEnd, empcodesFiltres);
                var currentKpi = (
                    dashboardData.HeuresTravaillees,
                    dashboardData.TotalAbsences,
                    dashboardData.NombreRetards
                );

                float CalcEvolution(float current, float previous)
                {
                    if (previous == 0) return current > 0 ? 100 : 0;
                    return MathF.Round(((current - previous) / previous) * 100, 2);
                }

                dashboardData.EvolutionHeures = CalcEvolution(currentKpi.HeuresTravaillees, previousKpi.heures);
                dashboardData.EvolutionAbsences = CalcEvolution(currentKpi.TotalAbsences, previousKpi.absences);
                dashboardData.EvolutionRetards = CalcEvolution(currentKpi.NombreRetards, previousKpi.retards);

                return dashboardData;
            }
            catch (Exception ex)
            {
                throw;
            }
        }


        public async Task<List<PointageInvalideDto>> GetPointagesInvalides(DashboardRequest request)
        {
            var employesQuery = _context.Employes
                .Where(e => e.Soccod == request.Soccod && e.Actif == "A");

            if (!string.IsNullOrEmpty(request.Departement))
                employesQuery = employesQuery.Where(e => e.Dircod == request.Departement);

            if (request.Empcods != null && request.Empcods.Any())
                employesQuery = employesQuery.Where(e => request.Empcods.Contains(e.Empcod));

            var employesDict = await employesQuery
                .Select(e => new { e.Empcod, e.Emplib, e.Dircod })
                .ToDictionaryAsync(e => e.Empcod);

            var empcodesFiltres = employesDict.Keys.ToList();

            var presences = await _context.Presences
                .Where(p =>
                    p.Soccod == request.Soccod &&
                    p.Predat.HasValue &&
                    p.Predat.Value.Date >= request.DateDebut &&
                    p.Predat.Value.Date <= request.DateFin &&
                    empcodesFiltres.Contains(p.Empcod))
                .ToListAsync();

            var result = new List<PointageInvalideDto>();

            foreach (var p in presences)
            {
                var motifs = new List<string>();
                bool entreeManquante = false;
                bool sortieManquante = false;
                bool incoherenceHoraire = false;
                bool midiIncoherent = false;

                if (string.IsNullOrEmpty(p.Preentmatup))
                {
                    entreeManquante = true;
                    motifs.Add("Entrée matin manquante");
                }

                bool jourPasse = p.Predat.HasValue && p.Predat.Value.Date <= DateTime.Now.Date;
                if (jourPasse && !GenericMethodes.IsPresent(p))
                {
                    sortieManquante = true;
                    motifs.Add("Pointage incomplet (jour passé)");
                }

                if (TimeSpan.TryParse(p.Preentmatup, out var entMat) &&
                    TimeSpan.TryParse(p.Presortmatup, out var sortMat) &&
                    sortMat <= entMat)
                {
                    incoherenceHoraire = true;
                    motifs.Add("Sortie matin ≤ entrée matin");
                }

                if (TimeSpan.TryParse(p.Preentamidiup, out var entMidi) &&
                    TimeSpan.TryParse(p.Presortamidiup, out var sortMidi) &&
                    sortMidi <= entMidi)
                {
                    midiIncoherent = true;
                    motifs.Add("Sortie après-midi ≤ entrée après-midi");
                }

                if (!motifs.Any()) continue;

                employesDict.TryGetValue(p.Empcod, out var emp);

                result.Add(new PointageInvalideDto
                {
                    Empcod = p.Empcod,
                    Emplib = emp?.Emplib,
                    Departement = emp?.Dircod,
                    Codposte = p.Codposte,
                    Predat = p.Predat,
                    Preentmatup = p.Preentmatup,
                    Presortmatup = p.Presortmatup,
                    Preentamidiup = p.Preentamidiup,
                    Presortamidiup = p.Presortamidiup,
                    Tothre = p.Tothre,
                    Motif = string.Join(" | ", motifs),
                    EntreeManquante = entreeManquante,
                    SortieManquante = sortieManquante,
                    IncoherenceHoraire = incoherenceHoraire,
                    MidiIncoherent = midiIncoherent
                });
            }

            return result
                .OrderByDescending(r => r.Predat)
                .ThenBy(r => r.Empcod)
                .ToList();
        }
        public async Task<DashboardData> GetDashboardData(string soccod, DateTime date, string dep, List<string> empcods)
        {
            try
            {
                var dashboardData = new DashboardData
                {
                    Date = date,
                    Departement = dep
                };

                // 1. Récupérer l'effectif total selon les critères
                var employesQuery = _context.Employes
                    .Where(e => e.Soccod == soccod && e.Actif == "A");

                if (!string.IsNullOrEmpty(dep))
                    employesQuery = employesQuery.Where(e => e.Dircod == dep);

                if (empcods != null && empcods.Any())
                    employesQuery = employesQuery.Where(e => empcods.Contains(e.Empcod));

                var effectifTotal = await employesQuery.CountAsync();
                dashboardData.EffectifTotal = effectifTotal;

                // 2. Récupérer les pointages du jour
                var pointagesJour = await _context.Presences
                    .Where(p => p.Soccod == soccod &&
                                p.Predat.HasValue &&
                                p.Predat.Value.Date == date.Date)
                    .ToListAsync();

                var empcodsFiltered = await employesQuery.Select(e => e.Empcod).ToListAsync();
                pointagesJour = pointagesJour.Where(p => empcodsFiltered.Contains(p.Empcod)).ToList();

                // 3. Calculer l'effectif présent
                var employesPresents = pointagesJour
                    .Where(p => !string.IsNullOrEmpty(p.Preentmatup))
                    .Select(p => p.Empcod)
                    .Distinct()
                    .Count();

                dashboardData.EffectifPresent = employesPresents;
                dashboardData.PourcentagePresence = effectifTotal > 0
                    ? Math.Round((decimal)employesPresents / effectifTotal * 100, 2)
                    : 0;

                // 4. Calculer les heures travaillées
                float heuresTravaillees = 0;
                float heuresPreveues = 0;
                float heuresSupplementairesTotales = 0;
                var retardsTotaux = 0;
                // Cf. branche multi-jours : `entreesEnRetard` historiquement comptait les
                // OCCURRENCES, ce qui faisait dépasser l'effectif total dès qu'un employé
                // était en retard plusieurs jours. On dédoublonne par Empcod côté KPI, et
                // on garde un compteur d'occurrences pour la ponctualité.
                var empsEnRetard = new HashSet<string>();
                var occurrencesEnRetard = 0;
                var pointagesIncomplets = 0;

                var pointagesAvecEntree = pointagesJour.Where(p => !string.IsNullOrEmpty(p.Preentmatup)).ToList();

                // Si aucun pointage aujourd'hui, on saute le calcul des heures
                if (pointagesAvecEntree.Any())
                {
                    foreach (var pointage in pointagesAvecEntree)
                    {
                        // Skip si Codposte manquant (évite ArgumentException dans GetPoste)
                        if (string.IsNullOrEmpty(pointage.Codposte))
                        {
                            if (pointage.Predat < DateTime.Now.Date &&
                                string.IsNullOrEmpty(pointage.Presortamidiup))
                                pointagesIncomplets++;
                            continue;
                        }

                        var presenceDto = new PresenceDto
                        {
                            Soccod = pointage.Soccod,
                            Empcod = pointage.Empcod,
                            Codposte = pointage.Codposte,
                            Dmdate = pointage.Predat,
                            Preentmatup = pointage.Preentmatup,
                            Presortmatup = pointage.Presortmatup,
                            Preentamidiup = pointage.Preentamidiup,
                            Presortamidiup = pointage.Presortamidiup,
                            Tothre = pointage.Tothre
                        };

                        try
                        {
                            // Heures travaillées
                            var totHre = await _calcHeuresService.CalcHreTravOptimise(presenceDto);
                            if (!string.IsNullOrEmpty(totHre) && TimeSpan.TryParse(totHre, out var heureTravail))
                                heuresTravaillees += (float)heureTravail.TotalHours;

                            // Heures supp + retards
                            var (nbHeurSupp, nbRetard) = await _calcHeuresService.CalculateDayWorkMetricsOptimise(presenceDto);
                            if (nbHeurSupp.HasValue)
                                heuresSupplementairesTotales += (float)nbHeurSupp.Value;

                            retardsTotaux += nbRetard;
                            if (nbRetard > 0)
                            {
                                occurrencesEnRetard++;
                                if (!string.IsNullOrEmpty(pointage.Empcod)) empsEnRetard.Add(pointage.Empcod);
                            }
                        }
                        catch (Exception ex)
                        {
                            Console.WriteLine($"Avertissement: Métriques ignorées pour {pointage.Empcod} ({pointage.Predat:dd/MM/yyyy}): {ex.Message}");
                        }

                        // Pointages incomplets (jour passé sans sortie)
                        if (pointage.Predat < DateTime.Now.Date &&
                            string.IsNullOrEmpty(pointage.Presortamidiup))
                            pointagesIncomplets++;
                    }

                    // Heures prévues selon les postes
                    float heuresStandardParJour = 0;
                    foreach (var pointage in pointagesAvecEntree.Where(p => !string.IsNullOrEmpty(p.Codposte)))
                    {
                        var heuresPoste = await _posteRepository.GetJourHeures(soccod, date, pointage.Codposte);
                        if (heuresPoste.HasValue)
                            heuresStandardParJour += (float)heuresPoste.Value;
                    }

                    heuresPreveues = heuresStandardParJour > 0 ? heuresStandardParJour : employesPresents * 8;
                }

                dashboardData.HeuresTravaillees = MathF.Round(heuresTravaillees, 2);
                dashboardData.HeuresPreveues = MathF.Round(heuresPreveues, 2);
                dashboardData.PourcentageHeures = heuresPreveues > 0
                    ? MathF.Round(heuresTravaillees / heuresPreveues * 100, 2)
                    : 0;
                dashboardData.HeuresSupplementaires = MathF.Round(heuresSupplementairesTotales, 2);
                dashboardData.NombreRetards = retardsTotaux;
                dashboardData.NombreEmployesEnRetard = empsEnRetard.Count;
                dashboardData.PointagesIncomplets = pointagesIncomplets;

                // Ponctualité : % d'entrées à l'heure par rapport au nombre total d'entrées
                var totalEntrees = pointagesAvecEntree.Count;
                dashboardData.PourcentagePonctualite = totalEntrees > 0
                    ? Math.Round((decimal)(totalEntrees - occurrencesEnRetard) / totalEntrees * 100, 2)
                    : 0;

                // 5. Absences
                var employesAbsents = effectifTotal - employesPresents;

                var congesJour = await _context.Conges
                    .Where(c => c.Soccod == soccod &&
                                c.Condep <= date.Date &&
                                c.Conret >= date.Date)
                    .ToListAsync();

                congesJour = congesJour.Where(c => empcodsFiltered.Contains(c.Empcod)).ToList();

                dashboardData.AbsencesJustifiees = congesJour.Count;
                dashboardData.AbsencesNonJustifiees = Math.Max(0, employesAbsents - congesJour.Count);
                dashboardData.TotalAbsences = employesAbsents;

                // 6. Demandes de congés en attente
                dashboardData.DemandesCongesEnAttente = await CountPendingLeaveRequestsAsync(
                    soccod,
                    empcodsFiltered,
                    date,
                    date
                );

                // 7. Demandes d'autorisation en attente
                await _context.Autorisers
                    .Where(a => a.Soccod == soccod)
                    .ToListAsync();

                dashboardData.TotalDemandesEnAttente = dashboardData.DemandesCongesEnAttente;

                // 8. Tendances (comparaison avec la veille)
                var dateVeille = date.AddDays(-1);
                var pointagesVeille = await _context.Presences
                    .Where(p => p.Soccod == soccod &&
                                p.Predat.HasValue &&
                                p.Predat.Value.Date == dateVeille.Date)
                    .ToListAsync();

                    pointagesVeille = pointagesVeille.Where(p => empcodsFiltered.Contains(p.Empcod)).ToList();

                var presentsVeille = pointagesVeille
                    .Where(p => !string.IsNullOrEmpty(p.Preentmatup))
                    .Select(p => p.Empcod)
                    .Distinct()
                    .Count();

                dashboardData.TendancePresence = employesPresents - presentsVeille;

                // 9. Données par département (si aucun département sélectionné)
                if (string.IsNullOrEmpty(dep))
                {
                    var departements = await employesQuery
                        .Select(e => e.Dircod)
                        .Distinct()
                        .ToListAsync();

                    dashboardData.DonneesDepartements = new List<DonneesDepartement>();

                    foreach (var departement in departements)
                    {
                        if (string.IsNullOrEmpty(departement)) continue;

                        var effectifDept = await employesQuery
                            .Where(e => e.Dircod == departement)
                            .CountAsync();

                        var empcodesDept = await employesQuery
                            .Where(e => e.Dircod == departement)
                            .Select(e => e.Empcod)
                            .ToListAsync();

                        var presentsDept = pointagesJour
                            .Where(p => empcodesDept.Contains(p.Empcod) && !string.IsNullOrEmpty(p.Preentmatup))
                            .Select(p => p.Empcod)
                            .Distinct()
                            .Count();

                        dashboardData.DonneesDepartements.Add(new DonneesDepartement
                        {
                            Departement = departement,
                            EffectifTotal = effectifDept,
                            EffectifPresent = presentsDept,
                            PourcentagePresence = effectifDept > 0
                                ? Math.Round((decimal)presentsDept / effectifDept * 100, 2)
                                : 0
                        });
                    }
                }

                return dashboardData;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Erreur dans GetDashboardData: {ex.Message}");
                throw;
            }
        }
        // Méthode pour récupérer l'évolution sur plusieurs jours
        public async Task<List<EvolutionJournaliere>> GetEvolutionHebdomadaire(string soccod,DateTime dateDebut,DateTime dateFin,string? dep,List<string> empcods)
        {
            try
            {
                var evolution = new List<EvolutionJournaliere>();
                var dateActuelle = dateDebut;

                while (dateActuelle <= dateFin)
                {
                    var dashboardData = await GetDashboardData(soccod, dateActuelle, dep, empcods);

                    evolution.Add(new EvolutionJournaliere
                    {
                        Date = dateActuelle,
                        JourSemaine = dateActuelle.ToString("dddd", new CultureInfo("fr-FR")),
                        EffectifPresent = dashboardData.EffectifPresent,
                        HeuresTravaillees = dashboardData.HeuresTravaillees,
                        TauxPresence = dashboardData.PourcentagePresence
                    });

                    dateActuelle = dateActuelle.AddDays(1);
                }

                return evolution;
            }
            catch (Exception)
            {
                throw;
            }
        }
        private async Task<(float heures, int absences, int retards)> CalculateKpi(
    string soccod,
    DateTime dateDebut,
    DateTime dateFin,
    List<string> empcodes)
        {
            var presences = await _context.Presences
                .Where(p => p.Soccod == soccod &&
                            p.Predat.HasValue &&
                            p.Predat.Value.Date >= dateDebut &&
                            p.Predat.Value.Date <= dateFin &&
                            empcodes.Contains(p.Empcod))
                .ToListAsync();

            float heures = 0;
            int retards = 0;

            foreach (var p in presences.Where(p => !string.IsNullOrEmpty(p.Preentmatup)))
            {
                var dto = new PresenceDto
                {
                    Soccod = p.Soccod,
                    Empcod = p.Empcod,
                    Codposte = p.Codposte,
                    Dmdate = p.Predat,
                    Preentmatup = p.Preentmatup,
                    Presortmatup = p.Presortmatup,
                    Preentamidiup = p.Preentamidiup,
                    Presortamidiup = p.Presortamidiup,
                    Tothre = p.Tothre
                };

                heures += (float)GenericMethodes.ConvertHHmmToDouble(p.Tothre);
                var (_, retard) = await _calcHeuresService.CalculateDayWorkMetrics(dto);
                retards += retard;
            }

            var conges = await _context.Conges
                .Where(c => c.Soccod == soccod &&
                            c.Condep <= dateFin &&
                            c.Conret >= dateDebut &&
                            empcodes.Contains(c.Empcod))
                .CountAsync();

            var presents = presences
                .Where(p => !string.IsNullOrEmpty(p.Preentmatup))
                .Select(p => p.Empcod)
                .Distinct()
                .Count();

            int absences = Math.Max(0, empcodes.Count - presents);

            return ((float)heures, absences, retards);
        }

        private async Task<int> CountPendingLeaveRequestsAsync(
            string soccod,
            List<string> empcodes,
            DateTime dateDebut,
            DateTime dateFin)
        {
            // Count ALL pending leave requests (not yet approved) for the company
            // regardless of date range - a pending request has no matching Conge
            return await _context.Demconges
                .Where(d =>
                    d.Soccod == soccod &&
                    empcodes.Contains(d.Empcod) &&
                    !_context.Conges.Any(c =>
                        c.Soccod == d.Soccod &&
                        c.Empcod == d.Empcod &&
                        c.Condep == d.Condep &&
                        c.Conret == d.Conret))
                .CountAsync();
        }
        public async Task<List<EmployeStatut>> GetEmployesStatutJour(
            string soccod,
            DateTime date,
            string dep,
            List<string> empcods)
        {
            var query = _context.Employes
                .Where(e => e.Soccod == soccod && e.Actif == "1");

            if (!string.IsNullOrEmpty(dep))
            {
                query = query.Where(e => e.Dircod == dep);
            }

            if (empcods != null && empcods.Any())
            {
                query = query.Where(e => empcods.Contains(e.Empcod));
            }

            var employes = await query.ToListAsync();

            var pointages = await _context.Presences
                .Where(p => p.Soccod == soccod &&
                           p.Predat.HasValue &&
                           p.Predat.Value.Date == date.Date)
                .ToListAsync();

            var conges = await _context.Conges
                .Where(c => c.Soccod == soccod &&
                            c.Condep <= date.Date &&
                            c.Conret >= date.Date)
                .ToListAsync();

            var employesStatuts = new List<EmployeStatut>();

            foreach (var employe in employes)
            {
                var pointage = pointages.FirstOrDefault(p => p.Empcod == employe.Empcod);
                var conge = conges.FirstOrDefault(c => c.Empcod == employe.Empcod);

                var statut = new EmployeStatut
                {
                    EMPCOD = employe.Empcod,
                    Emplib = employe.Emplib,
                    Departement = employe.Dircod,
                    HeureArrivee = null,
                    HeureDepart = null,
                    EstEnRetard = false
                };

                // Parser les heures d'arrivée et départ
                if (pointage != null && !string.IsNullOrEmpty(pointage.Preentmatup))
                {
                    if (TimeSpan.TryParse(pointage.Preentmatup, out var heureArr))
                    {
                        statut.HeureArrivee = date.Date.Add(heureArr);
                    }

                    // Vérifier si c'est le matin ou l'après-midi qui a la sortie
                    TimeSpan? heureDep = null;
                    if (!string.IsNullOrEmpty(pointage.Presortamidiup) && TimeSpan.TryParse(pointage.Presortamidiup, out var sortPm))
                    {
                        heureDep = sortPm;
                    }
                    else if (!string.IsNullOrEmpty(pointage.Presortmatup) && TimeSpan.TryParse(pointage.Presortmatup, out var sortMat))
                    {
                        heureDep = sortMat;
                    }

                    if (heureDep.HasValue)
                    {
                        statut.HeureDepart = date.Date.Add(heureDep.Value);
                    }

                    // Calculer les heures travaillées avec le service
                    if (!string.IsNullOrEmpty(pointage.Tothre) && TimeSpan.TryParse(pointage.Tothre, out var totHre))
                    {
                        statut.HeuresTravaillees = MathF.Round((float)totHre.TotalHours, 2);
                    }

                    // Vérifier les retards
                    var presenceDto = new PresenceDto
                    {
                        Soccod = pointage.Soccod,
                        Empcod = pointage.Empcod,
                        Codposte = pointage.Codposte,
                        Dmdate = pointage.Predat,
                        Preentmatup = pointage.Preentmatup
                    };

                    var (_, nbRetard) = await _calcHeuresService.CalculateDayWorkMetricsOptimise(presenceDto);
                    statut.EstEnRetard = nbRetard > 0;
                }

                // Déterminer le statut
                if (conge != null)
                {
                    statut.Statut = "Congé";
                    statut.TypeConge = conge.Condg;
                }
                else if (pointage != null && !string.IsNullOrEmpty(pointage.Preentmatup))
                {
                    statut.Statut = "Présent";
                }
                else
                {
                    statut.Statut = "Absent";
                }

                employesStatuts.Add(statut);
            }

            return employesStatuts;
        }


        private (DateTime start, DateTime end) GetComparisonPeriod(DateTime start, DateTime end)
        {
            var diffDays = (end.Date - start.Date).TotalDays;

            // JOUR
            if (diffDays == 0)
                return (start.AddDays(-1), end.AddDays(-1));

            // SEMAINE
            if (diffDays <= 7)
                return (start.AddDays(-7), end.AddDays(-7));

            // MOIS
            return (start.AddMonths(-1), end.AddMonths(-1));
        }


    }
}