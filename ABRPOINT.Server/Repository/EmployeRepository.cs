using ABRPOINT.Helper;
using ABRPOINT.Server.CalculService.Conge;
using ABRPOINT.Server.CalculService.HeureRetard;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using AutoMapper;
using Microsoft.EntityFrameworkCore;
using Stripe;
using System.Reflection.Emit;
using System.Text.RegularExpressions;

namespace ABRPOINT.Server.Repository
{
    public class EmployeRepository : IEmployeRepository
    {
        private readonly ApplicationDbContext _dbContext;
        private readonly ISiteRepository _siteRepository;
        private readonly ICalendrierRepository _calendrierRepository;
        private readonly IParametreRepository _parametreRepository;
        private readonly ICongeRepository _congeRepository;
        private readonly IJourFerieRepository _ferierRepository;
        private readonly IHeureRetardService _retardService;
        private readonly IUtilisateurRepository _utilisateurRepository;
        private readonly IPosteRepository _posteRepository;
        private readonly IautoriserRepository _autorisationRepository;
        private readonly ICongeCalculationService _congeCalculationService;
        private readonly IMapper _mapper;
        private readonly ILogger<EmployeRepository> _logger;
        private readonly ABRPOINT.Server.CalculService.Rtt.IRttCalculationService _rttService;

        public EmployeRepository(ApplicationDbContext dbContext, ISiteRepository siteRepository, ICalendrierRepository icalendrierRepository,
            IParametreRepository parametreRepository, ICongeRepository congeRepository, IMapper mapper, ILogger<EmployeRepository> logger,
            IHeureRetardService retardService, IPosteRepository posteRepository, IJourFerieRepository ferierRepository,
            IUtilisateurRepository utilisateurRepository, IautoriserRepository autorisationRepository,
            ICongeCalculationService congeCalculationService,
            ABRPOINT.Server.CalculService.Rtt.IRttCalculationService rttService)
        {
            _dbContext = dbContext;
            _siteRepository = siteRepository;
            _calendrierRepository = icalendrierRepository;
            _parametreRepository = parametreRepository;
            _congeRepository = congeRepository;
            _posteRepository = posteRepository;
            _retardService = retardService;
            _utilisateurRepository = utilisateurRepository;
            _ferierRepository = ferierRepository;
            _autorisationRepository = autorisationRepository;
            _congeCalculationService = congeCalculationService;
            _mapper = mapper;
            _logger = logger;
            _rttService = rttService;
        }



        public async Task AddAsync(Employe employe)
        {
            try
            {
                if (!string.IsNullOrEmpty(employe.Soccod))
                {
                    employe.Empcod = employe.Empcod?.Trim();
                    employe.Soccod = employe.Soccod?.Trim();
                    employe.Sitcod = employe.Sitcod?.Trim();

                    // ⚠ IgnoreQueryFilters() : ApplicationDbContext applique un soft-delete global
                    // (DeletedAt IS NULL) sur Employe (BaseEntity). Sans ce bypass on rate les lignes
                    // soft-deleted ayant la même PK → INSERT en violation PK.
                    var existing = await _dbContext.Employes
                        .IgnoreQueryFilters()
                        .FirstOrDefaultAsync(e =>
                            e.Soccod == employe.Soccod &&
                            e.Empcod == employe.Empcod &&
                            e.Sitcod == employe.Sitcod);

                    if (existing != null)
                    {
                        if (existing.DeletedAt == null)
                        {
                            throw new InvalidOperationException(
                                $"Employe {employe.Empcod}-{employe.Soccod}-{employe.Sitcod} existe déjà.");
                        }

                        // Résurrection : la PK est libre côté logique mais occupée côté SQL.
                        // On réutilise la ligne soft-deleted en remettant DeletedAt à null et
                        // en écrasant les champs métier avec ceux de la nouvelle saisie.
                        existing.DeletedAt = null;
                        CopyEmployeFields(source: employe, target: existing);
                        await _dbContext.SaveChangesAsync();
                        return;
                    }

                    await _dbContext.Employes.AddAsync(employe);
                    await _dbContext.SaveChangesAsync();
                }
            }
            catch (Exception)
            {
                throw;
            }
        }

        // Copie tous les champs "métier" d'un Employe sur un autre, sans toucher à la PK
        // ni aux champs d'audit BaseEntity (CreatedAt, DeletedAt). Utilisé lors de la résurrection
        // d'une ligne soft-deleted pour réinitialiser ses données avec celles de la nouvelle saisie.
        private static void CopyEmployeFields(Employe source, Employe target)
        {
            target.Emplib = source.Emplib;
            target.Empmat = source.Empmat;
            target.Empsexe = source.Empsexe;
            target.Sercod = source.Sercod;
            target.Empfonc = source.Empfonc;
            target.Empreg = source.Empreg;
            target.Catcod = source.Catcod;
            target.Empnbp = source.Empnbp;
            target.Natcod = source.Natcod;
            target.Vilcod = source.Vilcod;
            target.Empadr = source.Empadr;
            target.Emptel = source.Emptel;
            target.Empmob = source.Empmob;
            target.Empemb = source.Empemb;
            target.Empsort = source.Empsort;
            target.Empmotif = source.Empmotif;
            target.Actif = source.Actif;
            target.Empdnais = source.Empdnais;
            target.Emplnais = source.Emplnais;
            target.Empcin = source.Empcin;
            target.Empdcin = source.Empdcin;
            target.Empacin = source.Empacin;
            target.Empsbase = source.Empsbase;
            target.Empsbrut = source.Empsbrut;
            target.Empdir = source.Empdir;
            target.Emptype = source.Emptype;
            target.Empniv = source.Empniv;
            target.Emplibar = source.Emplibar;
            target.Empadrar = source.Empadrar;
            target.Empfoncar = source.Empfoncar;
            target.Foncod = source.Foncod;
            target.Quacod = source.Quacod;
            target.Empmaxhre = source.Empmaxhre;
            target.Empoptim = source.Empoptim;
            target.Dircod = source.Dircod;
            target.Empretraite = source.Empretraite;
            target.Caltype = source.Caltype;
            target.Empmaxjour = source.Empmaxjour;
            target.Empretard = source.Empretard;
            target.Empemail = source.Empemail;
            target.Empresp = source.Empresp;
            target.Empsnet = source.Empsnet;
            target.Empcontrat = source.Empcontrat;
            target.Empsitfam = source.Empsitfam;
            target.Empech = source.Empech;
            target.Empelon = source.Empelon;
            target.Empcat = source.Empcat;
            target.Empscat = source.Empscat;
            target.Empnuit = source.Empnuit;
            target.Empminhjour = source.Empminhjour;
            target.Emppanier = source.Emppanier;
            target.Seccod = source.Seccod;
            target.Poscod = source.Poscod;
            target.Empferepos = source.Empferepos;
            target.Empcmp = source.Empcmp;
            // Champs RTT (loi française) — propagés lors d'une résurrection soft-delete.
            target.EmpRttMethode = source.EmpRttMethode;
            target.EmpRttJoursAnnuel = source.EmpRttJoursAnnuel;
            target.EmpRttHeuresContrat = source.EmpRttHeuresContrat;
            target.EmpRttForfaitJours = source.EmpRttForfaitJours;
        }

        /// <summary>
        /// Restreint une requête employés aux sites accessibles au demandeur. uticod null =
        /// appelant legacy non scopé (rétrocompat). Admin = aucune restriction. Sinon : sites
        /// Socuser du demandeur, + service si manager.
        /// </summary>
        private async Task<IQueryable<Employe>> ApplySiteScopeAsync(IQueryable<Employe> query, string soccod, string? uticod)
        {
            if (string.IsNullOrEmpty(uticod)) return query;
            if (await IsPrivilegedViewerAsync(uticod)) return query;
            query = query.Where(e => e.Sitcod != null &&
                _dbContext.Socusers.Any(s => s.Soccod == soccod && s.Uticod == uticod && s.Sitcod == e.Sitcod));
            var managerSercod = await GetManagerServiceCodeAsync(soccod, uticod);
            if (!string.IsNullOrEmpty(managerSercod))
                query = query.Where(e => e.Sercod == managerSercod);
            return query;
        }

