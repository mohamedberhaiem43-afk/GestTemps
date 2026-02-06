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
                {
                    employesQuery = employesQuery.Where(e => e.Dircod == dep);
                }

                if (empcods != null && empcods.Any())
                {
                    employesQuery = employesQuery.Where(e => empcods.Contains(e.Empcod));
                }

                var effectifTotal = await employesQuery.CountAsync();
                dashboardData.EffectifTotal = effectifTotal;

                // 2. Récupérer les pointages du jour (Presences)
                var pointagesJour = await _context.Presences
                    .Where(p => p.Soccod == soccod &&
                                p.Predat.HasValue &&
                                p.Predat.Value.Date == date.Date)
                    .ToListAsync();

                // Filtrer par département et employés si nécessaire
                if (!string.IsNullOrEmpty(dep) || (empcods != null && empcods.Any()))
                {
                    var empcodsFiltered = await employesQuery.Select(e => e.Empcod).ToListAsync();
                    pointagesJour = pointagesJour.Where(p => empcodsFiltered.Contains(p.Empcod)).ToList();
                }

                // 3. Calculer l'effectif présent (employés ayant pointé l'entrée du matin)
                var employesPresents = pointagesJour
                    .Where(p => !string.IsNullOrEmpty(p.Preentmatup))
                    .Select(p => p.Empcod)
                    .Distinct()
                    .Count();

                dashboardData.EffectifPresent = employesPresents;
                dashboardData.PourcentagePresence = effectifTotal > 0
                    ? Math.Round((decimal)employesPresents / effectifTotal * 100, 2)
                    : 0;

                // 4. Calculer les heures travaillées en utilisant CalcTotHeuresService
                var heuresTravaillees = 0m;
                var heuresPreveues = 0m;
                var heuresSupplementairesTotales = 0m;
                var retardsTotaux = 0;
                var pointagesIncomplets = 0;

                foreach (var pointage in pointagesJour.Where(p => !string.IsNullOrEmpty(p.Preentmatup)))
                {
                    // Convertir Presence en PresenceDto pour utiliser les services existants
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

                    // Calculer les heures travaillées avec le service existant
                    var totHre = await _calcHeuresService.CalcHreTravOptimise(presenceDto);

                    if (!string.IsNullOrEmpty(totHre) && TimeSpan.TryParse(totHre, out var heureTravail))
                    {
                        heuresTravaillees += (decimal)heureTravail.TotalHours;
                    }

                    // Calculer heures supp et retards avec le service existant
                    var (nbHeurSupp, nbRetard) = await _calcHeuresService.CalculateDayWorkMetricsOptimise(presenceDto);

                    if (nbHeurSupp.HasValue)
                    {
                        heuresSupplementairesTotales += (decimal)(nbHeurSupp.Value); // Convertir minutes en heures
                        heuresTravaillees += heuresSupplementairesTotales;
                    }

                    retardsTotaux += nbRetard;

                    // Détecter les pointages incomplets (entrée sans sortie du jour précédent)
                    if (pointage.Predat < DateTime.Now.Date &&
                        !string.IsNullOrEmpty(pointage.Preentmatup) &&
                        string.IsNullOrEmpty(pointage.Presortamidiup))
                    {
                        pointagesIncomplets++;
                    }
                }

                // Récupérer les heures prévues selon les postes
                var heuresStandardParJour = 0m;
                foreach (var pointage in pointagesJour.Where(p => !string.IsNullOrEmpty(p.Preentmatup)))
                {
                    var heuresPoste = await _posteRepository.GetJourHeures(soccod, date, pointage.Codposte);
                    if (heuresPoste.HasValue)
                    {
                        heuresStandardParJour += (decimal)heuresPoste.Value;
                    }
                }

                heuresPreveues = heuresStandardParJour > 0 ? heuresStandardParJour : employesPresents * 8;

                dashboardData.HeuresTravaillees = Math.Round(heuresTravaillees, 2);
                dashboardData.HeuresPreveues = Math.Round(heuresPreveues, 2);
                dashboardData.PourcentageHeures = heuresPreveues > 0
                    ? Math.Round(heuresTravaillees / heuresPreveues * 100, 2)
                    : 0;
                dashboardData.HeuresSupplementaires = Math.Round(heuresSupplementairesTotales, 2);
                dashboardData.NombreRetards = retardsTotaux;
                dashboardData.PointagesIncomplets = pointagesIncomplets;

                // 5. Calculer les absences en utilisant le repository de congés
                var employesAbsents = effectifTotal - employesPresents;

                // Récupérer les congés approuvés pour ce jour
                var congesJour = await _context.Conges
                    .Where(c => c.Soccod == soccod &&
                                c.Condep <= date.Date &&
                                c.Conret >= date.Date)
                    .ToListAsync();

                if (!string.IsNullOrEmpty(dep) || (empcods != null && empcods.Any()))
                {
                    var empcodsFiltered = await employesQuery.Select(e => e.Empcod).ToListAsync();
                    congesJour = congesJour.Where(c => empcodsFiltered.Contains(c.Empcod)).ToList();
                }

                var nombreAbsencesJustifiees = congesJour.Count;
                var absencesNonJustifiees = employesAbsents - nombreAbsencesJustifiees;

                dashboardData.AbsencesJustifiees = nombreAbsencesJustifiees;
                dashboardData.AbsencesNonJustifiees = Math.Max(0, absencesNonJustifiees);
                dashboardData.TotalAbsences = employesAbsents;

                // 6. Récupérer les demandes de congés en attente
                var demandesCongesEnAttente = await _context.Demconges
                    .Where(c => c.Soccod == soccod)
                    .ToListAsync();

                if (!string.IsNullOrEmpty(dep) || (empcods != null && empcods.Any()))
                {
                    var empcodsFiltered = await employesQuery.Select(e => e.Empcod).ToListAsync();
                    demandesCongesEnAttente = demandesCongesEnAttente
                        .Where(d => empcodsFiltered.Contains(d.Empcod))
                        .ToList();
                }

                dashboardData.DemandesCongesEnAttente = demandesCongesEnAttente.Count;

                // 7. Récupérer les demandes d'autorisation en attente
                var demandesAutorisationsEnAttente = await _context.Autorisers
                    .Where(a => a.Soccod == soccod)
                    .ToListAsync();

             
                dashboardData.TotalDemandesEnAttente = dashboardData.DemandesCongesEnAttente;

                // 8. Récupérer les tendances (comparaison avec la veille)
                var dateVeille = date.AddDays(-1);
                var pointagesVeille = await _context.Presences
                    .Where(p => p.Soccod == soccod &&
                                p.Predat.HasValue &&
                                p.Predat.Value.Date == dateVeille.Date)
                    .ToListAsync();

                if (!string.IsNullOrEmpty(dep) || (empcods != null && empcods.Any()))
                {
                    var empcodsFiltered = await employesQuery.Select(e => e.Empcod).ToListAsync();
                    pointagesVeille = pointagesVeille.Where(p => empcodsFiltered.Contains(p.Empcod)).ToList();
                }

                var presentsVeille = pointagesVeille
                    .Where(p => !string.IsNullOrEmpty(p.Preentmatup))
                    .Select(p => p.Empcod)
                    .Distinct()
                    .Count();

                dashboardData.TendancePresence = employesPresents - presentsVeille;

                // 9. Données par département (si tous les départements sont sélectionnés)
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
        public async Task<List<EvolutionJournaliere>> GetEvolutionHebdomadaire(
            string soccod,
            DateTime dateDebut,
            DateTime dateFin,
            string dep,
            List<string> empcods)
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
                        statut.HeuresTravaillees = Math.Round((decimal)totHre.TotalHours, 2);
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
    }
}