        public async Task<Dictionary<string?, EmployeStat>> GetStatistics(string soccod, string? uticod = null)
        {
            try
            {
                var baseQuery = await ApplySiteScopeAsync(
                    _dbContext.Employes.Where(e => e.Soccod == soccod), soccod, uticod);
                var result = await baseQuery
                                .GroupBy(e => e.Empniv ?? "Inconnu")
                                .Select(g => new
                                {
                                    Empniv = g.Key,
                                    Stats = new EmployeStat
                                    {
                                        TotalCount = g.Count(),
                                        Horaire = g.Count(e => e.Empreg == "H"),
                                        Mensuelle = g.Count(e => e.Empreg == "M")
                                    }
                                })
                                .ToDictionaryAsync(x => x.Empniv, x => x.Stats);

                return result;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<Dictionary<string, int>> GetEmployeeCountBySexAsync(string soccod, string? uticod = null)
        {
            try
            {
                var baseQuery = await ApplySiteScopeAsync(
                    _dbContext.Employes.Where(e => e.Soccod == soccod), soccod, uticod);
                var result = await baseQuery
                    .GroupBy(e => e.Empsexe ?? "Unknown")
                    .Select(g => new
                    {
                        Gender = g.Key,
                        Count = g.Count()
                    })
                    .ToDictionaryAsync(g => g.Gender, g => g.Count);
                return result;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<IEnumerable<EmpHoraireDto>> GetEmployesHoraire(string soccod, string empcod)
        {
            try
            {
                var empHoraires = await _dbContext.Employes
                    .Where(emp => emp.Empcod == empcod && emp.Soccod == soccod)
                    .Join(_dbContext.Lcategories.Where(c => c.Soccod == soccod),
                        emp => emp.Catcod,
                        lcat => lcat.Catcod,
                        (emp, lcat) => new { emp, lcat })
                    .Join(_dbContext.Postes.Where(p => p.Soccod == soccod),
                        combined => combined.lcat.Codposte,
                        p => p.Codposte,
                        (combined, p) => p)
                    .Distinct()
                    .ToListAsync();

                return _mapper.Map<List<EmpHoraireDto>>(empHoraires);
            }
            catch (Exception e)
            {
                _logger.LogCritical(
                    "Problème de récupération des horaires d'employés: {Exception}", e
                );
                return Enumerable.Empty<EmpHoraireDto>();
            }
        }

        public async Task<IEnumerable<Employe>> GetAllAsync()
        {
            // PERF/SEC — Cap dur : bloque le dump complet d'une table qui peut atteindre
            // plusieurs milliers de lignes sur un gros tenant. Cette méthode n'est utilisée
            // qu'en fallback interne (cf. GetAllAsync(soccod, uticod) ligne ~554) ; le flux
            // normal passe par GetBySitcodAndDircod ou GetByEmpcod (filtrés). Si un caller
            // a réellement besoin de toute la table, il doit passer par une méthode paginée.
            return await _dbContext.Employes
                .AsNoTracking()
                .OrderBy(e => e.Empcod)
                .Take(2000)
                .ToListAsync();
        }

        public async Task<(TimeSpan? Debut, TimeSpan? Fin)> GetEmpNuitIntervalle(string soccod, string empcod)
        {
            try
            {
                // Sélecteur Empnuit côté UI (EmployeModern.tsx) : "0" = Nuit normale,
                // "1" = Nuit spéciale. La valeur "9" historique = "ne pas compter".
                // Sémantique attendue ici :
                //   null / "" / "0"  → plage NORMALE  (Parametre.Nuitdeb / Nuitfin)
                //   "1"              → plage SPÉCIALE (Parametre.Nuitsdeb / Nuitsfin)
                //   "9" (ou autre)   → désactivé      → return (null,null) → 0 h nuit
                //
                // BUG corrigé 2026-05 : l'ancien code traitait "1" comme une valeur
                // inconnue et renvoyait (null,null), donc tout employé ayant choisi
                // "Nuit spéciale" obtenait 0 h nuit malgré la config société. De plus
                // une fiche jamais touchée (Empnuit null) bloquait aussi le calcul,
                // alors qu'on devrait retomber sur la plage normale par défaut.
                string? empnuit = await _dbContext.Employes
                    .Where(emp => emp.Soccod == soccod && emp.Empcod == empcod)
                    .Select(emp => emp.Empnuit)
                    .SingleOrDefaultAsync();

                bool useNormale = string.IsNullOrEmpty(empnuit) || empnuit == "0";
                bool useSpeciale = empnuit == "1";
                if (!useNormale && !useSpeciale)
                    return (null, null); // désactivé pour cet employé

                var param = await _dbContext.Parametres
                    .Where(p => p.Soccod == soccod)
                    .Select(p => new { p.Nuitdeb, p.Nuitfin, p.Nuitsdeb, p.Nuitsfin })
                    .FirstOrDefaultAsync();
                if (param == null)
                    return (null, null);

                string? deb = useNormale ? param.Nuitdeb : param.Nuitsdeb;
                string? fin_ = useNormale ? param.Nuitfin : param.Nuitsfin;

                TimeSpan? debut = TimeSpan.TryParse(deb, out var d) ? d : (TimeSpan?)null;
                TimeSpan? fin = TimeSpan.TryParse(fin_, out var f) ? f : (TimeSpan?)null;

                // Cas observé en prod : l'admin saisit l'heure de début (ex. 20:00) dans
                // ParamSoc → HeuresNuit, oublie de saisir l'heure de fin, puis sauvegarde.
                // Résultat : tout calcul H.Nuit retourne 0 silencieusement (le UI ne signale
                // pas le champ manquant). Plutôt que de bloquer le calcul, on retombe sur la
                // fin de nuit légale française par défaut (06:00, cf. Code du travail
                // L.3122-29 — plage 21h→6h ou 22h→7h). Si l'inverse se produit (fin sans
                // début), on défaute le début à 22:00 (autre borne légale).
                if (debut.HasValue && !fin.HasValue)
                {
                    fin = TimeSpan.FromHours(6);
                }
                else if (!debut.HasValue && fin.HasValue)
                {
                    debut = TimeSpan.FromHours(22);
                }

                return (debut, fin);
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<decimal> GetTotRetards(string empcod, DateTime dateDeb, DateTime dateFin, string soccod)
        {
            try
            {
                var presences = await _dbContext.Presences
                    .Where(p => p.Empcod == empcod && p.Dmdate >= dateDeb && p.Dmdate <= dateFin && p.Soccod == soccod)
                    .ToListAsync();

                decimal totalMinutes = 0;

                foreach (var p in presences)
                {
                    string? codpost = await _posteRepository.GetEmpPoste(p.Soccod, p.Empcod, p.Predat, p.Catcod);
                    var poste = await _posteRepository.GetPoste(p.Soccod, codpost);

                    PresenceDto presence = _mapper.Map<Presence, PresenceDto>(p);

                    if (presence.Dmdate == null)
                    {
                        _logger.LogWarning($"Dmdate est null pour la présence de l'employé {empcod}");
                        continue;
                    }

                    AutDto? autorisation = await _autorisationRepository.GetAutLib(
                        presence.Soccod,
                        presence.Empcod,
                        presence.Dmdate.Value
                    );

                    var retard = await _retardService.CalculateHeureRetard(presence, poste, autorisation);
                    totalMinutes += retard.Item1;
                }
                return totalMinutes;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors du calcul des retards pour l'employé {empcod}");
                throw;
            }
        }

        public async Task<Dictionary<string, int>> GetTotRetardsBatch(List<string> empcods, DateTime? dateDeb, DateTime? dateFin, string soccod)
        {
            if (empcods == null || !empcods.Any())
                return new Dictionary<string, int>();

            if (!dateDeb.HasValue || !dateFin.HasValue)
                throw new ArgumentException("dateDeb et dateFin sont obligatoires");

            // ?? Récupérer les dates d'emploi pour tous les employés
            var employeeDates = await _dbContext.Employes
                .Where(e => empcods.Contains(e.Empcod) && e.Soccod == soccod)
                .Select(e => new { e.Empcod, e.Empemb, e.Empsort })
                .ToDictionaryAsync(e => e.Empcod);

            // =====================================
            // 1?? Chargement des présences
            // =====================================
            var presences = await _dbContext.Presences
                .Where(p =>
                    empcods.Contains(p.Empcod) &&
                    p.Soccod == soccod &&
                    p.Dmdate.HasValue &&
                    p.Dmdate.Value >= dateDeb.Value &&
                    p.Dmdate.Value <= dateFin.Value)
                .ToListAsync();

            if (!presences.Any())
                return new Dictionary<string, int>();

            // =====================================
            // 2?? Charger les congés (batch) - ?? avec filtrage
            // =====================================
            var demandesConge = presences
                .Select(p => (p.Soccod, p.Empcod, p.Dmdate!.Value.Date))
                .Distinct()
                .Where(req =>
                {
                    var empDates = employeeDates.GetValueOrDefault(req.Empcod);
                    if (empDates == null) return true;
                    if (empDates.Empemb.HasValue && req.Date < empDates.Empemb.Value) return false;
                    if (empDates.Empsort.HasValue && req.Date >= empDates.Empsort.Value) return false;
                    return true;
                })
                .ToList();

            Dictionary<(string Soccod, string Empcod, DateTime Date), (string? Abslib, float? Connbjour)> conges =
                await _congeRepository.GetCongeLibBatchAsync(demandesConge);

            // =====================================
            // 3?? Charger les postes (batch)
            // =====================================
            var empdates = presences
                .Select(p => (p.Soccod, p.Empcod, p.Dmdate!.Value.Date, p.Codposte, p.Catcod))
                .Distinct()
                .ToList();

            var postesEmp = new Dictionary<(string soc, string Empcod, DateTime Date), string?>();
            foreach (var (soc, empcod, date, codposte, catcod) in empdates)
            {
                string? posteCode = await _posteRepository.GetEmpPoste(soc, empcod, date, catcod);

                if (string.IsNullOrEmpty(posteCode))
                {
                    posteCode = codposte;
                }

                postesEmp[(soc, empcod, date)] = posteCode;
            }

            var posteCodes = postesEmp.Values
                .Where(p => !string.IsNullOrEmpty(p))
                .Distinct()
                .ToList();

            var postes = new Dictionary<string, Poste>();
            foreach (var posteCod in posteCodes)
            {
                var poste = await _posteRepository.GetPoste(soccod, posteCod!);
                if (poste != null)
                    postes[posteCod!] = poste;
            }

            // =====================================
            // 4?? Autorisations (batch) - ?? avec filtrage
            // =====================================
            var demandesAut = presences
                .Select(p => (p.Empcod, p.Dmdate!.Value.Date))
                .Distinct()
                .Where(req =>
                {
                    var empDates = employeeDates.GetValueOrDefault(req.Empcod);
                    if (empDates == null) return true;
                    if (empDates.Empemb.HasValue && req.Date < empDates.Empemb.Value) return false;
                    if (empDates.Empsort.HasValue && req.Date >= empDates.Empsort.Value) return false;
                    return true;
                })
                .ToList();

            Dictionary<(string Empcod, DateTime Date), AutDto> autorisations =
                await _autorisationRepository.GetAutLibBatch(soccod, demandesAut);

            // =====================================
            // 5?? Calcul des retards
            // =====================================
            var result = new Dictionary<string, int>();

            foreach (var p in presences)
            {
                var date = p.Dmdate!.Value.Date;
                var congeKey = (p.Soccod, p.Empcod, date);

                // ? Skip if employee is on congé
                if (conges.TryGetValue(congeKey, out var congeData) &&
                    !string.IsNullOrEmpty(congeData.Abslib))
                    continue;

                // ? Récupérer le poste depuis le dictionnaire
                if (!postesEmp.TryGetValue((p.Soccod, p.Empcod, date), out var postEmp))
                    continue;

                // ? Récupérer les détails du poste depuis le dictionnaire
                if (string.IsNullOrEmpty(postEmp) || !postes.TryGetValue(postEmp, out var poste))
                    continue;

                var presenceDto = _mapper.Map<PresenceDto>(p);

                autorisations.TryGetValue(
                    (p.Empcod, date),
                    out var autorisation);

                int retard = (await _retardService
                    .CalculateHeureRetard(presenceDto, poste, autorisation)).Item1;

                if (retard <= 0)
                    continue;

                if (!result.ContainsKey(p.Empcod))
                    result[p.Empcod] = 0;

                result[p.Empcod] += retard;
            }

            return result;
        }

        public async Task<IEnumerable<EmployeDto>> GetAllAsync(string soccod, string uticod)
        {
            try
            {
                var query = _dbContext.Employes
                    .AsNoTracking()
                    .Where(e => e.Soccod == soccod);

                // Admin / Responsable RH : visibilité COMPLÈTE sur tout le personnel de la
                // société. Sans ce bypass, la liste était filtrée par les sites Socuser du
                // demandeur (et par service pour un manager) — d'où une liste VIDE pour le
                // RH dès qu'un employé était créé sur un site auquel le RH n'était pas
                // rattaché (ex. employé ajouté par un manager d'un autre site).
                var isPrivileged = await IsPrivilegedViewerAsync(uticod);
                if (!isPrivileged)
                {
                    query = query.Where(e =>
                        _dbContext.Socusers.Any(s => s.Soccod == soccod &&
                                                     s.Uticod == uticod &&
                                                     s.Sitcod == e.Sitcod));

                    string? managerSercod = await GetManagerServiceCodeAsync(soccod, uticod);
                    if (!string.IsNullOrEmpty(managerSercod))
                    {
                        query = query.Where(e => e.Sercod == managerSercod);
                    }
                }

                // On joint Utilisateurs côté serveur (LEFT JOIN sur Empcod=Uticod
                // pour le même Soccod) afin de remonter Utiimg dans le payload —
                // évite N+1 fetchs côté client pour l'avatar de chaque ligne.
                // Si l'employé n'a pas de compte utilisateur correspondant,
                // Utiimg reste null et l'UI tombe sur les initiales.
                var employes = await query
                    .Select(e => new EmployeDto
                    {
                        Empcod = e.Empcod,
                        Soccod = e.Soccod,
                        Sitcod = e.Sitcod,
                        Emplib = e.Emplib,
                        Empmat = e.Empmat,
                        Empreg = e.Empreg,
                        Empfonc = e.Empfonc,
                        Foncod = e.Foncod,
                        Empemb = e.Empemb,
                        Empsort = e.Empsort,
                        Actif = e.Actif,
                        Quacod = e.Quacod,
                        Sercod = e.Sercod,
                        Empferepos = e.Empferepos,
                        Empniv = e.Empniv,
                        Empcontrat = e.Empcontrat,
                        Empemail = e.Empemail,
                        // Pas de Soccod sur Utilisateur : l'isolation multi-tenant
                        // est assurée par le DbContext courant (chaque tenant a sa
                        // propre base). On joint donc uniquement sur Uticod=Empcod.
                        Utiimg = _dbContext.Utilisateurs
                            .Where(u => u.Uticod == e.Empcod)
                            .Select(u => u.Utiimg)
                            .FirstOrDefault()
                    })
                    .ToListAsync();

                return employes;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur lors de la récupération des employés");
                throw;
            }
        }

        public async Task<IEnumerable<Employe>> GetAllEmployesAsync(string soccod, string uticod)
        {
            // Check if soccod and uticod have values
            if (!string.IsNullOrEmpty(soccod) && !string.IsNullOrEmpty(uticod))
            {
                // Retrieve the list of sitcods associated with the provided soccod and uticod
                List<string> sitcods = await _dbContext.Socusers
                   .Where(s => s.Soccod == soccod && s.Uticod == uticod)
                   .Select(s => s.Sitcod)
                   .ToListAsync();

                // Filter Employes based on soccod and sitcods list
                return await _dbContext.Employes
                    .Where(e => e.Soccod == soccod && sitcods.Contains(e.Sitcod))
                    .ToListAsync();
            }

            // If soccod or uticod is null/empty, return all Employes
            return await GetAllAsync();
        }

        public async Task<Employe> GetByEmpcod(string soccod, string empcod)
        {
            try
            {
                var employe = await _dbContext.Employes.FirstOrDefaultAsync(s => s.Soccod == soccod && s.Empcod == empcod);
                return employe;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<Dictionary<string, string>> GetEmpLibs(string soccod, string uticod, string? sitcod = null, string? sercod = null, string? dircod = null, string? empreg = null)
        {
            try
            {
                var query = from e in _dbContext.Employes
                            join su in _dbContext.Socusers
                                on new { e.Soccod, e.Sitcod } equals new { su.Soccod, su.Sitcod }
                            where e.Soccod == soccod
                                  && e.Actif == "A"
                                  && su.Uticod == uticod
                            select e;

                // Admin / RH : pas de restriction service automatique (visibilité globale).
                if (!await IsPrivilegedViewerAsync(uticod))
                {
                    string? managerSercod = await GetManagerServiceCodeAsync(soccod, uticod);
                    if (!string.IsNullOrEmpty(managerSercod))
                    {
                        query = query.Where(e => e.Sercod == managerSercod);
                    }
                }

                if (!string.IsNullOrEmpty(sitcod))
                    query = query.Where(e => e.Sitcod == sitcod);

                if (!string.IsNullOrEmpty(sercod))
                    query = query.Where(e => e.Sercod == sercod);

                if (!string.IsNullOrEmpty(dircod))
                    query = query.Where(e => e.Dircod == dircod);

                // "T" est le sentinel front partagé avec EtatPresence/Retard/Absence
                // pour signifier « tous régimes » (cf. useEmployeeFilter.ts:48-53).
                // Sans ce skip, le filtre `Empreg == "T"` ne matchait aucun employé
                // (Empreg réel est "M" ou "H") → dropdown vide par défaut sur les
                // 3 écrans États dès qu'un user admin ouvrait la page sans rien filtrer.
                if (!string.IsNullOrEmpty(empreg) && empreg != "T")
                    query = query.Where(e => e.Empreg == empreg);

                // PERF — Cap dur à 5000 lignes. Sur un tenant ultra-volumineux, le dictionnaire
                // complet est lourd à transférer ET inutile pour l'UX (un dropdown employés
                // sans pagination devient inutilisable au-delà). Si un tenant dépasse, l'UI
                // doit basculer sur une recherche serveur (autocomplete avec ?q=...).
                var employes = await query.AsNoTracking()
                                          .Select(e => new { e.Empcod, e.Emplib })
                                          .Distinct()
                                          .Take(5000)
                                          .ToListAsync();

                var res = employes
                    .GroupBy(e => e.Empcod) // Distinct() peut laisser passer des libellés différents
                    .ToDictionary(g => g.Key, g => g.First().Emplib);

                return res;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur lors de la récupération des libellés employés");
                throw;
            }
        }

        public async Task<Dictionary<string, string>> GetFemmeLibs(string soccod, string uticod)
        {
            try
            {
                // Utiliser une jointure avec Socusers au lieu de Contains
                // Gestion allaitement : on liste TOUTES les collaboratrices (sexe = "F"),
                // quelle que soit leur situation familiale. L'ancien filtre
                // (Empsitfam == "M" || "D") excluait les célibataires et les fiches sans
                // situation renseignée → la liste apparaissait vide côté web.
                var employes = await (
                    from e in _dbContext.Employes
                    join su in _dbContext.Socusers
                        on new { e.Soccod, e.Sitcod } equals new { su.Soccod, su.Sitcod }
                    where e.Soccod == soccod
                        && e.Empsexe == "F"
                        && su.Uticod == uticod
                    select new { e.Empcod, e.Emplib }
                ).ToListAsync();

                // Conversion en dictionnaire en mémoire
                var result = employes.ToDictionary(e => e.Empcod, e => e.Emplib);

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur lors de la récupération des libellés des employées");
                throw;
            }
        }

        public async Task UpdateAsync(Employe employe)
        {
            if (employe != null)
            {
                _dbContext.Employes.Update(employe);
                await _dbContext.SaveChangesAsync();
            }
        }

        private string SumTimeSpans(List<string> timeSpans)
        {
            var total = TimeSpan.Zero;
            foreach (var ts in timeSpans.Where(t => !string.IsNullOrEmpty(t)))
            {
                if (TimeSpan.TryParse(ts, out var parsed))
                    total += parsed;
            }
            return total.ToString(@"hh\:mm\:ss");
        }

        private double CalculateHoursWithLimits(Presence presence, EmpparamPointageMois empparam)
        {
            float actualHours = (float)GenericMethodes.ConvertHHmmToDouble(presence.Tothre);

            // Limite 1: Maximum de l'employé (si configuré)
            if (empparam.Empmaxhre != 0)
                actualHours = MathF.Min(actualHours, (float)empparam.Empmaxhre);

            // Limite 2: Maximum du poste pour ce jour (si configuré)
            if (!string.IsNullOrEmpty(empparam.PosteMaxhre) &&
                TimeSpan.TryParse(empparam.PosteMaxhre, out var maxPosteHours))
            {
                actualHours = MathF.Min(actualHours, (float)maxPosteHours.TotalHours);
            }

            return actualHours;
        }

        private double journeeTime(float dayworkhours, EmpparamPointageMois empparam)
        {
            // PRIORITÉ 1: Utiliser les paramètres de l'employé (comportement actuel)
            if (empparam.Empminhjour != 0)
            {
                if (dayworkhours <= empparam.Empminhjour && dayworkhours > 1)
                    return 0.5;
                else
                    return 1;
            }
            // PRIORITÉ 2: Utiliser les paramètres du poste si disponibles
            if (empparam.PosteMinhJour.HasValue && empparam.PosteMinhDemiJour.HasValue)
            {
                if (dayworkhours >= empparam.PosteMinhJour.Value)
                    return 1; // Journée complète
                else if (dayworkhours >= empparam.PosteMinhDemiJour.Value)
                    return 0.5; // Demi-journée
                else
                    return 0; // Pas de journée comptée
            }

            return 1;
        }

        public async Task<IList<EmployeePresenceDto>> GetBySitcodAndDircod(string soccod, string uticod, string site, List<string>? empcods = null, string? empreg = null, string? service = null,
            DateTime? debut = null, DateTime? fin = null)
        {
            try
            {
                if (!debut.HasValue || !fin.HasValue)
                    throw new ArgumentException("debut et fin sont obligatoires");

                //if (empcods != null && empcods.Count == 0)
                //{
                //    return new List<EmployeePresenceDto>();
                //}

                // ?? Récupérer le paramètre d'arrondi
                var param = await _parametreRepository.GetEtatPeriodiqueParamAsync(soccod);
                float arrondi = param?.Arrondi ?? 0f;

                string? managerSercod = await GetManagerServiceCodeAsync(soccod, uticod);

                //var empcodsList = empcods?.ToList();

                // ==========================
                // 1?? Requête principale SQL
                // ==========================
                var baseQuery =
                    from e in _dbContext.Employes
                    join su in (
                        _dbContext.Socusers
                            .Where(s => s.Uticod == uticod && s.Soccod == soccod)
                            .Select(s => new { s.Soccod, s.Sitcod })
                            .Distinct()
                    ) on new { e.Soccod, e.Sitcod } equals new { su.Soccod, su.Sitcod }
                    join p in _dbContext.Presences
                        .Where(p => p.Predat >= debut.Value && p.Predat <= fin.Value && p.Soccod == soccod)
                        on e.Empcod equals p.Empcod
                    where e.Soccod == soccod
                          && e.Sitcod == site
                          && e.Actif == "A"
                          && (string.IsNullOrEmpty(managerSercod) || e.Sercod == managerSercod)
                          // "T" = sentinel front « tous régimes ». Sans le check ici,
                          // empreg="T" filtrait `e.Empreg == "T"` qui ne match aucun
                          // employé (régimes réels = "M" mensuel / "H" horaire).
                          && (string.IsNullOrEmpty(empreg) || empreg == "T" || e.Empreg == empreg)
                          && (string.IsNullOrEmpty(service) || e.Sercod == service)
                          && (empcods == null || empcods.Count == 0 || empcods.Contains(e.Empcod))
                          // ⚠ Filtrer par période d'emploi : un employé embauché en cours de
                          // période (ex: Fares Bahloul, embauché le 6 mai) ne doit PAS voir
                          // son TotalMinutes gonflé par des présences pré-embauche (imports
                          // legacy, saisies manuelles antérieures, etc.). Idem pour le post-sortie.
                          && (!e.Empemb.HasValue || p.Predat >= e.Empemb.Value)
                          && (!e.Empsort.HasValue || p.Predat < e.Empsort.Value)
                    orderby e.Empcod, p.Predat, p.Tothre descending
                    select new
                    {
                        e.Empcod,
                        e.Emplib,
                        p.Predat,
                        p.Tothre,
                        p.Dmdate,
                        p.Tothsup,
                        p.Totcmp
                    };

                //if (empcodsList != null && empcodsList.Any())
                //{
                //    baseQuery = baseQuery.Where(x => empcodsList.Contains(x.Empcod));
                //}

                // ================================
                // 2?? Matérialiser et dédupliquer
                // ================================
                var rawData = await baseQuery.ToListAsync();

                var presenceDataRaw = rawData
                .GroupBy(x => new { x.Empcod, x.Predat })
                .Select(g => new
                {
                    g.Key.Empcod,
                    Emplib = g.First().Emplib,
                    g.Key.Predat,
                    Dmdate = g.First().Dmdate,
                    MinutesArrondies = g.Sum(x =>
                    {
                        int totalMinutes = 0;

                        // Tothre
                        if (TimeSpan.TryParse(x.Tothre ?? "", out var tothre))
                        {
                            totalMinutes += (int)tothre.TotalMinutes;
                        }

                        // ? Tothsup
                        if (TimeSpan.TryParse(x.Tothsup ?? "", out var tothsup))
                        {
                            totalMinutes += (int)tothsup.TotalMinutes;
                        }

                        // ? Totcmp (heures décimales ? minutes)
                        if (x.Totcmp.HasValue)
                        {
                            totalMinutes += (int)TimeSpan.FromHours(x.Totcmp.Value).TotalMinutes;
                        }

                        return totalMinutes;
                    })
                })
                .OrderBy(x => x.Empcod)
                .ThenBy(x => x.Predat)
                .ToList();

                if (!presenceDataRaw.Any())
                    return new List<EmployeePresenceDto>();

                var empList = presenceDataRaw.Select(x => x.Empcod).Distinct().ToList();

                // ?? Récupérer les dates empemb et empsort pour tous les employés
                var employeeDates = await _dbContext.Employes
                    .Where(e => empList.Contains(e.Empcod) && e.Soccod == soccod)
                    .Select(e => new { e.Empcod, e.Empemb, e.Empsort })
                    .ToDictionaryAsync(e => e.Empcod);

                // ================================
                // 3?? Récupérer les jours fériés
                // ================================
                var feriers = await _ferierRepository.GetByFerdateBatch(soccod, debut.Value, fin.Value);
                var ferierDates = feriers.Keys.ToHashSet();

                // ================================
                // 4?? Récupérer TOUS les congés pour la période
                // ================================
                // ? Créer une liste de TOUTES les dates de la période pour chaque employé
                var allDatesInPeriod = new List<(string Soccod, string Empcod, DateTime Date)>();

                foreach (var emp in empList)
                {
                    // ?? Récupérer les dates d'emploi
                    var empDates = employeeDates.GetValueOrDefault(emp);

                    for (DateTime date = debut.Value.Date; date <= fin.Value.Date; date = date.AddDays(1))
                    {
                        // ?? Filtrer les dates hors période d'emploi
                        if (empDates != null)
                        {
                            if (empDates.Empemb.HasValue && date < empDates.Empemb.Value) continue;
                            if (empDates.Empsort.HasValue && date >= empDates.Empsort.Value) continue;
                        }

                        allDatesInPeriod.Add((soccod, emp, date));
                    }
                }

                // ? Récupérer tous les congés pour toutes les dates (déjà filtrées)
                var conges = await _congeRepository.GetCongeLibBatchAsync(allDatesInPeriod);
                var nbhconge = await _parametreRepository.GetNbhCongeAsync(soccod) ?? 0;

                // ================================
                // 5?? Calcul des heures de congés par employé
                // ================================
                var congeMinutesParEmp = allDatesInPeriod
                    .GroupBy(x => x.Empcod)
                    .ToDictionary(
                        g => g.Key,
                        g => g.Sum(x =>
                        {
                            var key = (x.Soccod, x.Empcod, x.Date);
                            if (conges.TryGetValue(key, out var congeData) &&
                                !string.IsNullOrEmpty(congeData.Abslib))
                            {
                                float heuresConge = (congeData.Connbjour.HasValue && congeData.Connbjour.Value == 0.5f)
                                    ? nbhconge * 0.5f
                                    : nbhconge;

                                return (int)TimeSpan.FromHours(heuresConge).TotalMinutes;
                            }
                            return 0;
                        })
                    );

                // ================================
                // 6?? Calcul des heures fériées travaillées
                // ================================
                var ferierTravailleParEmp = presenceDataRaw
                    .Where(x => x.MinutesArrondies > 0 && ferierDates.Contains(x.Predat.Value.Date))
                    .GroupBy(x => x.Empcod)
                    .ToDictionary(
                        g => g.Key,
                        g => g.Sum(x => x.MinutesArrondies)
                    );

                // ================================
                // 7?? Calcul des heures fériées non travaillées
                // ================================
                float ferierHeure = await _ferierRepository.GetTotheureFerierParPeriode(soccod, debut, fin) ?? 0;
                int ferierMinutesGlobal = (int)TimeSpan.FromHours(ferierHeure).TotalMinutes;

                // ================================
                // 8?? Agrégation par employé (heures normales)
                // ================================
                var presenceData = presenceDataRaw
                    .GroupBy(x => new { x.Empcod, x.Emplib })
                    .Select(g => new
                    {
                        g.Key.Empcod,
                        g.Key.Emplib,
                        TotalMinutes = g.Sum(x => x.MinutesArrondies)
                    })
                    .OrderBy(x => x.Empcod)
                    .ToList();

                if (!presenceData.Any())
                    return new List<EmployeePresenceDto>();

                // ================================
                // 9?? Données batch complémentaires
                // ================================
                var nbJours = await GetNbJoursBatch(empList, debut, fin, soccod);
                var retards = await GetTotRetardsBatch(empList, debut, fin, soccod);

                // ================================
                // ?? Assemblage final
                // ================================
                // ⚠ "Total heures" affiché dans la sidebar de l'État périodique = strictement
                // les heures POINTÉES (Tothre + Tothsup + Totcmp), agrégées dans x.TotalMinutes.
                //
                // Avant ce correctif, on additionnait :
                //   + ferierTravMinutes (déjà compris dans x.TotalMinutes → double comptage)
                //   + ferierMinutesGlobal (somme globale des ferheure de la période, NON
                //     filtrée par employé → tous les employés gonflaient de +32h sur un mois
                //     avec 4 fériés, qu'ils aient pointé ou pas)
                //   + congeMinutes (heures théoriques de congé, jamais pointées)
                // Résultat observé : un employé avec 03:17 pointé (1 seule journée) affichait
                // 70h51 au total. Les fériés/congés/repos ont déjà leurs compteurs dédiés en
                // tête de la vue (badges "4 Fériés", "10 Repos", etc.) — pas besoin de les
                // re-fusionner dans le total heures.
                return presenceData.Select(x => new EmployeePresenceDto
                {
                    Empcod = x.Empcod,
                    Emplib = x.Emplib,
                    TotalMinutes = x.TotalMinutes,
                    NbJours = nbJours.GetValueOrDefault(x.Empcod),
                    TotalRetards = retards.GetValueOrDefault(x.Empcod)
                }).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur GetBySitcodAndDircod");
                throw;
            }
        }

        public async Task<float?> GetNbJours(string empcod, DateTime? dateDeb, DateTime? dateFin)
        {
            try
            {
                float? nbJours = 0;
                var presences = await _dbContext.Presences
                    .Where(p => p.Empcod == empcod && p.Dmdate >= dateDeb && p.Dmdate <= dateFin)
                    .ToListAsync();

                foreach (var p in presences)
                {
                    var conge = await _congeRepository.GetCongeLibAsync(p.Soccod, p.Empcod, (DateTime)p.Dmdate);
                    if (GenericMethodes.IsValid1(p) && string.IsNullOrEmpty(conge) && !GenericMethodes.NotPresent(p))
                        nbJours++;
                }

                return nbJours;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<Dictionary<string, float>> GetNbJoursBatch(List<string> empcods, DateTime? dateDeb, DateTime? dateFin, string soccod)
        {
            if (empcods == null || !empcods.Any())
                return new Dictionary<string, float>();
            if (!dateDeb.HasValue || !dateFin.HasValue)
                throw new ArgumentException("dateDeb et dateFin sont obligatoires");

            // ?? Récupérer les dates d'emploi pour tous les employés
            var employeeDates = await _dbContext.Employes
                .Where(e => empcods.Contains(e.Empcod) && e.Soccod == soccod)
                .Select(e => new { e.Empcod, e.Empemb, e.Empsort })
                .ToDictionaryAsync(e => e.Empcod);

            // =====================================
            // 1?? Charger les jours fériés
            // =====================================
            var feriers = await _ferierRepository.GetByFerdateBatch(soccod, dateDeb.Value, dateFin.Value);
            var ferierDates = feriers.Keys.ToHashSet();

            // =====================================
            // 2?? Charger les présences (1 requête)
            // =====================================
            var presences = await _dbContext.Presences
                .Where(p =>
                    empcods.Contains(p.Empcod) &&
                    p.Dmdate.HasValue &&
                    p.Dmdate.Value >= dateDeb.Value &&
                    p.Dmdate.Value <= dateFin.Value
                    && p.Soccod == soccod)
                .GroupBy(p => new
                {
                    p.Empcod,
                    Date = p.Dmdate!.Value.Date
                })
                .Select(g => new
                {
                    g.Key.Empcod,
                    g.First().Tothre,
                    g.Key.Date,
                    Presence = g.First()
                })
                .ToListAsync();

            // ⚠ Filtrer côté mémoire (on a déjà chargé employeeDates ci-dessus) toutes
            // les présences hors période d'emploi : un jour pointé AVANT embauche ou
            // APRÈS sortie ne doit pas être compté comme « jour travaillé ». Sans ça,
            // une saisie héritée d'un import legacy gonfle le compteur NbJours pour un
            // employé fraîchement embauché.
            presences = presences
                .Where(p =>
                {
                    var empDates = employeeDates.GetValueOrDefault(p.Empcod);
                    if (empDates == null) return true;
                    if (empDates.Empemb.HasValue && p.Date < empDates.Empemb.Value) return false;
                    if (empDates.Empsort.HasValue && p.Date >= empDates.Empsort.Value) return false;
                    return true;
                })
                .ToList();

            if (!presences.Any() && !ferierDates.Any())
                return new Dictionary<string, float>();

            // =====================================
            // 3?? Charger les congés (batch) - ?? avec filtrage
            // =====================================
            var demandesConge = presences
                .Select(p => (p.Presence.Soccod, p.Empcod, p.Date))
                .Distinct()
                .Where(req =>
                {
                    var empDates = employeeDates.GetValueOrDefault(req.Empcod);
                    if (empDates == null) return true;
                    if (empDates.Empemb.HasValue && req.Date < empDates.Empemb.Value) return false;
                    if (empDates.Empsort.HasValue && req.Date >= empDates.Empsort.Value) return false;
                    return true;
                })
                .ToList();

            var conges = await _congeRepository.GetCongeLibBatchAsync(demandesConge);

            // =====================================
            // 4?? Pré-charger les emparam pour tous les employés
            // =====================================
            // PERF — Batch en 3 requêtes SQL au lieu de empcods × dates round-trips.
            var dates = presences
                .Select(p => p.Date)
                .Concat(ferierDates)
                .Distinct()
                .ToList();

            var empparams = await GetEmpparamBatchAsync(soccod, empcods, dates);

            // =====================================
            // 5?? Calcul NbJours (exclusion repos)
            // =====================================
            var result = new Dictionary<string, float>();

            // Traiter les présences
            foreach (var p in presences)
            {
                EmpparamPointageMois emparam = empparams[(p.Empcod, p.Date)];
                var res = 0d;

                if (!string.IsNullOrEmpty(p?.Tothre))
                    res = journeeTime((float)GenericMethodes.ConvertTimeToDecimal(p.Tothre), emparam);

                // ? Si c'est un jour férié AVEC présence
                if (feriers.TryGetValue(p.Date, out var ferier))
                {
                    res = journeeTime((float)ferier.Ferheure, emparam);

                    if (!result.ContainsKey(p.Empcod))
                        result[p.Empcod] = 0;

                    result[p.Empcod] += (float)res;
                    continue;
                }

                // ? Exclure les jours de repos
                if (p.Presence.Prerepos == "1")
                    continue;

                var key = (p.Presence.Soccod, p.Empcod, p.Date);
                var (abslib, connbjour) = conges.GetValueOrDefault(key);

                bool isValid =
                    GenericMethodes.IsPresent(p.Presence) &&
                    string.IsNullOrEmpty(abslib) &&
                    !GenericMethodes.NotPresent(p.Presence);

                if ((!isValid && connbjour == null) || connbjour == 1)
                    continue;

                if (!result.ContainsKey(p.Empcod))
                    result[p.Empcod] = 0;

                // ? Si Connbjour = 0.5, ajouter 0.5, sinon ajouter 1
                float journeeValue = (connbjour.HasValue && connbjour.Value == 0.5f) ? 0.5f : 1f;
                result[p.Empcod] += journeeValue;
            }

            // =====================================
            // 6?? Ajouter les jours fériés NON présents dans les présences
            // =====================================
            var presenceDates = presences
                .GroupBy(p => p.Empcod)
                .ToDictionary(
                    g => g.Key,
                    g => g.Select(p => p.Date).ToHashSet()
                );

            // Pour chaque employé, ajouter les jours fériés non couverts
            foreach (var empcod in empcods)
            {
                var employeePresenceDates = presenceDates.ContainsKey(empcod)
                    ? presenceDates[empcod]
                    : new HashSet<DateTime>();

                // Trouver les jours fériés que l'employé n'a pas dans ses présences
                var feriersSansPresence = ferierDates.Except(employeePresenceDates);

                foreach (var ferierDate in feriersSansPresence)
                {
                    // ?? Vérifier la période d'emploi pour les jours fériés
                    var empDates = employeeDates.GetValueOrDefault(empcod);
                    if (empDates != null)
                    {
                        if (empDates.Empemb.HasValue && ferierDate < empDates.Empemb.Value) continue;
                        if (empDates.Empsort.HasValue && ferierDate >= empDates.Empsort.Value) continue;
                    }

                    var ferierHeure = (float)feriers[ferierDate].Ferheure;
                    EmpparamPointageMois emparam = empparams[(empcod, ferierDate)];
                    var res = journeeTime(ferierHeure, emparam);

                    if (!result.ContainsKey(empcod))
                        result[empcod] = 0;

                    result[empcod] += (float)res;
                }
            }

            return result;
        }


        public async Task<EmpEtatConge> GetEmpEtatConge(string soccod, string empcod, string moisdeb, string moisfin, string annee)
        {
            return await _congeCalculationService.GetEmpEtatCongeAsync(soccod, empcod, moisdeb, moisfin, annee);
        }

        private double calc_conge_par_mois(string soccod, string mois, string annee, string empcod)
        {
            double nbjconge = 0;
            int anneeInt = int.Parse(annee);
            int moisInt = int.Parse(mois);
            DateTime wcng_deb = new DateTime(anneeInt, moisInt, 1); // Début du mois
            DateTime wcng_fin = wcng_deb.AddMonths(1).AddDays(-1); // Fin du mois

            var result = _dbContext.Conges
                .Join(
                    _dbContext.Absences,
                    conge => new { conge.Soccod, conge.Abscod },
                    absence => new { absence.Soccod, absence.Abscod },
                    (conge, absence) => new { Conge = conge, Absence = absence }
                )
                .Where(joined =>
                    joined.Conge.Empcod == empcod &&
                    (
                        (joined.Conge.Condep.HasValue && joined.Conge.Condep.Value >= wcng_deb && joined.Conge.Condep.Value <= wcng_fin) ||
                        (joined.Conge.Conret.HasValue && joined.Conge.Conret.Value >= wcng_deb && joined.Conge.Conret.Value <= wcng_fin)
                    ) &&
                    joined.Absence.Soccod == soccod &&
                    joined.Absence.Abscng == "0" && // Condition: abscng = '0'
                    joined.Absence.Abspayer == "O" // Condition: abspayer = 'O'
                )
                .Select(joined => joined.Conge)
                .ToList();

            // Calculer le nombre de jours pour chaque congé
            foreach (var conge in result)
            {
                if (conge.Condep.HasValue && conge.Conret.HasValue)
                {
                    DateTime condep = conge.Condep.Value; // Date de début du congé
                    DateTime conret = conge.Conret.Value; // Date de retour du congé

                    // Limiter les dates au mois en cours
                    if (condep < wcng_deb)
                        condep = wcng_deb;
                    if (conret > wcng_fin)
                        conret = wcng_fin;
                    if ((conge.Conamdep == "1" && conge.Conamret == "1") || (conge.Conamdep == "0" && conge.Conamret == "0"))
                        nbjconge += (conret - condep).TotalDays + 1; // Ajouter les jours (inclure le jour de départ)
                    else
                        nbjconge += (conret - condep).TotalDays + 0.5;
                }
            }

            return nbjconge;
        }

        public async Task<string> GetEmpReg(string soccod, string empcod)
        {
            try
            {
                string? empreg = await _dbContext.Employes
                    .Where(e => e.Soccod == soccod && e.Empcod == empcod)
                    .Select(e => e.Empreg)
                    .SingleOrDefaultAsync();
                return empreg;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<EmpRegNiveau> GetEmpRegNiveau(string soccod, string empcod)
        {
            try
            {
                EmpRegNiveau? empRegNiveau = await _dbContext.Employes
                .Where(e => e.Soccod == soccod && e.Empcod == empcod)
                .Select(e => new EmpRegNiveau
                {
                    EmpReg = e.Empreg,
                    EmpNiveau = e.Empniv
                })
                .SingleOrDefaultAsync();

                return empRegNiveau;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<string?> GetEmpPoste(string soccod, string empcod, DateTime? date)
        {
            try
            {
                if (date == null)
                    return null;

                // Step 1: Get employee's category
                string? catcod = await _dbContext.Employes
                    .Where(emp => emp.Soccod == soccod && emp.Empcod == empcod)
                    .Select(emp => emp.Catcod)
                    .FirstOrDefaultAsync();

                if (string.IsNullOrEmpty(catcod))
                    return null;

                // Step 2: Get all valid poste ranges for the exact date
                var dateMonth = date.Value.Month;
                var dateDay = date.Value.Day;
                var matchingPostes = await _dbContext.Lcategories
                    .Where(c => c.Soccod == soccod &&
                                c.Catcod == catcod &&
                                c.Catdu.Value.Month <= dateMonth &&
                                c.Catau.Value.Month >= dateMonth)
                    .ToListAsync();

                var dateYear = date.Value.Year;
                if (!matchingPostes.Any(mp => mp.Catdu.Value.Year == dateYear || mp.Catau.Value.Year == dateYear))
                {
                    matchingPostes = matchingPostes.Where(mp => mp.Catfixe == "1").ToList();
                }
                if (!matchingPostes.Any())
                    return null;

                int targetMonth = date.Value.Month;

                Lcategorie posteWithMonthMatch = matchingPostes[0];
                foreach (var lcat in matchingPostes)
                {
                    if (targetMonth >= lcat.Catdu.Value.Month && targetMonth <= lcat.Catau.Value.Month
                        && posteWithMonthMatch.Catdu <= date && posteWithMonthMatch.Catau >= date)
                        posteWithMonthMatch = lcat;
                }
                // If found, return it
                if (posteWithMonthMatch != null)
                    return posteWithMonthMatch.Codposte;

                // Else, fall back to the first valid match
                return matchingPostes.First().Codposte;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<bool> GetEmpRetard(string? soccod, string? empcod)
        {
            try
            {
                string? empretard = await _dbContext.Employes
                    .Where(emp => emp.Soccod == soccod && emp.Empcod == empcod)
                    .Select(emp => emp.Empretard)
                    .SingleOrDefaultAsync();
                if (string.IsNullOrEmpty(empretard) || empretard == "1")
                    return false;
                return true;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task AddMultipleEmploye(List<Employe> employe)
        {
            try
            {
                if (employe.Count != 0)
                {
                    var soccods = employe
                        .Where(e => !string.IsNullOrEmpty(e.Soccod))
                        .Select(e => e.Soccod)
                        .Distinct()
                        .ToList();

                    var empcods = employe
                        .Where(e => !string.IsNullOrEmpty(e.Empcod))
                        .Select(e => e.Empcod)
                        .Distinct()
                        .ToList();

                    var sitcods = employe
                        .Where(e => !string.IsNullOrEmpty(e.Sitcod))
                        .Select(e => e.Sitcod)
                        .Distinct()
                        .ToList();

                    var existingKeys = await _dbContext.Employes
                        .Where(e => soccods.Contains(e.Soccod) && empcods.Contains(e.Empcod) && sitcods.Contains(e.Sitcod))
                        .Select(e => new { e.Soccod, e.Empcod, e.Sitcod })
                        .ToListAsync();

                    var newEmployes = employe
                        .Where(e => !string.IsNullOrEmpty(e.Soccod) && !string.IsNullOrEmpty(e.Empcod) && !string.IsNullOrEmpty(e.Sitcod))
                        .Where(e => !existingKeys.Any(ex => ex.Soccod == e.Soccod && ex.Empcod == e.Empcod && ex.Sitcod == e.Sitcod))
                        .ToList();

                    if (newEmployes.Count > 0)
                    {
                        await _dbContext.AddRangeAsync(newEmployes);
                        await _dbContext.SaveChangesAsync();
                    }
                }
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<List<EmpDepassMxHre>> GetEmployesDepassantMaxHeure(string soccod, string uticod)
        {
            try
            {
                var sitcods = await _utilisateurRepository.GetSitcodsAccessAsync(soccod, uticod);
                DateTime yesterday = DateTime.Today.AddDays(-1);
                DateTime today = DateTime.Today;

                var result = (from p in _dbContext.Presences
                              join e in _dbContext.Employes
                                  on p.Empcod equals e.Empcod into empJoin
                              from e in empJoin.DefaultIfEmpty() // LEFT JOIN
                              where p.Soccod == soccod &&
                                    p.Predat >= yesterday &&
                                    p.Predat < today &&
                                    sitcods.Contains(e.Sitcod)
                              select new { Presence = p, Employe = e })
                             .AsEnumerable() // switch to client-side evaluation
                             .Where(x => GenericMethodes.IsValidHHmm(x.Presence.Tothre)) // optional
                             .Select(x => new EmpDepassMxHre
                             {
                                 Empcod = x.Presence.Empcod!,
                                 Soccod = x.Presence.Soccod!,
                                 Sitcod = x.Presence.Sitcod!,
                                 Empmat = x.Presence.Empmat,
                                 Emplib = x.Employe?.Emplib ?? "---", // handles null (LEFT JOIN)
                                 Date = x.Presence.Predat,
                                 Heure = (float?)GenericMethodes.ConvertHHmmToDouble(x.Presence.Tothre)
                             })
                             .Where(x => x.Heure >= 12)
                             .ToList();
                return result;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<Employe> UpdateEmployeAsync(Employe employe)
        {
            try
            {
                // Recherche stricte (Soccod, Sitcod, Empcod). Si le frontend a envoyé un Sitcod
                // qui ne correspond pas à la fiche réelle (cas typique : manager dont auth.sitcod
                // ≠ sitcod de l'employé édité, ou fiche créée avec Sitcod vide), on retombe sur
                // (Soccod, Empcod) — Empcod identifie l'employé de manière unique en pratique.
                // Sans ce fallback l'UPDATE ne matchait aucune ligne et toutes les modifs (dont
                // catcod, caltype) étaient silencieusement perdues.
                var existing = await _dbContext.Employes
                    .FirstOrDefaultAsync(e => e.Empcod == employe.Empcod
                        && e.Soccod == employe.Soccod
                        && e.Sitcod == employe.Sitcod);

                if (existing == null)
                {
                    existing = await _dbContext.Employes
                        .FirstOrDefaultAsync(e => e.Empcod == employe.Empcod
                            && e.Soccod == employe.Soccod);
                }

                if (existing != null)
                {
                    // Mise à jour explicite de tous les champs
                    existing.Emplib = employe.Emplib;
                    existing.Empmat = employe.Empmat;
                    existing.Empsexe = employe.Empsexe;
                    existing.Sercod = employe.Sercod;
                    existing.Empfonc = employe.Empfonc;
                    existing.Empreg = employe.Empreg;
                    existing.Catcod = employe.Catcod;
                    existing.Empnbp = employe.Empnbp;
                    existing.Natcod = employe.Natcod;
                    existing.Vilcod = employe.Vilcod;
                    existing.Empadr = employe.Empadr;
                    existing.Emptel = employe.Emptel;
                    existing.Empmob = employe.Empmob;
                    existing.Empemb = employe.Empemb;
                    existing.Empsort = employe.Empsort;
                    existing.Empmotif = employe.Empmotif;
                    existing.Actif = employe.Actif;
                    existing.Empdnais = employe.Empdnais;
                    existing.Emplnais = employe.Emplnais;
                    existing.Empcin = employe.Empcin;
                    existing.Empdcin = employe.Empdcin;
                    existing.Empacin = employe.Empacin;
                    existing.Empsbase = employe.Empsbase;
                    existing.Empsbrut = employe.Empsbrut;
                    existing.Empdir = employe.Empdir;
                    existing.Emptype = employe.Emptype;
                    existing.Empniv = employe.Empniv;
                    existing.Emplibar = employe.Emplibar;
                    existing.Empadrar = employe.Empadrar;
                    existing.Empfoncar = employe.Empfoncar;
                    existing.Foncod = employe.Foncod;
                    existing.Quacod = employe.Quacod;
                    existing.Empmaxhre = employe.Empmaxhre;
                    existing.Empoptim = employe.Empoptim;
                    existing.Dircod = employe.Dircod;
                    existing.Empretraite = employe.Empretraite;
                    existing.Caltype = employe.Caltype;
                    existing.Empmaxjour = employe.Empmaxjour;
                    existing.Empretard = employe.Empretard;
                    existing.Empemail = employe.Empemail;
                    existing.Empresp = employe.Empresp;
                    existing.Empsnet = employe.Empsnet;
                    existing.Empcontrat = employe.Empcontrat;
                    existing.Empsitfam = employe.Empsitfam;
                    existing.Empech = employe.Empech;
                    existing.Empelon = employe.Empelon;
                    existing.Empcat = employe.Empcat;
                    existing.Empscat = employe.Empscat;
                    existing.Empnuit = employe.Empnuit;
                    existing.Empminhjour = employe.Empminhjour;
                    existing.Emppanier = employe.Emppanier;
                    existing.Seccod = employe.Seccod;
                    existing.Poscod = employe.Poscod;
                    existing.Empferepos = employe.Empferepos;
                    existing.Empcmp = employe.Empcmp;
                    // Champs RTT (loi française).
                    existing.EmpRttMethode = employe.EmpRttMethode;
                    existing.EmpRttJoursAnnuel = employe.EmpRttJoursAnnuel;
                    existing.EmpRttHeuresContrat = employe.EmpRttHeuresContrat;
                    existing.EmpRttForfaitJours = employe.EmpRttForfaitJours;

                    await _dbContext.SaveChangesAsync();

                    // Sync email avec Utilisateur automatiquement
                    if (!string.IsNullOrEmpty(employe.Empemail))
                    {
                        var user = await _dbContext.Utilisateurs
                            .FirstOrDefaultAsync(u => u.Uticod == employe.Empcod);

                        if (user != null && user.Utimail != employe.Empemail)
                        {
                            user.Utimail = employe.Empemail;
                            await _dbContext.SaveChangesAsync();
                        }
                    }

                    // Sync service (Sercod) Employe → Socuser : la fiche employé fait foi.
                    // On aligne le service de TOUTES les affectations site de la même personne
                    // (Empcod == Uticod) dans la même société, pour que l'écran Utilisateur ET
                    // le scoping manager (GetManagerServiceCodeAsync, qui lit socuser.sercod en
                    // priorité) voient le même service que la fiche employé. Bidirectionnel avec
                    // UtilisateurRepository.UpdateUserAsync (côté Socuser → Employe).
                    var socLinks = await _dbContext.Socusers
                        .Where(s => s.Soccod == employe.Soccod && s.Uticod == employe.Empcod)
                        .ToListAsync();
                    var socChanged = false;
                    foreach (var link in socLinks)
                    {
                        if (link.Sercod != employe.Sercod) { link.Sercod = employe.Sercod; socChanged = true; }
                    }
                    if (socChanged) await _dbContext.SaveChangesAsync();

                    return existing;
                }

                // Aucune ligne (Soccod, Sitcod, Empcod) enregistrée : on signale au lieu de
                // renvoyer un Employe vide qui ferait croire à un succès au contrôleur.
                throw new KeyNotFoundException(
                    $"Employé introuvable pour Soccod='{employe.Soccod}', Sitcod='{employe.Sitcod}', Empcod='{employe.Empcod}'.");
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<string> GetByEmpMat(string user_id)
        {
            try
            {
                string? emplib = await _dbContext.Employes.Where(e => e.Empmat == user_id).Select(e => e.Emplib).FirstOrDefaultAsync();
                return emplib;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task DeleteAsync(Employe employe)
        {
            if (employe != null)
            {
                _dbContext.Employes.Remove(employe);
                await _dbContext.SaveChangesAsync();
            }
        }

        public async Task<(bool Success, string Message)> DeleteEmployeAsync(Employe employe)
        {
            try
            {
                // Check if employee has presence records
                bool inPresence = await _dbContext.Presences
                    .AnyAsync(p => p.Empcod == employe.Empcod && p.Soccod == employe.Soccod);

                if (inPresence)
                {
                    return (false, "Impossible de supprimer l'employé : il existe des enregistrements de présence associés.");
                }

                // Check if employee has contracts
                bool hasContract = await _dbContext.Contrats
                    .AnyAsync(p => p.Empcod == employe.Empcod && p.Soccod == employe.Soccod);

                if (hasContract)
                {
                    return (false, "Impossible de supprimer l'employé : il existe des contrats associés.");
                }

                // Delete the employee
                _dbContext.Employes.Remove(employe);
                await _dbContext.SaveChangesAsync();

                return (true, "Employé supprimé avec succès.");
            }
            catch (Exception ex)
            {
                // SEC — Pas de fuite ex.Message vers le caller (qui le remonte au client).
                // Le détail est logué côté serveur.
                _logger.LogError(ex, "Erreur lors de la suppression de l'employé");
                return (false, "Erreur lors de la suppression de l'employé.");
            }
        }

        public async Task<string?> GetEmpPanier(string soccod, string empcod)
        {
            try
            {
                var emppanier = await _dbContext.Employes.Where(e => e.Soccod == soccod && e.Empcod == empcod)
                    .Select(e => e.Emppanier)
                    .FirstOrDefaultAsync();
                return emppanier;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<Dictionary<DateTime, string>> GetEmpPostesByPeriod(string soccod, string empcod, DateTime startDate, DateTime endDate)
        {
            try
            {
                // Get employee's category
                string? catcod = await _dbContext.Employes
                    .Where(emp => emp.Soccod == soccod && emp.Empcod == empcod)
                    .Select(emp => emp.Catcod)
                    .FirstOrDefaultAsync();

                if (string.IsNullOrEmpty(catcod))
                    return new Dictionary<DateTime, string>();

                // Get all lcategories for this employee's category
                var lcategories = await _dbContext.Lcategories
                    .Where(l => l.Soccod == soccod && l.Catcod == catcod)
                    .ToListAsync();

                if (!lcategories.Any())
                    return new Dictionary<DateTime, string>();

                // Build dictionary for each date in range
                var result = new Dictionary<DateTime, string>();
                DateTime currentDate = startDate.Date;

                while (currentDate <= endDate.Date)
                {
                    var month = currentDate.Month;
                    var year = currentDate.Year;

                    // Filter by month
                    var validMonth = lcategories
                        .Where(l => l.Catdu.HasValue && l.Catau.HasValue &&
                                   l.Catdu.Value.Month <= month &&
                                   l.Catau.Value.Month >= month)
                        .ToList();

                    // Filter by year or fixed categories
                    if (!validMonth.Any(l => l.Catdu!.Value.Year == year || l.Catau!.Value.Year == year))
                    {
                        validMonth = validMonth.Where(l => l.Catfixe == "1").ToList();
                    }

                    if (validMonth.Any())
                    {
                        // Select best match
                        var selected = validMonth.First();
                        foreach (var l in validMonth)
                        {
                            if (currentDate >= l.Catdu && currentDate <= l.Catau)
                            {
                                selected = l;
                                break;
                            }
                        }

                        if (!string.IsNullOrEmpty(selected.Codposte))
                        {
                            result[currentDate] = selected.Codposte;
                        }
                    }

                    currentDate = currentDate.AddDays(1);
                }

                return result;
            }
            catch (Exception)
            {
                throw;
            }
        }

        /// <summary>
        /// PERF — Version batch de <see cref="GetEmpparam"/>. Charge en 3 requêtes SQL
        /// (employes, lcategories pour codposte, postes) tout le matériel nécessaire,
        /// puis compose le dictionnaire (empcod, date) → EmpparamPointageMois en mémoire.
        ///
        /// Avant cette méthode, l'état périodique mensuel faisait
        /// `foreach (empcod) foreach (date) await GetEmpparam(...)` → 30 emp × 30 jours
        /// = 900 round-trips séquentiels (3+ SELECT chacun). Maintenant : ~3 SELECT au total.
        /// </summary>
        public async Task<Dictionary<(string Empcod, DateTime Date), EmpparamPointageMois>> GetEmpparamBatchAsync(
            string soccod,
            IEnumerable<string> empcods,
            IEnumerable<DateTime> dates)
        {
            var empcodList = empcods.Distinct().ToList();
            var dateList = dates.Distinct().ToList();
            var result = new Dictionary<(string, DateTime), EmpparamPointageMois>();

            if (empcodList.Count == 0 || dateList.Count == 0) return result;

            // 1. Tous les employés concernés en une seule requête.
            var employes = await _dbContext.Employes.AsNoTracking()
                .Where(e => e.Soccod == soccod && empcodList.Contains(e.Empcod))
                .Select(e => new
                {
                    e.Empcod,
                    e.Emppanier,
                    e.Empmaxhre,
                    e.Empmaxjour,
                    e.Empminhjour,
                })
                .ToDictionaryAsync(e => e.Empcod);

            // 2. Codes poste pour chaque couple (empcod, date) — le helper PosteRepository
            //    a déjà sa batch interne (1 SELECT employes, 1 SELECT lcategories), pas
            //    de round-trip par couple.
            var demandes = empcodList
                .SelectMany(e => dateList.Select(d => (Empcod: e, Date: d)))
                .ToList();
            // GetEmpPosteBatch retourne Dict<empcod, codposte> (indépendant de la date
            // dans son implémentation actuelle). On en dérive un lookup par empcod.
            var codePostesByEmp = await _posteRepository.GetEmpPosteBatch(soccod, demandes);

            // 3. Tous les Postes concernés en une seule requête.
            var codpostes = codePostesByEmp.Values
                .Where(c => !string.IsNullOrEmpty(c))
                .Cast<string>()
                .Distinct()
                .ToList();

            var postes = codpostes.Count == 0
                ? new Dictionary<string, Poste>()
                : await _dbContext.Postes.AsNoTracking()
                    .Where(p => p.Soccod == soccod && codpostes.Contains(p.Codposte))
                    .ToDictionaryAsync(p => p.Codposte);

            // 4. Composition en mémoire.
            foreach (var empcod in empcodList)
            {
                if (!employes.TryGetValue(empcod, out var emp)) continue;

                var baseparam = new EmpparamPointageMois
                {
                    Emppanier = emp.Emppanier,
                    Empmaxhre = emp.Empmaxhre,
                    Empmaxjour = emp.Empmaxjour,
                    Empminhjour = emp.Empminhjour,
                };

                codePostesByEmp.TryGetValue(empcod, out var codposte);
                Poste? poste = null;
                if (!string.IsNullOrEmpty(codposte))
                    postes.TryGetValue(codposte, out poste);

                foreach (var date in dateList)
                {
                    var entry = new EmpparamPointageMois
                    {
                        Emppanier = baseparam.Emppanier,
                        Empmaxhre = baseparam.Empmaxhre,
                        Empmaxjour = baseparam.Empmaxjour,
                        Empminhjour = baseparam.Empminhjour,
                    };
                    ApplyPosteParamsForDay(entry, poste, date);
                    result[(empcod, date)] = entry;
                }
            }

            return result;
        }

        private static void ApplyPosteParamsForDay(EmpparamPointageMois target, Poste? poste, DateTime date)
        {
            if (poste is null) return;
            switch (date.DayOfWeek)
            {
                case DayOfWeek.Monday:    target.PosteMaxhre = poste.Maxhrelun; target.PosteMinhJour = poste.Minhjourlun; target.PosteMinhDemiJour = poste.Minhdemijourlun; break;
                case DayOfWeek.Tuesday:   target.PosteMaxhre = poste.Maxhremar; target.PosteMinhJour = poste.Minhjourmar; target.PosteMinhDemiJour = poste.Minhdemijourmar; break;
                case DayOfWeek.Wednesday: target.PosteMaxhre = poste.Maxhremer; target.PosteMinhJour = poste.Minhjourmer; target.PosteMinhDemiJour = poste.Minhdemijourmer; break;
                case DayOfWeek.Thursday:  target.PosteMaxhre = poste.Maxhrejeu; target.PosteMinhJour = poste.Minhjourjeu; target.PosteMinhDemiJour = poste.Minhdemijourjeu; break;
                case DayOfWeek.Friday:    target.PosteMaxhre = poste.Maxhreven; target.PosteMinhJour = poste.Minhjourven; target.PosteMinhDemiJour = poste.Minhdemijourven; break;
                case DayOfWeek.Saturday:  target.PosteMaxhre = poste.Maxhresam; target.PosteMinhJour = poste.Minhjoursam; target.PosteMinhDemiJour = poste.Minhdemijoursam; break;
                case DayOfWeek.Sunday:    target.PosteMaxhre = poste.Maxhredim; target.PosteMinhJour = poste.Minhjourdim; target.PosteMinhDemiJour = poste.Minhdemijourdim; break;
            }
        }

        public async Task<EmpparamPointageMois> GetEmpparam(string soccod, string empcod, DateTime date, string? codpost)
        {
            try
            {
                // 1. Récupérer les paramètres de l'employé
                var emparam = await _dbContext.Employes
                    .Where(e => e.Soccod == soccod && e.Empcod == empcod)
                    .Select(e => new EmpparamPointageMois
                    {
                        Emppanier = e.Emppanier,
                        Empmaxhre = e.Empmaxhre,
                        Empmaxjour = e.Empmaxjour,
                        Empminhjour = e.Empminhjour,
                    })
                    .FirstOrDefaultAsync();

                if (emparam == null || date == null)
                    return emparam;

                // 2. Récupérer le code poste
                string? codPoste = !string.IsNullOrEmpty(codpost)
                    ? codpost
                    : await _posteRepository.GetEmpPoste(soccod, empcod, date, null);

                if (string.IsNullOrEmpty(codPoste))
                    return emparam;

                // 3. Récupérer le poste
                var poste = await _dbContext.Postes
                    .Where(p => p.Soccod == soccod && p.Codposte == codPoste)
                    .FirstOrDefaultAsync();

                if (poste == null)
                    return emparam;

                // 4. Extraire les paramètres selon le jour
                switch (date.DayOfWeek)
                {
                    case DayOfWeek.Monday:
                        emparam.PosteMaxhre = poste.Maxhrelun;
                        emparam.PosteMinhJour = poste.Minhjourlun;
                        emparam.PosteMinhDemiJour = poste.Minhdemijourlun;
                        break;
                    case DayOfWeek.Tuesday:
                        emparam.PosteMaxhre = poste.Maxhremar;
                        emparam.PosteMinhJour = poste.Minhjourmar;
                        emparam.PosteMinhDemiJour = poste.Minhdemijourmar;
                        break;
                    case DayOfWeek.Wednesday:
                        emparam.PosteMaxhre = poste.Maxhremer;
                        emparam.PosteMinhJour = poste.Minhjourmer;
                        emparam.PosteMinhDemiJour = poste.Minhdemijourmer;
                        break;
                    case DayOfWeek.Thursday:
                        emparam.PosteMaxhre = poste.Maxhrejeu;
                        emparam.PosteMinhJour = poste.Minhjourjeu;
                        emparam.PosteMinhDemiJour = poste.Minhdemijourjeu;
                        break;
                    case DayOfWeek.Friday:
                        emparam.PosteMaxhre = poste.Maxhreven;
                        emparam.PosteMinhJour = poste.Minhjourven;
                        emparam.PosteMinhDemiJour = poste.Minhdemijourven;
                        break;
                    case DayOfWeek.Saturday:
                        emparam.PosteMaxhre = poste.Maxhresam;
                        emparam.PosteMinhJour = poste.Minhjoursam;
                        emparam.PosteMinhDemiJour = poste.Minhdemijoursam;
                        break;
                    case DayOfWeek.Sunday:
                        emparam.PosteMaxhre = poste.Maxhredim;
                        emparam.PosteMinhJour = poste.Minhjourdim;
                        emparam.PosteMinhDemiJour = poste.Minhdemijourdim;
                        break;
                }

                return emparam;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<IEnumerable<Employe>> GetByEmpLib(string soccod, string name)
        {
            try
            {
                // PG : LOWER() des deux côtés. Sur SQL Server (French_CI_AS) la
                // comparaison ignorait la casse, sur Postgres VARCHAR elle ne l'ignore
                // plus — une recherche d'employé "Dupont" ne trouve plus "dupont"/"DUPONT".
                var nameLower = (name ?? string.Empty).Trim().ToLowerInvariant();
                var employes = await _dbContext.Employes
                    .Where(e => e.Soccod == soccod && e.Emplib != null && e.Emplib.ToLower() == nameLower)
                    .ToListAsync();
                return employes;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<List<Employe>> GetEmpMatList(string soccod, string term)
        {
            if (string.IsNullOrWhiteSpace(term))
                return new List<Employe>();

            var searchTerm = term.Trim();

            // Cas 1: Le terme est un matricule exact (uniquement des chiffres)
            if (Regex.IsMatch(searchTerm, @"^\d+$"))
            {
                var empByMat = await _dbContext.Employes
                    .FirstOrDefaultAsync(e => e.Soccod == soccod && e.Empmat == searchTerm);

                return empByMat != null ? new List<Employe> { empByMat } : new List<Employe>();
            }

            // Cas 2: Le terme est un nom ou une partie de nom
            var lowerTerm = searchTerm.ToLower();

            return await _dbContext.Employes
                .Where(e => e.Soccod == soccod &&
                       (e.Emplib.ToLower().Contains(lowerTerm)))
                .OrderBy(e => e.Emplib)
                .Take(20) // Limiter les résultats pour les performances
                .ToListAsync();
        }

        public async Task<List<Employe>> SearchByTerms(string soccod, List<string> terms)
        {
            if (terms == null || !terms.Any())
                return new List<Employe>();

            var allEmployees = new List<Employe>();

            foreach (var term in terms)
            {
                var employees = await GetEmpMatList(soccod, term);
                allEmployees.AddRange(employees);
            }

            // Retourner une liste unique (sans doublons)
            return (List<Employe>)allEmployees
                .GroupBy(e => e.Empcod)
                .Select(g => g.First());
        }

        public async Task<EmployeeKpiDto> GetMyKPIs(string soccod, string uticod)
        {
            // ObjectifHebdomadaire = 0 par défaut ; remplacé plus bas par la somme jour-par-jour
            // des heures planifiées dans le poste de l'employé pour la semaine en cours
            // (déduction faite des jours fériés et congés validés).
            var result = new EmployeeKpiDto();

            try
            {
                // 1. Get employee info
                var employe = await _dbContext.Employes
                    .AsNoTracking()
                    .FirstOrDefaultAsync(e => e.Soccod == soccod && e.Empcod == uticod);

                if (employe != null)
                {
                    result.Empcod = employe.Empcod;
                    result.Emplib = employe.Emplib;
                    result.Empreg = employe.Empreg;
                }

                // 2. Calculate solde conge using CongeCalculationService
                try
                {
                    var todayConge = DateTime.Today;
                    var moisfin = todayConge.Month.ToString("D2");
                    var annee = todayConge.Year.ToString();
                    var etatConge = await _congeCalculationService.GetEmpEtatCongeAsync(
                        soccod, uticod, "01", moisfin, annee);
                    result.SoldeConge = (float)etatConge.SoldeAnterieur;
                    result.CongeAcquis = (float)etatConge.DroitConge;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, $"Impossible de calculer le solde de congé pour l'employé {uticod}");
                }

                // 3. Calculate weekly worked hours
                var today = DateTime.Today;
                var dayOfWeek = (int)today.DayOfWeek;
                var mondayOffset = dayOfWeek == 0 ? -6 : 1 - dayOfWeek;
                var weekStart = today.AddDays(mondayOffset);
                var weekEnd = weekStart.AddDays(6);

                var weekPresenceData = await _dbContext.Presences
                    .AsNoTracking()
                    .Where(p => p.Empcod == uticod
                             && p.Soccod == soccod
                             && p.Predat >= weekStart
                             && p.Predat <= weekEnd)
                    .ToListAsync();

                var weekPresences = weekPresenceData
                    .GroupBy(p => p.Predat)
                    .Select(g => new
                    {
                        Date = g.Key,
                        TotalHours = (double)g.Sum(x => (float?)GenericMethodes.ConvertHHmmToDouble(x.Tothre) ?? 0f)
                    })
                    .ToList();

                var dayNames = new Dictionary<int, string>
                {
                    { 1, "LUN" }, { 2, "MAR" }, { 3, "MER" },
                    { 4, "JEU" }, { 5, "VEN" }, { 6, "SAM" }, { 0, "DIM" }
                };

                foreach (var p in weekPresences)
                {
                    if (p.Date.HasValue)
                    {
                        var dayName = dayNames.GetValueOrDefault((int)p.Date.Value.DayOfWeek, "");
                        if (!string.IsNullOrEmpty(dayName))
                        {
                            result.SuiviPointageSemaine[dayName] = (float)Math.Round(p.TotalHours, 2);
                        }
                    }
                }

                result.HeuresTravailleesSemaine = (float)Math.Round(weekPresences.Sum(p => p.TotalHours), 2);

                // Objectif hebdo : somme des heures planifiées dans le poste affecté à l'employé
                // pour chaque jour ouvré de la semaine (lun→dim), - jours fériés - congés validés.
                result.ObjectifHebdomadaire = await ComputeWeeklyObjectiveAsync(soccod, uticod, weekStart, weekEnd);

                result.PourcentageObjectif = result.ObjectifHebdomadaire > 0
                    ? Math.Min((float)Math.Round((result.HeuresTravailleesSemaine / result.ObjectifHebdomadaire) * 100, 1), 100)
                    : 0;

                // 4. Monthly pointage suivi (current month)
                var monthStart = new DateTime(today.Year, today.Month, 1);
                var monthEnd = monthStart.AddMonths(1).AddDays(-1);

                var monthPresences = await _dbContext.Pointsemainejs
                    .AsNoTracking()
                    .Where(p => p.Uticod == uticod
                             && p.Soccod == soccod
                             && p.Annee == today.Year.ToString()
                             && p.Mois == today.Month.ToString("D2"))
                    .ToListAsync();

                if (monthPresences.Any())
                {
                    var semaineFields = new[] {
                        Tuple.Create("Semaine1", "S1"), Tuple.Create("Semaine2", "S2"),
                        Tuple.Create("Semaine3", "S3"), Tuple.Create("Semaine4", "S4"),
                        Tuple.Create("Semaine5", "S5"), Tuple.Create("Semaine6", "S6")
                    };

                    foreach (var sp in monthPresences)
                    {
                        foreach (var field in semaineFields)
                        {
                            var prop = typeof(Pointsemainej).GetProperty(field.Item1);
                            var val = prop?.GetValue(sp)?.ToString();
                            if (!string.IsNullOrEmpty(val) && TimeSpan.TryParse(val, out var ts))
                            {
                                var label = field.Item2;
                                if (result.SuiviPointageMois.ContainsKey(label))
                                    result.SuiviPointageMois[label] += (float)ts.TotalHours;
                                else
                                    result.SuiviPointageMois[label] = (float)ts.TotalHours;
                            }
                        }
                    }
                }
                else
                {
                    // Fallback: aggregate from daily presences
                    var dailyMonthData = await _dbContext.Presences
                        .AsNoTracking()
                        .Where(p => p.Empcod == uticod
                                 && p.Soccod == soccod
                                 && p.Predat >= monthStart
                                 && p.Predat <= monthEnd)
                        .ToListAsync();

                    var dailyMonthPresences = dailyMonthData
                        .GroupBy(p => System.Globalization.ISOWeek.GetWeekOfYear(p.Predat!.Value))
                        .Select(g => new
                        {
                            TotalHours = (double)g.Sum(x => (float?)GenericMethodes.ConvertHHmmToDouble(x.Tothre) ?? 0f)
                        })
                        .ToList();

                    foreach (var wp in dailyMonthPresences.Select((p, i) => new { p, Label = $"S{i + 1}" }))
                    {
                        result.SuiviPointageMois[wp.Label] = (float)Math.Round(wp.p.TotalHours, 2);
                    }
                }

                // 5. Pending leave requests - check both Demconges AND Conges tables
                //var pendingDemconges = await _dbContext.Demconges
                //    .AsNoTracking()
                //    .Where(d => d.Soccod == soccod
                //             && d.Empcod == uticod
                //             && (d.Condg == null || d.Condg == "" || d.Condg == "0"))
                //    .Select(d => d.Concod)
                //    .ToListAsync();
                var allPending = await _dbContext.Demconges
                    .AsNoTracking()
                    .Where(d =>
                        d.Soccod == soccod &&
                        uticod == d.Empcod &&
                        !_dbContext.Conges.Any(c =>
                            c.Soccod == d.Soccod &&
                            c.Empcod == d.Empcod &&
                            c.Condep == d.Condep &&
                            c.Conret == d.Conret))
                    .ToListAsync();
                //var pendingConges = await _dbContext.Conges
                //    .AsNoTracking()
                //    .Where(c => c.Soccod == soccod
                //             && c.Empcod == uticod
                //             && (c.Condg == null || c.Condg == "" || c.Condg == "0")
                //             && c.Conrefus != "1")
                //    .Select(c => c.Concod)
                //    .ToListAsync();

                // Merge and deduplicate
                //var allPending = pendingDemconges.Concat(pendingConges).Distinct().ToList();
                result.DemandesEnAttente = allPending.Count;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erreur lors de la récupération des KPIs pour l'employé {uticod}");
            }

            // Solde RTT — n'est exposé que si l'employé est éligible (méthode ≠ 'N').
            // En cas d'échec on laisse Rtt à null pour que l'UI masque la carte sans erreur.
            try
            {
                var rttDto = await _rttService.GetRttSoldeAsync(soccod, uticod);
                if (rttDto != null && rttDto.Methode != "N")
                {
                    result.Rtt = new RttKpiDto
                    {
                        Methode = rttDto.Methode,
                        DroitAnnuel = rttDto.DroitAnnuel,
                        Pris = rttDto.Pris,
                        Solde = rttDto.Solde,
                    };
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, $"Impossible de récupérer le solde RTT pour {uticod}");
            }

            return result;
        }

        /// <summary>
        /// Vrai si l'utilisateur a une visibilité GLOBALE sur le personnel : SEUL
        /// l'administrateur (Utiadm='1' ou rôle Administrator) n'est jamais limité par site.
        /// Tous les autres profils (Responsable RH, Manager, employé…) sont scopés à leurs
        /// sites rattachés (Socuser) — décision métier : accès par site selon les droits.
        /// </summary>
        private async Task<bool> IsPrivilegedViewerAsync(string uticod)
        {
            var user = await _dbContext.Utilisateurs.AsNoTracking()
                .Where(u => u.Uticod == uticod)
                .Select(u => new { u.Utiadm, u.Utirole })
                .FirstOrDefaultAsync();
            if (user == null) return false;
            return user.Utiadm == "1"
                || ABRPOINT.Server.Authorization.PermissionCatalog.IsAdminRole(user.Utirole);
        }

        private async Task<string?> GetManagerServiceCodeAsync(string soccod, string uticod)
        {
            var user = await _dbContext.Utilisateurs.AsNoTracking()
                .FirstOrDefaultAsync(u => u.Uticod == uticod);

            if (user != null && user.Utiadm != "1")
            {
                if (user.Utirole == "Chef de service" || user.Utirole == "Manager" || user.Utirole == "Responsable")
                {
                    // Source prioritaire : le service affecté au compte (socuser.sercod), saisi
                    // depuis l'écran Utilisateur. Fallback : le service de la fiche employé liée
                    // (comptes existants où le manager est aussi un employé).
                    var socuserSercod = await _dbContext.Socusers.AsNoTracking()
                        .Where(s => s.Soccod == soccod && s.Uticod == uticod && s.Sercod != null)
                        .Select(s => s.Sercod)
                        .FirstOrDefaultAsync();
                    if (!string.IsNullOrEmpty(socuserSercod)) return socuserSercod;

                    var emp = await _dbContext.Employes.AsNoTracking()
                        .FirstOrDefaultAsync(e => e.Soccod == soccod && e.Empcod == uticod);
                    return emp?.Sercod;
                }
            }
            return null;
        }

        /// <summary>
        /// Objectif horaire de la semaine, lu depuis le calendrier société (Lcalendsoc) :
        /// pour chaque jour [weekStart..weekEnd] on prend la valeur CalNbh de la ligne dont
        /// le Caltype correspond à celui de l'employé. Cohérent avec NbhCalendSem utilisé
        /// par HeuresSupplementairesHebdomadairesService — une seule source de vérité côté
        /// objectif. Les jours fériés et congés validés sont retirés du total pour ne pas
        /// gonfler l'objectif sur des jours non travaillés.
        /// Best-effort : toute exception → 0 (l'UI affichera "h / 0h" plutôt que de planter).
        /// </summary>
        private async Task<float> ComputeWeeklyObjectiveAsync(string soccod, string empcod, DateTime weekStart, DateTime weekEnd)
        {
            try
            {
                // 1. Caltype de l'employé : index sur le calendrier société.
                var caltype = await _dbContext.Employes.AsNoTracking()
                    .Where(e => e.Soccod == soccod && e.Empcod == empcod)
                    .Select(e => e.Caltype)
                    .FirstOrDefaultAsync();
                if (string.IsNullOrEmpty(caltype)) return 0f;

                // 2. Lignes de calendrier sur la fenêtre de la semaine.
                var calRows = await _dbContext.Lcalendsocs.AsNoTracking()
                    .Where(c => c.Soccod == soccod
                                && c.Caltype == caltype
                                && c.CalDate >= weekStart && c.CalDate <= weekEnd)
                    .Select(c => new { c.CalDate, c.CalNbh })
                    .ToListAsync();
                if (calRows.Count == 0) return 0f;

                var hoursByDate = calRows
                    .Where(r => r.CalDate.HasValue)
                    .GroupBy(r => r.CalDate!.Value.Date)
                    .ToDictionary(g => g.Key, g => g.First().CalNbh ?? 0f);

                // 3. Jours fériés (la société peut en avoir 0..n sur la semaine).
                var feries = (await _dbContext.Feriers.AsNoTracking()
                        .Where(f => f.Soccod == soccod
                                    && f.Ferdate >= weekStart && f.Ferdate <= weekEnd)
                        .Select(f => f.Ferdate)
                        .ToListAsync())
                    .Where(d => d.HasValue)
                    .Select(d => d!.Value.Date)
                    .ToHashSet();

                // 4. Congés qui chevauchent la semaine (refusés exclus). On ignore demconge
                //    (en attente) pour éviter un objectif instable. Convention : conrefus="1".
                var conges = await _dbContext.Conges.AsNoTracking()
                    .Where(c => c.Soccod == soccod && c.Empcod == empcod
                                && (c.Conrefus == null || c.Conrefus != "1")
                                && c.Condep <= weekEnd && c.Conret >= weekStart)
                    .Select(c => new { c.Condep, c.Conret })
                    .ToListAsync();

                bool IsOnLeave(DateTime day)
                {
                    foreach (var c in conges)
                    {
                        if (c.Condep is null || c.Conret is null) continue;
                        if (c.Condep.Value.Date <= day && day <= c.Conret.Value.Date) return true;
                    }
                    return false;
                }

                float total = 0f;
                for (var day = weekStart.Date; day <= weekEnd.Date; day = day.AddDays(1))
                {
                    if (feries.Contains(day)) continue;
                    if (IsOnLeave(day)) continue;
                    if (!hoursByDate.TryGetValue(day, out var h)) continue;
                    total += h;
                }
                return (float)Math.Round(total, 2);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "ComputeWeeklyObjectiveAsync failed for {Empcod}", empcod);
                return 0f;
            }
        }

    }
}
