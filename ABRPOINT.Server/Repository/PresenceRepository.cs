using ABRPOINT.Helper;
using ABRPOINT.Server.CalculService.Conge;
using ABRPOINT.Server.CalculService.HeureAbsences;
using ABRPOINT.Server.CalculService.HeureNuit;
using ABRPOINT.Server.CalculService.HeureRetard;
using ABRPOINT.Server.CalculService.HeureSupp;
using ABRPOINT.Server.Controllers;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using AutoMapper;
using AutoMapper.QueryableExtensions;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Repository
{
    public class PresenceRepository : IPresenceRepository
   {
        private readonly ApplicationDbContext _dbContext;
        private readonly IPosteRepository _posteRepository;
        private readonly IParametreRepository _parametreRepository;
        private readonly IHeureSuppService _heureSuppService;
        private readonly IHeureRetardService _heureRetardService;
        private readonly IHeureNuitService _heureNuitService;
        private readonly IJourFerieRepository _jourFerierRepository;
        private readonly IAllaitementRepository _allaitementRepository;
        private readonly ICongeCalculationService _congeCalculationService;
        private readonly ICongeRepository _congeRepository;
        private readonly ISanctionRepository _sanctionRepository;
        private readonly IEmployeRepository _employeRepository;
        private readonly IHeureRetardService _retardService;
        private readonly IHeureAbsencesService _absenceService;
        private readonly IautoriserRepository _autorisationRepository;
        private readonly IUtilisateurRepository _utilisateurRepository;
        private readonly IDmpointService _dmpointRepository;
        private readonly IMapper _mapper;
        public PresenceRepository(
            ApplicationDbContext dbContext,IPosteRepository posteRepository,IHeureSuppService heureSuppService,IEmployeRepository employeRepository,
            IParametreRepository parametreRepository,IMapper mapper,IHeureRetardService heureRetardService,IHeureNuitService heureNuitService,
            IJourFerieRepository jourFerieRepository,IAllaitementRepository allaitementRepository,ICongeCalculationService congeCalculationService,
            ISanctionRepository sanctionRepository,ICongeRepository congeRepository,IHeureRetardService retardService,IHeureAbsencesService absencesService,
            IautoriserRepository autorisationRepository,IUtilisateurRepository utilisateurRepository,IDmpointService dmpointService)
        {
            _dbContext = dbContext;
            _posteRepository = posteRepository;
            _employeRepository = employeRepository;
            _heureSuppService = heureSuppService;
            _heureRetardService = heureRetardService;
            _heureNuitService = heureNuitService;
            _retardService = retardService;
            _absenceService = absencesService;
            _parametreRepository = parametreRepository;
            _jourFerierRepository = jourFerieRepository;
            _allaitementRepository = allaitementRepository;
            _congeCalculationService = congeCalculationService;
            _sanctionRepository = sanctionRepository;
            _autorisationRepository = autorisationRepository;
            _congeRepository = congeRepository;
            _utilisateurRepository = utilisateurRepository;
            _dmpointRepository = dmpointService;
            _mapper = mapper;
        }
        public async Task AddAsync(Presence presence)
        {
            await _dbContext.Presences.AddAsync(presence);
            await _dbContext.SaveChangesAsync();
        }

        public async Task DeleteAsync(Presence presence)
        {
            if (presence != null)
            {
                _dbContext.Presences.Remove(presence);
                await _dbContext.SaveChangesAsync();
            }
        }

        // Thread-safe cache (was Dictionary<string,int> which is not safe under concurrent requests).
        private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, int> _longbdgCache = new();

        public async Task<PresenceDto?> AddPresenceAsync(string soccod, string empcod, DateTime date, string poicod)
        {
            try
            {
                // ⚠ AsNoTracking : on lit la fiche employé en lecture seule pour éviter qu'EF
                // ne renvoie en base les modifications faites localement (typiquement
                // emp.Poscod = effectivePoste plus bas) à chaque pointage. Sans ça, chaque
                // mark-presence tentait de réécrire la ligne Employes ; en cas de modification
                // concurrente (autre flux RH, soft-delete) ça déclenche un DbUpdateException
                // intermittent qui remontait au front comme "erreur de pointage".
                var emp = await _dbContext.Employes
                    .AsNoTracking()
                    .FirstOrDefaultAsync(e => e.Soccod == soccod && e.Empcod == empcod);
                if (emp == null)
                    return null;

                // Code poste effectif : priorité au poste planifié pour la date (LPoste sur
                // catégorie/date), fallback sur Poscod fixe de la fiche.
                var effectivePoste = await _posteRepository.GetEmpPoste(emp.Soccod, emp.Empcod, date, emp.Catcod);
                if (string.IsNullOrEmpty(effectivePoste))
                    effectivePoste = emp.Poscod;

                // Classe horaire « Selon pointage » (Categorie.Catperiode = 'S') : plusieurs
                // postes coexistent dans la période, le bon est celui dont la plage de
                // tolérance contient l'instant du pointage. Sans ce reroutage, tous les
                // pointages atterriraient sur Lcategorie.Codposte (1er poste) et il faudrait
                // attendre l'optimisation batch (PointageOptimizer) pour réaffecter — ce qui
                // fausse les calculs temps réel (heures sup, retard, etc.).
                var pointagePoste = await ResolveSelonPointagePosteAsync(soccod, emp.Catcod, date);
                if (!string.IsNullOrEmpty(pointagePoste))
                    effectivePoste = pointagePoste;

                Poste? poste = null;
                if (!string.IsNullOrEmpty(effectivePoste))
                    poste = await _posteRepository.GetPoste(soccod, effectivePoste);

                var dbpresence = await _dbContext.Presences
                    .FirstOrDefaultAsync(p =>
                        p.Soccod == soccod &&
                        p.Empcod == empcod &&
                        p.Predat.HasValue &&
                        p.Predat.Value.Date == date.Date);

                if (dbpresence == null)
                {
                    // Snapshot non-tracké de l'employé pour CreateNewPresence — passe la valeur
                    // de poste effective sans repolluer le change tracker.
                    var empSnapshot = emp;
                    empSnapshot.Poscod = effectivePoste;
                    dbpresence = await CreateNewPresence(soccod, empcod, date, empSnapshot, poste);
                    await _dbContext.Presences.AddAsync(dbpresence);
                }
                else
                {
                    dbpresence.Codposte = effectivePoste; // Update existing presence with current effective poste
                    await UpdateExistingPresence(dbpresence, date, poste);
                }
                // ✅ VALIDATION DE TOUTES LES DATES
                ValidatePresenceDates(dbpresence);
                await _dmpointRepository.AddPointageAsync(dbpresence, date, poicod);
                await _dbContext.SaveChangesAsync();
                return _mapper.Map<PresenceDto>(dbpresence);
            }
            catch (Exception)
            {
                throw;
            }
        }

        // ✅ Méthode de validation
        private void ValidatePresenceDates(Presence presence)
        {
            var minDate = new DateTime(1753, 1, 1);
            var maxDate = new DateTime(9999, 12, 31);

            // Valider toutes les propriétés DateTime
            if (presence.Predat.HasValue && (presence.Predat.Value < minDate || presence.Predat.Value > maxDate))
                presence.Predat = DateTime.Now;

            if (presence.Preretmate.HasValue && (presence.Preretmate.Value < minDate || presence.Preretmate.Value > maxDate))
                presence.Preretmate = null;

            if (presence.Preretmats.HasValue && (presence.Preretmats.Value < minDate || presence.Preretmats.Value > maxDate))
                presence.Preretmats = null;

            if (presence.Preretame.HasValue && (presence.Preretame.Value < minDate || presence.Preretame.Value > maxDate))
                presence.Preretame = null;

            if (presence.Preretams.HasValue && (presence.Preretams.Value < minDate || presence.Preretams.Value > maxDate))
                presence.Preretams = null;

            if (presence.Preretmateup.HasValue && (presence.Preretmateup.Value < minDate || presence.Preretmateup.Value > maxDate))
                presence.Preretmateup = null;

            if (presence.Preretmatsup.HasValue && (presence.Preretmatsup.Value < minDate || presence.Preretmatsup.Value > maxDate))
                presence.Preretmatsup = null;

            if (presence.Preretameup.HasValue && (presence.Preretameup.Value < minDate || presence.Preretameup.Value > maxDate))
                presence.Preretameup = null;

            if (presence.Preretamsup.HasValue && (presence.Preretamsup.Value < minDate || presence.Preretamsup.Value > maxDate))
                presence.Preretamsup = null;

            if (presence.Dmdate.HasValue && (presence.Dmdate.Value < minDate || presence.Dmdate.Value > maxDate))
                presence.Dmdate = null;
        }

        // Cached version to avoid repeated database calls
        private async Task<string> FormatEmpcodCached(string soccod, string empcod)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(empcod) || string.IsNullOrWhiteSpace(soccod))
                {
                    return empcod ?? string.Empty;
                }

                // Get from database and cache it
                short? longbdg = await _parametreRepository.GetLongbdgAsync(soccod);
                // Extract numeric part and format
                string numericPart = new string(empcod.Where(char.IsDigit).ToArray());

                if (!string.IsNullOrEmpty(numericPart) && long.TryParse(numericPart, out long empcodNumber))
                {
                    return empcodNumber.ToString($"D{longbdg}");
                }

                return empcod;
            }
            catch (Exception)
            {
                return empcod ?? string.Empty;
            }
        }

        private async Task<Presence> CreateNewPresence(string soccod, string empcod, DateTime date, dynamic emp, dynamic poste)
        {
            try
            {
                var presence = new Presence()
                {
                    Preobs = "",
                    Ordre = 1,
                    Empcod = empcod,
                    Predat = date.Date,
                    Empmat = empcod,
                    Sitcod = emp?.Sitcod,
                    Codposte = emp?.Poscod,
                    Empreg = emp?.Empreg,
                    Catcod = emp?.Catcod,
                    Sercod = emp?.Sercod,
                    Dmdate = DateTime.Now.Date,
                    Soccod = soccod,
                    Preentmat = date.ToString("HH:mm"),
                    Preentmatup = date.ToString("HH:mm"),
                    Optimise = "N",
                    Totcmp = 0,
                    Preavantent = poste?.Avantent,
                    Preapresent = poste?.Apresent,
                    Preavantsort = poste?.Avantsort,
                    Preapressort = poste?.Apressort,
                    Empcharge = emp?.Emptype,
                    Prerepas = GenericMethodes.GetRepasWorkDay(date, poste),
                    Prerepos = GenericMethodes.GetReposWorkDay(date, poste),
                    Preretmate = DateTime.Today,
                    Preretmateup = DateTime.Today,
                    Preretmats = DateTime.Today,
                    Preretmatsup = DateTime.Today,
                    Preretame = DateTime.Today,
                    Preretameup = DateTime.Today,
                    Preretams = DateTime.Today,
                    Preretamsup = DateTime.Today,
                    Predouche = GenericMethodes.GetDoucheWorkDay(date, poste),
                };
                var presenceDto = _mapper.Map<PresenceDto>(presence);
                var retard = ((int, DateTime?, DateTime?, DateTime?, DateTime?, DateTime?, DateTime?, DateTime?, DateTime?)) 
                    await _heureRetardService.CalculateHeureRetard(presenceDto, poste, null);

                presence.Preretmate = retard.Item4;
                presence.Preretmateup = retard.Item5;
                presence.Preretmats = retard.Item6;
                presence.Preretmatsup = retard.Item7;
                presence.Preretame = retard.Item2;
                presence.Preretameup = retard.Item3;
                presence.Preretams = retard.Item8;
                presence.Preretamsup = retard.Item9;

                if (presence.Codposte != null)
                {
                    var empparam = await _employeRepository.GetEmpparam(presence.Soccod, presence.Empcod, (DateTime)presence.Dmdate, presence.Codposte);
                    presenceDto = _mapper.Map<PresenceDto>(presence);
                    presence.Tothre = await CalcHreTrav(presenceDto, poste, empparam);
                    presence.Tothsup = GenericMethodes.ConvertDoubleToHHmm((float)await _heureSuppService.CalculateHeureSuppOptimise(presenceDto, poste));
                    presence.Tothnuit = GenericMethodes.ConvertDoubleToHHmm(await _heureNuitService.CalculateHeureNuit(presenceDto));
                    //var abs = await _absenceService.CalculateHeureAbsences(presence, soccod, poste, date, null,
                    //(float)GenericMethodes.ConvertHHmmToDouble(presence.Tothre));
                    //presence.Tothabs = GenericMethodes.ConvertDoubleToHHmm());
                }
                return presence;
            }
            catch (Exception)
            {
                throw;
            }
        }

        private async Task UpdateExistingPresence(Presence dbpresence, DateTime date,Poste poste)
        {
            // ⚡ Récupération du paramètre parecart (en minutes).
            // P6 — Filtrer par soccod : sans WHERE, en multi-tenant on peut récupérer le
            // paramétrage d'une autre société. On retombe sur le 1er trouvé seulement si
            // la société courante n'a aucun param explicite (cas legacy).
            var soccod = dbpresence?.Soccod;
            var param = !string.IsNullOrEmpty(soccod)
                ? await _dbContext.Parametres.FirstOrDefaultAsync(p => p.Soccod == soccod)
                  ?? await _dbContext.Parametres.FirstOrDefaultAsync()
                : await _dbContext.Parametres.FirstOrDefaultAsync();
            float parecart = param?.Parecart ?? 0;

            string dateStr = date.ToString("HH:mm");

            // ✅ Check if update is allowed based on time difference
            if (!CanUpdatePresence(dbpresence, date, parecart))
                return;

            // ✅ Update the next available time slot
            await UpdateNextAvailableTimeSlot(dbpresence, dateStr, poste);
        }

        private bool CanUpdatePresence(Presence dbpresence, DateTime date, float parecart)
        {
            // ✅ Trouver la dernière valeur non vide (dernier log)
            string lastLog = GetLastLogTime(dbpresence);

            if (string.IsNullOrEmpty(lastLog))
                return true;

            // ⚡ Convertir en DateTime pour comparer
            if (DateTime.TryParseExact(lastLog, "HH:mm", null, System.Globalization.DateTimeStyles.None, out var lastLogTime))
            {
                TimeSpan diff = date.TimeOfDay - lastLogTime.TimeOfDay;
                return diff.TotalMinutes >= parecart;
            }

            return true;
        }

        private string GetLastLogTime(Presence dbpresence)
        {
            // Return the last non-empty time log in chronological order
            if (!string.IsNullOrEmpty(dbpresence.Presortamidi))
                return dbpresence.Presortamidi;
            if (!string.IsNullOrEmpty(dbpresence.Preentamidi))
                return dbpresence.Preentamidi;
            if (!string.IsNullOrEmpty(dbpresence.Presortmat))
                return dbpresence.Presortmat;
            if (!string.IsNullOrEmpty(dbpresence.Preentmat))
                return dbpresence.Preentmat;

            return null;
        }

        private async Task UpdateNextAvailableTimeSlot(Presence dbpresence, string timeStr,Poste poste)
        {
            if (string.IsNullOrEmpty(dbpresence.Presortmat))
            {
                dbpresence.Presortmat = timeStr;
                dbpresence.Presortmatup = timeStr;
            }
            else if (string.IsNullOrEmpty(dbpresence.Preentamidi))
            {
                dbpresence.Preentamidi = timeStr;
                dbpresence.Preentamidiup = timeStr;
            }
            else if (string.IsNullOrEmpty(dbpresence.Presortamidi))
            {
                dbpresence.Presortamidi = timeStr;
                dbpresence.Presortamidiup = timeStr;
            }
            var presenceDto = _mapper.Map<PresenceDto>(dbpresence);
            if (dbpresence.Codposte != null)
            {
                var empparam = await _employeRepository.GetEmpparam(presenceDto.Soccod, presenceDto.Empcod, (DateTime)presenceDto.Dmdate, dbpresence.Codposte);
                dbpresence.Tothre = await CalcHreTravOpt(presenceDto, poste, empparam);
                dbpresence.Tothsup = GenericMethodes.ConvertDoubleToHHmm((float)await _heureSuppService.CalculateHeureSuppOptimise(presenceDto, poste));
                dbpresence.Tothnuit = GenericMethodes.ConvertDoubleToHHmm(await _heureNuitService.CalculateHeureNuit(presenceDto));
                AutDto? autorisation = await _autorisationRepository.GetAutLib(dbpresence.Soccod, dbpresence.Empcod, (DateTime)dbpresence.Dmdate);
                dbpresence.Tothabs = GenericMethodes.ConvertDoubleToHHmm(await _absenceService.CalculateHeureAbsences(dbpresence, dbpresence.Soccod, dbpresence.Codposte,
                dbpresence.Predat, autorisation,(float)GenericMethodes.ConvertHHmmToDouble(dbpresence.Tothre)));
            }
        }

        private async Task UpdatePresenceCalculations(Presence dbpresence, dynamic poste)
        {
            var presenceDto = _mapper.Map<PresenceDto>(dbpresence);

            // ✅ Calculate night hours and format as "HH:mm"
            var nightHours = await _heureNuitService.CalculateHeureNuit(presenceDto);
            dbpresence.Tothnuit = FormatNightHours(nightHours);
            var empparam = await _employeRepository.GetEmpparam(dbpresence.Soccod, dbpresence.Empcod,(DateTime)dbpresence.Predat,dbpresence.Codposte);
            // ✅ Calculate overtime hours and format as "HH:mm"
            var overtimeMinutes = await _heureSuppService.CalculateHeureSupp(presenceDto, poste);
            var hretrav = await CalcHreTrav(presenceDto,poste,empparam);
            dbpresence.Tothsup = FormatMinutesToTimeSpan(overtimeMinutes);
        }

        private string FormatNightHours(object nightHours)
        {
            if (nightHours == null)
                return "00:00";

            // If it's already a string, try to parse and reformat it
            if (nightHours is string strValue)
            {
                if (string.IsNullOrEmpty(strValue))
                    return "00:00";

                // If it's already in HH:mm format, return as is
                if (TimeSpan.TryParse(strValue, out var timeSpan))
                    return timeSpan.ToString(@"hh\:mm");

                // If it's a number as string (minutes), convert it
                if (int.TryParse(strValue, out var minutes))
                    return TimeSpan.FromMinutes(minutes).ToString(@"hh\:mm");

                return strValue; // Return original if can't parse
            }

            // If it's an integer (minutes)
            if (nightHours is int intValue)
                return TimeSpan.FromMinutes(intValue).ToString(@"hh\:mm");

            // If it's a TimeSpan
            if (nightHours is TimeSpan timeSpanValue)
                return timeSpanValue.ToString(@"hh\:mm");

            // Default fallback
            return "00:00";
        }

        private string FormatTimeSpan(TimeSpan? timeSpan)
        {
            if (!timeSpan.HasValue)
                return "00:00";

            return timeSpan.Value.ToString(@"hh\:mm");
        }

        private string FormatMinutesToTimeSpan(int minutes)
        {
            var timeSpan = TimeSpan.FromMinutes(minutes);
            return timeSpan.ToString(@"hh\:mm");
        }


        public async Task<PresenceDto> GetAsync(string soccod, string empcod, DateTime predat)
        {
            try
            {
                PresenceDto? presence = await _dbContext.Presences
                    .ProjectTo<PresenceDto>(_mapper.ConfigurationProvider)
                    .Where(p => p.Soccod == soccod
                            && p.Empcod == empcod && p.Predat == predat)
                        .FirstOrDefaultAsync();

                return presence;
            }
            catch (Exception ex)
            {

                throw new Exception("", ex);
            }
        }
        public async Task<float?> GetNbJoursAsync(string empcod, DateTime? dateDeb, DateTime? dateFin)
        {
            try
            {
                float? nbJours = 0;
                var presences = await _dbContext.Presences
                    .Where(p => p.Empcod == empcod && p.Dmdate >= dateDeb && p.Dmdate <= dateFin)
                    .ToListAsync();

                if (presences.Count == 0) return 0;

                // P4 — Avant : un appel `GetCongeLibAsync` par présence (~30 round-trips SQL pour
                // un mois). Maintenant : 1 seule requête qui charge les chevauchements de congés
                // sur toute la fenêtre, puis on teste localement par date. Pour 30 présences ×
                // 1 mois = 1 requête au lieu de 30.
                var soccod = presences.First().Soccod;
                var minDate = presences.Min(p => p.Dmdate)!.Value;
                var maxDate = presences.Max(p => p.Dmdate)!.Value;

                var conges = await (
                    from c in _dbContext.Conges
                    where c.Soccod == soccod
                          && c.Empcod == empcod
                          && c.Condep <= maxDate
                          && (c.Conamret == "1" ? c.Conret >= minDate : c.Conret > minDate)
                    select new { c.Condep, c.Conret, c.Conamret }
                ).ToListAsync();

                bool DateIsCovered(DateTime date) =>
                    conges.Any(c => c.Condep <= date
                                    && (c.Conamret == "1" ? c.Conret >= date : c.Conret > date));

                foreach (var p in presences)
                {
                    var date = (DateTime)p.Dmdate!;
                    if (GenericMethodes.IsValid(p) && !DateIsCovered(date))
                        nbJours++;
                }

                return nbJours;
            }
            catch (Exception)
            {
                throw;
            }
        }

        // P5 — Sécurise le GetAllAsync sans filtre. La table Presences peut contenir des
        // millions de lignes en production ; un appel sans pagination saturerait la mémoire
        // et le TCP. Aucun appelant connu dans le code actuel (cf. audit S/P), mais
        // l'interface IRepository<Presence> impose la signature, donc on la garde et on
        // applique un plafond strict + ordre déterministe pour rester safe par défaut.
        private const int GetAllMaxRows = 1000;
        public async Task<IEnumerable<Presence>> GetAllAsync()
        {
            return await _dbContext.Presences
                .OrderByDescending(p => p.Predat)
                .Take(GetAllMaxRows)
                .ToListAsync();
        }

        public async Task<IEnumerable<EtatEmpPresence>> GetAllAsync(string soccod,DateTime dateDebut,DateTime dateFin,string regime,List<string> empcods)
        {
            try
            {

                // =========================
                // 1️⃣ Présences
                // =========================
                var presences = await (
                    from p in _dbContext.Presences
                    join e in _dbContext.Employes
                        on new { p.Soccod, p.Empcod } equals new { e.Soccod, e.Empcod } into empJoin
                    from e in empJoin.DefaultIfEmpty()
                    where p.Soccod == soccod
                          && p.Predat >= dateDebut
                          && p.Predat <= dateFin
                          && (regime == "T" || p.Empreg == regime)
                    select new { p, e }
                )
                .AsNoTracking()
                .ToListAsync();

                if (empcods != null && empcods.Any())
                    presences = presences.Where(x => empcods.Contains(x.p.Empcod)).ToList();

                var empList = presences.Select(x => x.p.Empcod).Distinct().ToList();
                var dates = presences.Select(x => x.p.Predat.Value.Date).Distinct().ToList();

                // =========================
                // 2️⃣ Congés (batch)
                // =========================
                var conges = await _dbContext.Conges
                    .Where(c => c.Soccod == soccod
                        && empList.Contains(c.Empcod)
                        && c.Condep <= dateFin
                        && c.Conret >= dateDebut)
                    .Select(c => new { c.Empcod, c.Condep, c.Conret })
                    .ToListAsync();

                // =========================
                // 3️⃣ Allaitements (batch)
                // =========================
                var allaitements = await _dbContext.Allaitements
                    .Where(a => a.Soccod == soccod
                        && empList.Contains(a.Empcod)
                        && dates.Contains(a.Condat.Value.Date))
                    .Select(a => new { a.Empcod, Date = a.Condat.Value.Date })
                    .ToListAsync();

                var allaitementSet = allaitements.ToHashSet();

                // =========================
                // 4️⃣ Absences / sanctions (batch)
                // =========================
                var sanctions = await _sanctionRepository
                    .GetAbsenceLibBatchAsync(soccod, null, dateDebut, dateFin);

                // =========================
                // 5️⃣ Construction mémoire
                // =========================
                // ── Recalcul live des retards ─────────────────────────────────────────
                // Les colonnes brutes Preretmat/amup/sup peuvent être périmées (un changement
                // de poste, d'autorisation ou la migration vers une nouvelle tolérance n'écrit
                // pas rétroactivement ces colonnes). EtatPériodique appelle systématiquement
                // _retardService.CalculateHeureRetard à la lecture ; on fait pareil ici pour
                // que l'État de Retards/Absences affiche les mêmes minutes que l'EtatPériodique.
                // Lookups poste + autorisation batchés pour rester en O(employés) au lieu de
                // O(présences) sur les requêtes externes.
                var demandesAut = presences
                    .Where(x => x.p.Predat.HasValue && !string.IsNullOrEmpty(x.p.Empcod))
                    .Select(x => (Empcod: x.p.Empcod!, Date: x.p.Predat!.Value.Date))
                    .Distinct()
                    .ToList();
                var autorisationsBatch = demandesAut.Count > 0
                    ? await _autorisationRepository.GetAutLibBatch(soccod, demandesAut)
                    : new Dictionary<(string Empcod, DateTime Date), AutDto>();

                var distinctEmps = presences
                    .Select(x => x.p.Empcod)
                    .Where(c => !string.IsNullOrEmpty(c))
                    .Distinct()
                    .ToList();
                var postesByEmp = new Dictionary<string, Dictionary<(string Empcod, DateTime Date), string?>>();
                foreach (var emp in distinctEmps)
                {
                    postesByEmp[emp!] = await _posteRepository.GetEmployePosteBatch(soccod, emp!, dateDebut, dateFin);
                }
                var posteCache = await _dbContext.Postes
                    .Where(po => po.Soccod == soccod)
                    .AsNoTracking()
                    .ToDictionaryAsync(po => po.Codposte!);

                var result = new List<EtatEmpPresence>();

                foreach (var item in presences)
                {
                    var p = item.p;
                    var date = p.Predat.Value.Date;

                    bool hasConge = conges.Any(c =>
                        c.Empcod == p.Empcod &&
                        c.Condep <= date &&
                        c.Conret >= date);

                    bool hasAllaitement = allaitementSet.Contains(new { Empcod = p.Empcod, Date = date });
                    string motif = sanctions
                        .FirstOrDefault(s =>
                            p.Empcod == s.Empcod &&
                            date.Date >= s.Condep.Date &&
                            date.Date <= s.Conret.Date)
                        ?.Abslib ?? "";

                    // Recompute retard via le même service que l'EtatPériodique. Si poste
                    // introuvable, on retombe sur les valeurs brutes pour ne rien casser.
                    TimeSpan retMatEup = p.Preretmateup?.TimeOfDay ?? TimeSpan.Zero;
                    TimeSpan retMatSup = p.Preretmatsup?.TimeOfDay ?? TimeSpan.Zero;
                    TimeSpan retAmEup = p.Preretameup?.TimeOfDay ?? TimeSpan.Zero;
                    TimeSpan retAmSup = p.Preretamsup?.TimeOfDay ?? TimeSpan.Zero;
                    int totRetMinutes = (int)(retMatEup + retMatSup + retAmEup + retAmSup).TotalMinutes;

                    if (!string.IsNullOrEmpty(p.Empcod) && postesByEmp.TryGetValue(p.Empcod, out var posteMap))
                    {
                        var codposte = posteMap.GetValueOrDefault((p.Empcod, date)) ?? p.Codposte;
                        if (!string.IsNullOrEmpty(codposte) && posteCache.TryGetValue(codposte, out var poste) && poste != null)
                        {
                            var dto = _mapper.Map<PresenceDto>(p);
                            dto.Soccod = soccod;
                            dto.Codposte = codposte;
                            dto.Dmdate ??= date;
                            var aut = autorisationsBatch.GetValueOrDefault((p.Empcod, date));
                            try
                            {
                                var calc = await _retardService.CalculateHeureRetard(dto, poste, aut);
                                totRetMinutes = calc.nbRetard;
                                retMatEup = calc.Preretmateup?.TimeOfDay ?? TimeSpan.Zero;
                                retMatSup = calc.Preretmatsup?.TimeOfDay ?? TimeSpan.Zero;
                                retAmEup = calc.Preretameup?.TimeOfDay ?? TimeSpan.Zero;
                                retAmSup = calc.Preretamsup?.TimeOfDay ?? TimeSpan.Zero;
                            }
                            catch
                            {
                                // En cas d'erreur de calcul (données partielles), on garde les valeurs brutes.
                            }
                        }
                    }

                    result.Add(new EtatEmpPresence
                    {
                        Predat = date,
                        Empcod = p.Empcod,
                        EmpSite = p.Sitcod,
                        Empmat = p.Empmat,
                        Regime = p.Empreg,
                        TotalHeure = p.Tothre,
                        Emplib = item.e?.Emplib ?? "Anonyme",
                        HeureNuit = p.Tothnuit,

                        Entree1 = p.Preentmatup,
                        Entree2 = p.Preentamidiup,
                        Sortie1 = p.Presortmatup,
                        Sortie2 = p.Presortamidiup,
                        Preretmateup = retMatEup,
                        Preretmatsup = retMatSup,
                        Preretameup = retAmEup,
                        Preretamsup = retAmSup,
                        TotalRetard = $"{totRetMinutes / 60:D2}:{totRetMinutes % 60:D2}",

                        HasConge = hasConge.ToString(),
                        Allaitement = hasAllaitement,
                        Motif = motif
                    });
                }

                return result
                    .OrderBy(r => r.Empcod)
                    .ThenBy(r => r.Predat)
                    .ToList();
            }
            catch (Exception)
            {
                throw;
            }
        }


        public Presence GetByAbscod(string soccod, string empcod)
        {
            return _dbContext.Presences.FirstOrDefault(s => s.Soccod == soccod && s.Empcod == empcod);
        }

        public async Task<IEnumerable<Presence>> GetEmpEtatPeriodiqueAsync(string soccod,string empcod)
        {
            return await _dbContext.Presences.Where(p=>p.Soccod == soccod && p.Empcod == empcod).ToListAsync();
        }
        public async Task<IEnumerable<PresenceDto>> GetEmpEtatPeriodiqueAsync(string soccod, string empcod, DateTime dateDeb, DateTime dateFin)
        {
            try
            {
                // 🆕 Fetch employee's embauche, sortie dates + default poste (fallback)
                var employe = await _dbContext.Employes
                    .Where(e => e.Soccod == soccod && e.Empcod == empcod)
                    .Select(e => new { e.Empemb, e.Empsort, e.Poscod })
                    .FirstOrDefaultAsync();
                dateDeb = dateDeb.Date;
                dateFin = dateFin.Date;
                DateTime? empemb = employe?.Empemb;
                DateTime? empsort = employe?.Empsort;
                string? defaultPoscod = employe?.Poscod;

                // 1️⃣ Récupérer les présences existantes
                var presenceList = await _dbContext.Presences
                    .ProjectTo<PresenceDto>(_mapper.ConfigurationProvider)
                    .Where(p => p.Soccod == soccod
                                && p.Empcod == empcod
                                && p.Predat >= dateDeb
                                && p.Predat <= dateFin)
                    .ToListAsync();

                // 2️⃣ Batch des postes
                var employePostes = await _posteRepository.GetEmployePosteBatch(soccod, empcod, dateDeb, dateFin);

                // 3️⃣ Batch des sanctions, autorisations, congés, feriés, poicod
                var sanctions = await _sanctionRepository.GetAbsenceLibBatchAsync(soccod, empcod, dateDeb, dateFin);
                var autorisations = await _autorisationRepository.GetAutLibBatch(soccod, empcod, dateDeb, dateFin);
                var conges = await _congeRepository.GetCongeEmployeLibBatchAsync(soccod, empcod, dateDeb, dateFin);
                var feriers = await _jourFerierRepository.GetByFerdateBatch(soccod, dateDeb, dateFin);
                var poicods = await _dmpointRepository.GetPoicodBatchAsync(soccod, empcod, dateDeb, dateFin);

                // 4️⃣ Construire un dictionnaire pour lookup rapide
                var presenceDict = presenceList.ToDictionary(p => p.Predat.Value.Date);

                var allDates = new List<PresenceDto>();

                var postesCache = await _dbContext.Postes.Where(p => p.Soccod == soccod).ToDictionaryAsync(p => p.Codposte);
                var baseEmpparam = await _employeRepository.GetEmpparam(soccod, empcod, dateDeb, null);

                for (DateTime date = dateDeb; date <= dateFin; date = date.AddDays(1))
                {
                    date = date.Date;
                    // 🆕 Helper function to check if date is within employment period
                    bool IsWithinEmploymentPeriod(DateTime checkDate)
                    {
                        if (empemb.HasValue && checkDate < empemb.Value) return false;
                        if (empsort.HasValue && checkDate >= empsort.Value) return false;
                        return true;
                    }

                    // 🆕 Skip days outside the employment window — pas avant l'embauche, pas
                    // après la sortie. Sans ce skip, l'état périodique listait ces jours
                    // avec Codposte vide → l'UI les marquait "Absent" alors que l'employé
                    // n'était pas (encore / plus) sous contrat.
                    if (!IsWithinEmploymentPeriod(date))
                        continue;

                    var effectivePoste = employePostes.GetValueOrDefault((Empcod: empcod, Date: date));
                    // Fallback to employee's default poste when Lcategories doesn't resolve a poste for this date
                    // (mirrors PostesController.GetEmployePoste step 3). Without this, absent days end up with empty
                    // Codposte → Tothabs / Etat="Absence" never computed. Only apply within the employment period
                    // to avoid marking pre-hire / post-termination days as Absence.
                    if (string.IsNullOrEmpty(effectivePoste) && IsWithinEmploymentPeriod(date))
                        effectivePoste = defaultPoscod;
                    presenceDict.TryGetValue(date.Date, out var presence);
                    if (presence == null)
                    {
                        presence = new PresenceDto
                        {
                            Soccod = soccod,
                            Empcod = empcod,
                            Dmdate = date,
                            Predat = date,
                            Codposte = effectivePoste
                        };
                    }
                    else if (!string.IsNullOrEmpty(effectivePoste))
                    {
                        presence.Codposte = effectivePoste;
                    }
                    presence.Tothabs = "00:00";
                    // 6?? Lookup batch - ?? with employment period validation
                    string? sanction = null;
                    if (IsWithinEmploymentPeriod(date))
                    {
                        var match = sanctions.FirstOrDefault(s =>
                            date.Date >= s.Condep.Date &&
                            date.Date <= s.Conret.Date);

                        if (match != null)
                        {
                            bool isReturnDay = date.Date == match.Conret.Date;
                            bool isDepartDay = date.Date == match.Condep.Date;

                            // If today is the return day and conamret is "0" → exclude this day entirely
                            if (isReturnDay && match.Conamret == "0")
                            {
                                sanction = null;
                            }
                            // If today is the return day and conamret is "1" → half day
                            else if (isReturnDay && match.Conamret == "1")
                            {
                                sanction = $"{match.Abslib} (0.5)";
                            }
                            // If today is the depart day and conamdep is "1" → half day (afternoon only)
                            else if (isDepartDay && match.Conamdep == "1")
                            {
                                sanction = $"{match.Abslib} (0.5)";
                            }
                            // Full day
                            else
                            {
                                sanction = match.Abslib;
                            }
                        }
                    }

                    AutDto? autorisation = null;
                    if (IsWithinEmploymentPeriod(date))
                    {
                        // Try exact date match first, then fallback to range-based matching
                        if (autorisations.TryGetValue((empcod, date.Date), out var autorisationValue))
                        {
                            autorisation = autorisationValue;
                        }
                        else
                        {
                            // Fallback: search by date range in case the batch key used a different date component
                            var autMatch = autorisations.FirstOrDefault(a =>
                                a.Key.Empcod == empcod &&
                                a.Key.Date.Date == date.Date);
                            if (autMatch.Value != null)
                                autorisation = autMatch.Value;
                        }
                    }

                    if (!feriers.TryGetValue(date, out var ferier)) ferier = null;

                    // ✅ Récupérer le congé avec Connbjour - 🆕 with employment period validation
                    string? conge = null;
                    float? connbjour = null;

                    if (IsWithinEmploymentPeriod(date))
                    {
                        var congeEntry = conges.FirstOrDefault(c =>
                            c.Key.Soccod == soccod &&
                            c.Key.Empcod == empcod &&
                            c.Key.Date == date);

                        if (congeEntry.Key != default)
                        {
                            conge = congeEntry.Value;
                            connbjour = congeEntry.Key.connbjour;
                        }
                    }

                    presence.Etat = sanction
                                    ?? autorisation?.Abslib
                                    ?? conge
                                    ?? (ferier != null ? $"Férié ({ferier.Fermotif})" : null);

                    // ✅ Populate explicit flags for reliable frontend classification
                    presence.HasAutorisation = autorisation != null;
                    presence.HasConge = !string.IsNullOrEmpty(conge);
                    // Sans ce flag, le front retombait sur un parsing de chaîne ("Férié …") qui
                    // ne matchait que dans la branche Codposte≠null (ligne ~943). Pour un jour
                    // férié hors du planning de l'employé (Codposte vide), Etat valait juste le
                    // motif (ex. "8 mai") → l'UI le classait en Absence. Le flag corrige ça.
                    presence.HasFerie = ferier != null;
                    if (autorisation != null)
                    {
                        presence.AutDebut = autorisation.Condep?.ToString("HH:mm");
                        presence.AutFin = autorisation.Conret?.ToString("HH:mm");
                    }

                    presence.Poicod = poicods.GetValueOrDefault((empcod, date));

                    if (string.IsNullOrEmpty(presence.Codposte))
                    {
                        presence.Codposte = employePostes.GetValueOrDefault((Empcod: empcod, Date: date));
                    }

                    if (!string.IsNullOrEmpty(presence.Codposte))
                    {
                        bool isRepos = false;
                        var (isPreRepos, emprepos) = await _parametreRepository.IsEmpcodReposAsync(soccod, date, presence.Codposte, empcod);
                        if (presence.Empmat == null)
                            isRepos = await _parametreRepository.IsReposAsync(soccod, date, presence.Codposte);

                        ArrondiParam? arrondiparams = await _parametreRepository.GetEtatPeriodiqueParamAsync(soccod);
                        presence.Arrondi = arrondiparams.Arrondi;
                        presence.Arrhsup = arrondiparams.Arrhsup;

                        if (isPreRepos || isRepos)
                        {
                            if (emprepos != "0" && emprepos != "-1")
                                presence.Etat = "J.Repos";
                            presence.Prerepos = "1";
                        }
                        var poste = await _posteRepository.GetPoste(soccod, presence.Codposte);
                        presence.TotalHeure = await _posteRepository.GetJourHeures(soccod, date, presence.Codposte);

                        EmpparamPointageMois empparam = baseEmpparam;

                        if (!string.IsNullOrEmpty(presence.Codposte))
                        {
                            empparam = GenericMethodes.EnrichEmpparamWithPoste(baseEmpparam, date, presence.Codposte, postesCache);
                        }

                        // Force recompute from punches: clear any stale Tothre stored in DB (a previous
                        // bug in CalculateHeureSupp's UpdateTothre side-effect could have stored the
                        // lateness amount as Tothre on incomplete pointages).
                        presence.Tothre = null;
                        presence.Tothre = await CalcHreTrav(presence, poste, empparam);
                        // Idem pour Tothsup : la colonne en base peut avoir été persistée avec une
                        // valeur négative ou périmée (même cause que pour Tothre). On recalcule
                        // depuis le Tothre frais ci-dessus pour que H. Suppl. reste cohérent avec
                        // ce qui est affiché à l'utilisateur.
                        if (poste != null)
                        {
                            try
                            {
                                presence.Tothsup = GenericMethodes.ConvertDoubleToHHmm(
                                    (float)await _heureSuppService.CalculateHeureSuppOptimise(presence, poste));
                            }
                            catch
                            {
                                // Si le recalcul échoue, on garde la valeur DB (mais elle peut être périmée).
                            }
                        }

                        // 🔴 CAS JOUR FÉRIÉ
                        if (ferier != null)
                        {
                            presence.Etat = $"Férié ({ferier.Fermotif})";
                            var ferHeure = await _jourFerierRepository.GetFerheure(soccod, presence.Dmdate);

                            // ⚠ Si l'employé a effectivement pointé ce jour férié (au moins
                            // une entrée matin ou AM), on conserve les heures réellement
                            // travaillées calculées via CalcHreTrav plus haut (ligne ~927).
                            // Avant ce correctif, on écrasait `Tothre` par la durée standard
                            // du férié (ou "00:00" si non configuré), masquant complètement
                            // les heures effectivement pointées. Conséquences observées :
                            //   - "Total Travaillé 00:00" alors que l'employé pointait 08-12
                            //   - "H.Fér.Trv 0" en pointage du mois car le moteur lisait
                            //     un Tothre forcé à zéro.
                            bool hasPunches =
                                !string.IsNullOrEmpty(presence.Preentmatup)
                                || !string.IsNullOrEmpty(presence.Presortmatup)
                                || !string.IsNullOrEmpty(presence.Preentamidiup)
                                || !string.IsNullOrEmpty(presence.Presortamidiup);

                            if (hasPunches && !string.IsNullOrEmpty(presence.Tothre) && presence.Tothre != "00:00")
                            {
                                // Heures pointées sur férié — déjà dans presence.Tothre.
                                // On expose le crédit férié contractuel via TotalHeure (utile
                                // pour le calcul de majoration côté front), sans écraser Tothre.
                                presence.TotalHeure = ferHeure ?? GenericMethodes.ConvertHHmmToDouble(presence.Tothre);
                            }
                            else if (ferHeure.HasValue)
                            {
                                // Pas de pointage : on affiche les heures contractuelles du férié.
                                var time = TimeSpan.FromHours(ferHeure.Value);
                                presence.Tothre = time.ToString(@"hh\:mm");
                                presence.TotalHeure = ferHeure;
                            }
                            else
                            {
                                presence.Tothre = "00:00";
                                presence.TotalHeure = 0;
                            }

                            if (empparam.Empminhjour != 0)
                            {
                                if (ferHeure <= empparam.Empminhjour && ferHeure > 1)
                                    presence.Jour = 0.5;
                                else
                                    presence.Jour = 1;
                            }
                            else
                                presence.Jour = 1;
                            allDates.Add(presence);
                            continue;
                        }

                        // ✅ CAS CONGÉ avec gestion de Connbjour
                        if (!string.IsNullOrEmpty(conge))
                        {
                            var nbhconge = await _parametreRepository.GetNbhCongeAsync(soccod);

                            float heuresConge = (connbjour.HasValue && connbjour.Value == 0.5f)
                                ? (nbhconge ?? 0) * 0.5f
                                : (nbhconge ?? 0);

                            var time = TimeSpan.FromHours(heuresConge);
                            presence.Tothre = time.ToString(@"hh\:mm");
                            presence.TotalHeure = heuresConge;

                            presence.Etat = $"{conge} {(connbjour ?? 1)}";
                            presence.Jour += (float)GenericMethodes.journeeTime(heuresConge, empparam);
                            allDates.Add(presence);
                            continue;
                        }
                        if (presence.Prerepos != "1")
                        {
                            var presenceEntity = _mapper.Map<Presence>(presence);
                            float? workedHours = GenericMethodes.ConvertHHmmToDouble(presence.Tothre);
                            presence.Tothabs = GenericMethodes.ConvertDoubleToHHmm(
                                await _absenceService.CalculateHeureAbsences(
                                    presenceEntity,
                                    soccod,
                                    presence.Codposte,
                                    presence.Predat,
                                    autorisation,
                                    workedHours));
                        }
                        TimeSpan totalTime = TimeSpan.Zero;

                        if (!string.IsNullOrEmpty(presence.Tothsup) && !string.IsNullOrEmpty(presence.Tothre))
                        {
                            if (TimeSpan.TryParse(presence.Tothsup, out TimeSpan tothsup) &&
                                TimeSpan.TryParse(presence.Tothre, out TimeSpan tothre))
                            {
                                totalTime = tothre.Add(tothsup);
                                //presence.Tothre = $"{(int)totalTime.TotalHours:D2}:{totalTime.Minutes:D2}";
                            }
                        }

                        if (!string.IsNullOrEmpty(presence.Tothre) && presence.Totcmp.HasValue)
                        {
                            if (TimeSpan.TryParse(presence.Tothre, out TimeSpan tothreActuel))
                            {
                                totalTime = tothreActuel.Add(TimeSpan.FromHours(presence.Totcmp.Value));
                                //presence.Tothre = $"{(int)totalTime.TotalHours:D2}:{totalTime.Minutes:D2}";
                            }
                        }
                        presence.Jour += (float)GenericMethodes.journeeTime((float)totalTime.TotalHours, empparam);

                        // Calcul du retard - 🆕 pass null if autorisation is outside employment period
                        int retard = (await _retardService.CalculateHeureRetard(presence, poste, autorisation)).Item1;
                        presence.Totret = $"{retard / 60:D2}:{retard % 60:D2}";

                        // 🔴 GESTION DES ABSENCES : si pas de pointage, pas de repos, pas de congé/férier/autorisation
                        if (string.IsNullOrEmpty(presence.Etat) && 
                            presence.Prerepos != "1" && 
                            (string.IsNullOrEmpty(presence.Tothre) || presence.Tothre == "00:00") &&
                            !string.IsNullOrEmpty(presence.Codposte))
                        {
                            presence.Etat = "Absence";
                        }
                    }

                    allDates.Add(presence);
                }

                return allDates;
            }
            catch (Exception)
            {
                throw;
            }
        }

        // PERF / SEC — `async void` était dangereux ici : les exceptions remontaient
        // au SynchronizationContext (pouvant crasher le process) et le caller croyait
        // l'opération synchrone, partant avant le SaveChanges. Conversion en
        // `async Task` pour que les rares appelants puissent l'await proprement.
        public async Task Update(Presence presence)
        {
            if (presence is null) return;
            await CalculatePresenceAsync(presence);
            _dbContext.Presences.Update(presence);
            await _dbContext.SaveChangesAsync();
        }
        public async Task CalculatePresenceAsync(Presence presence)
        {
            var transaction = await _dbContext.Database.BeginTransactionAsync();

            try
            {
                if (presence != null)
                {
                    var parameters = new[]
                    {
                        new SqlParameter("@psoccod", presence.Soccod ?? (object)DBNull.Value),
                        new SqlParameter("@psocmere", presence.Soccod ?? (object)DBNull.Value), // Assuming same as psoccod
                        new SqlParameter("@psitcod", presence.Sitcod ?? (object)DBNull.Value),
                        new SqlParameter("@pannee", presence.Predat?.Year.ToString() ?? (object)DBNull.Value),
                        new SqlParameter("@pmois", presence.Predat?.Month.ToString("00") ?? (object)DBNull.Value),
                        new SqlParameter("@pmodcod", presence.Preobs ?? "SYSTEM"), // Using Preobs as modcod?
                        new SqlParameter("@puticod", "API"), // Or get from auth context
                        new SqlParameter("@pempcod", presence.Empcod ?? (object)DBNull.Value),
                        new SqlParameter("@pempreg", presence.Empreg ?? "0"),
                        new SqlParameter("@pfontype", "1"), // Default value
                        new SqlParameter("@pempnuit", "0"), // Default value
                        new SqlParameter("@pempmaxhre", 10.0), // Default value or get from employee
                        new SqlParameter("@pempminhjour", 4.0), // Default value or get from employee
                        new SqlParameter("@pcaltype", "STANDARD"), // Default value
                        new SqlParameter("@pdte", presence.Predat ?? DateTime.Now),
                        new SqlParameter("@pcatcod", presence.Catcod ?? (object)DBNull.Value),
                        new SqlParameter("@pcodposte", presence.Codposte ?? (object)DBNull.Value),
                        new SqlParameter("@pdtedeb", presence.Predat ?? DateTime.Now), // Same as pdte
                        new SqlParameter("@pdtefin", presence.Predat ?? DateTime.Now),
            };

                    await _dbContext.Database.ExecuteSqlRawAsync(
                        "EXEC [dbo].[calcul_impupd] @psoccod, @psocmere, @psitcod, @pannee, @pmois, @pmodcod, @puticod, " +
                        "@pempcod, @pempreg, @pfontype, @pempnuit, @pempmaxhre, @pempminhjour, @pcaltype, @pdte, @pcatcod, " +
                        "@pcodposte, @pdtedeb, @pdtefin",
                        parameters);

                    await _dbContext.Entry(presence).ReloadAsync();
                    await transaction.CommitAsync();
                }
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                throw new Exception("Error calculating presence", ex);
            }
        }


        private async Task<(double? nbHeurSupp, int nbRetard)> CalculateDayWorkMetrics(PresenceDto presence)
        {
            try
            {
                // Add null check for Dmdate
                if (!presence.Dmdate.HasValue)
                {
                    return (0, 0);
                }
                string? codpost = await _posteRepository.GetEmpPoste(presence.Soccod, presence.Empcod, presence.Predat, presence.Catcod);
                if (string.IsNullOrEmpty(codpost))
                    codpost = presence.Codposte;
                var poste = await _posteRepository.GetPoste(presence.Soccod, codpost);

                if (poste == null) return (0, 0);

                AutDto? autorisation = await _autorisationRepository.GetAutLib(
                    presence.Soccod,
                    presence.Empcod,
                    presence.Dmdate.Value); // Safe to use .Value now

                return (
                    await _heureSuppService.CalculateHeureSupp(presence, poste),
                    (await _heureRetardService.CalculateHeureRetard(presence, poste, autorisation)).Item1
                );
            }
            catch (Exception ex)
            {
                throw new ApplicationException("Error calculating work metrics", ex);
            }
        }

        public async Task<double?> GetPreRepasAsync(string empcod, DateTime? predate)
        {
            try
            {
                double? prerepas = await _dbContext.Presences.Where(p => p.Empcod == empcod && p.Predat == predate).Select(p => p.Prerepas)
                    .SingleOrDefaultAsync();
                return prerepas;
            }
            catch (Exception)
            {
                throw;
            }
        }


        public async Task UpdateAsync(Presence entity)
        {
            _dbContext.Presences.Update(entity);
            await _dbContext.SaveChangesAsync();
        }

        public async Task UpdateAsync(PresenceDto presence)
        {
            try
            {
                if (presence != null)
                {
                    var empparam = await _employeRepository.GetEmpparam(presence.Soccod, presence.Empcod,(DateTime)presence.Predat,presence.Codposte);
                    string? codpost = await _posteRepository.GetEmpPoste(presence.Soccod, presence.Empcod, presence.Predat, presence.Catcod);
                    if (!string.IsNullOrEmpty(codpost))
                    {
                        presence.Codposte = codpost;
                    }
                    var poste = await _posteRepository.GetPoste(presence.Soccod, presence.Codposte);
                    // Calculs
                    var (nbHeurSupp, nbRetard) = await CalculateDayWorkMetrics(presence);
                    float? heuresNuit = await _heureNuitService.CalculateHeureNuit(presence);

                    presence.Totret = $"{nbRetard / 60:D2}:{nbRetard % 60:D2}";
                    presence.Tothre = await CalcHreTrav(presence,poste,empparam);

                    float? tothreInHours = GenericMethodes.ConvertHHmmToDouble(presence.Tothre);

                    int suppHours = (int)(nbHeurSupp / 60);
                    int suppMinutes = (int)(nbHeurSupp % 60);
                    presence.Tothsup = GenericMethodes.ConvertDoubleToHHmm((float)await _heureSuppService.CalculateHeureSuppOptimise(presence, poste));
                    TimeSpan nuitTimeSpan = TimeSpan.FromHours((double)heuresNuit);
                    presence.Tothnuit = $"{nuitTimeSpan.Hours:D2}:{nuitTimeSpan.Minutes:D2}";

                    if (tothreInHours == 0)
                        presence.Prerepas = 0;
                    AutDto? autorisation = await _autorisationRepository.GetAutLib(presence.Soccod, presence.Empcod, (DateTime) presence.Dmdate);
                    var pres = _mapper.Map<Presence>(presence);
                    presence.Tothabs = GenericMethodes.ConvertDoubleToHHmm(await _absenceService.CalculateHeureAbsences(pres, presence.Soccod, presence.Codposte, presence.Predat, autorisation, tothreInHours));
                    // ✅ Charger l'entité existante
                    var existingPresence = await _dbContext.Presences
                        .FirstOrDefaultAsync(p => p.Empcod == presence.Empcod
                                               && p.Predat == presence.Predat);
                    if (!string.IsNullOrEmpty(presence.Tothre) && presence.Totcmp.HasValue)
                    {
                        if (TimeSpan.TryParse(presence.Tothre, out TimeSpan tothreActuel))
                        {
                            var totalTime = tothreActuel.Add(TimeSpan.FromHours(presence.Totcmp.Value));
                            presence.Tothre = $"{(int)totalTime.TotalHours:D2}:{totalTime.Minutes:D2}";
                            presence.TotalHeure = GenericMethodes.ConvertHHmmToDouble(presence.Tothre);
                        }
                    }
                    if (existingPresence != null)
                    {
                        _mapper.Map(presence, existingPresence); // overwrites existingPresence in-place
                    }

                    await _dbContext.SaveChangesAsync();
                }
            }
            catch (Exception ex)
            {
                throw new Exception("Error updating presence record", ex);
            }
        }

        private TimeSpan? ParseSafe(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
                return null;
            return TimeSpan.Parse(value);
        }

        private async Task<string?> CalcHreTrav(PresenceDto presence,Poste poste,EmpparamPointageMois? empparam)
        {
            try
            {
                //var empparam = await _employeRepository.GetEmpparam(presence.Soccod, presence.Empcod);
                // 🔹 Étape 0 : Récupérer le paramètre d'arrondi
                var paramArrondi = await _parametreRepository.GetEtatPeriodiqueParamAsync(presence.Soccod);
                float arrondi = paramArrondi?.Arrondi ?? 0f; // en minutes

                // Étape 1 : Récupération des infos
                AutDto autorisation = await _autorisationRepository.GetAutLib(presence.Soccod, presence.Empcod, (DateTime)presence.Dmdate);
                if(poste == null)
                {
                    var codpost = await _posteRepository.GetEmpPoste(presence.Soccod, presence.Empcod, presence.Predat,presence.Catcod);
                    if (!string.IsNullOrEmpty(codpost))
                    {
                        presence.Codposte = codpost;
                        poste = await _posteRepository.GetPoste(presence.Soccod, codpost);
                    }
                }
                // ⚠ poste peut rester null si aucun poste n'est planifié pour la date/catégorie.
                // Dans ce cas on garde le presence.Codposte courant (peut venir de la fiche employé)
                // au lieu de NRE sur poste.Codposte. Tothre sera 00:00 et l'employé est traité
                // comme "hors planning" — c'est cohérent avec la branche `if (poste == null) return 0`
                // qu'on trouve dans HeureSuppService et HeureRetardService.
                if (poste != null)
                    presence.Codposte = poste.Codposte;
                float? totalPosteJourHeures = await _posteRepository.GetJourHeures(presence.Soccod, presence.Dmdate, presence.Codposte);
                var (nbHeurSupp, nbRetard) = await CalculateDayWorkMetrics(presence);

                // Heures de base (y compris autorisation via GetJourHeures si pas travaillées)
                float? totalHeure = totalPosteJourHeures;

                double hretrv = CalcNbHeure(presence.Preentmatup, presence.Presortmatup, presence.Preentamidiup,
                    presence.Presortamidiup, presence.Preentasupup, presence.Presortsupup, presence.Prerepas);
                hretrv += ((double)nbHeurSupp) /60f;
                // Étape 2 : Ajout heures d'autorisation si absence de présence — UNIQUEMENT si l'absence
                // est payée (Abspayer == "O"). Sinon les heures autorisées non travaillées ne s'ajoutent pas.
                if (autorisation?.Condep != null && autorisation?.Conret != null && autorisation.Abspayer == "O")
                {
                    var condep = autorisation.Condep.Value;
                    var conret = autorisation.Conret.Value;

                    // Création des périodes de présence
                    List<(TimeSpan start, TimeSpan end)> presencePeriods = new();

                    if (TimeSpan.TryParse(presence.Preentmatup, out var entMat) && TimeSpan.TryParse(presence.Presortmatup, out var sortMat))
                        presencePeriods.Add((entMat, sortMat));

                    if (TimeSpan.TryParse(presence.Preentamidiup, out var entPm) && TimeSpan.TryParse(presence.Presortamidiup, out var sortPm))
                        presencePeriods.Add((entPm, sortPm));

                    // Autorisation
                    var authStart = condep.TimeOfDay;
                    var authEnd = conret.TimeOfDay;
                    TimeSpan totalAutorisedNotWorked = TimeSpan.Zero;
                    var authPeriod = (start: authStart, end: authEnd);

                    foreach (var period in GetOverlappingPeriods(authPeriod, presencePeriods))
                    {
                        totalAutorisedNotWorked += period;
                    }

                    TimeSpan authTotal = authEnd - authStart;
                    TimeSpan authWorked = totalAutorisedNotWorked;
                    TimeSpan authNotWorked = authTotal - authWorked;
                    hretrv += (float)authNotWorked.TotalHours;
                }

                // 🔹 Étape 2.5 : Appliquer l'arrondi (EN MINUTES)
                if (arrondi > 0)
                {
                    // Convertir les heures en minutes
                    float totalMinutes = (float)hretrv * 60f;

                    // Arrondir au multiple supérieur
                    totalMinutes = (float)(Math.Floor(totalMinutes / arrondi) * arrondi);

                    // Reconvertir en heures
                    hretrv = totalMinutes / 60f;
                }
                // ✅ Convertir des heures (double) en TimeSpan
                TimeSpan totalHeureTimeSpan = TimeSpan.FromHours(hretrv);
                if(string.IsNullOrEmpty(presence.Tothre) || presence.Tothre == "00:00")
                    presence.Tothre = $"{totalHeureTimeSpan.Hours:D2}:{totalHeureTimeSpan.Minutes:D2}";

                    // Étape 4 : Contrôle des plafonds
                    EtatPresenceParametreDto param = await _parametreRepository.GetEtatPresenceParametresAsync(presence.Soccod);

                // ⚠ param peut être null si la société n'a aucun paramétrage EtatPresence
                // (cas typique : tenant fraîchement provisionné, ou société importée sans seed).
                // On saute alors le contrôle de plafond — pas de NRE sur param.Nbhtr3M.
                if (param != null &&
                    !string.IsNullOrEmpty(presence.Tothre) &&
                    TimeSpan.TryParse(presence.Tothre, out TimeSpan tothreTime) &&
                    param.Nbhtr3M.HasValue)
                {
                    float tothreDecimal = (float)tothreTime.TotalHours;

                    if (param.Nbhtr3M.Value != 0 && param.Tauxtr3M != 0 && param.Nbhtr3M.Value < tothreDecimal)
                    {
                        presence.Tothre = param.Tauxtr3M?.ToString("0.##");
                    }
                }
                var presenceobj = _mapper.Map<PresenceDto, Presence>(presence);
                presence.Tothre = GenericMethodes.ConvertDoubleToHHmm(GenericMethodes.CalculateHoursWithLimits(presenceobj, empparam));

                return presence.Tothre;
            }
            catch (Exception)
            {
                throw;
            }
        }
        private async Task<string?> CalcHreTravOpt(PresenceDto presence, Poste poste, EmpparamPointageMois? empparam)
        {
            try
            {
                //var empparam = await _employeRepository.GetEmpparam(presence.Soccod, presence.Empcod);
                // 🔹 Étape 0 : Récupérer le paramètre d'arrondi
                var paramArrondi = await _parametreRepository.GetEtatPeriodiqueParamAsync(presence.Soccod);
                float arrondi = paramArrondi?.Arrondi ?? 0f; // en minutes

                // Étape 1 : Récupération des infos
                AutDto autorisation = await _autorisationRepository.GetAutLib(presence.Soccod, presence.Empcod, (DateTime)presence.Dmdate);
                if (poste == null)
                {
                    var codpost = await _posteRepository.GetEmpPoste(presence.Soccod, presence.Empcod, presence.Predat,presence.Catcod);
                    if (!string.IsNullOrEmpty(codpost))
                    {
                        presence.Codposte = codpost;
                        poste = await _posteRepository.GetPoste(presence.Soccod, codpost);
                    }
                }
                // Cf. CalcHreTrav : on tolère poste == null (employé hors planning).
                if (poste != null)
                    presence.Codposte = poste.Codposte;
                float? totalPosteJourHeures = await _posteRepository.GetJourHeures(presence.Soccod, presence.Dmdate, presence.Codposte);
                var (nbHeurSupp, nbRetard) = await CalculateDayWorkMetrics(presence);

                // Heures de base (y compris autorisation via GetJourHeures si pas travaillées)
                float? totalHeure = totalPosteJourHeures;

                double hretrv = CalcNbHeure(presence.Preentmatup, presence.Presortmatup, presence.Preentamidiup,
                    presence.Presortamidiup, presence.Preentasupup, presence.Presortsupup, presence.Prerepas);
                hretrv += ((double)nbHeurSupp - nbRetard) / 60f;
                // Étape 2 : Ajout heures d'autorisation si absence de présence — UNIQUEMENT si l'absence
                // est payée (Abspayer == "O"). Sinon les heures autorisées non travaillées ne s'ajoutent pas.
                if (autorisation?.Condep != null && autorisation?.Conret != null && autorisation.Abspayer == "O")
                {
                    var condep = autorisation.Condep.Value;
                    var conret = autorisation.Conret.Value;

                    // Création des périodes de présence
                    List<(TimeSpan start, TimeSpan end)> presencePeriods = new();

                    if (TimeSpan.TryParse(presence.Preentmatup, out var entMat) && TimeSpan.TryParse(presence.Presortmatup, out var sortMat))
                        presencePeriods.Add((entMat, sortMat));

                    if (TimeSpan.TryParse(presence.Preentamidiup, out var entPm) && TimeSpan.TryParse(presence.Presortamidiup, out var sortPm))
                        presencePeriods.Add((entPm, sortPm));

                    // Autorisation
                    var authStart = condep.TimeOfDay;
                    var authEnd = conret.TimeOfDay;
                    TimeSpan totalAutorisedNotWorked = TimeSpan.Zero;
                    var authPeriod = (start: authStart, end: authEnd);

                    foreach (var period in GetOverlappingPeriods(authPeriod, presencePeriods))
                    {
                        totalAutorisedNotWorked += period;
                    }

                    TimeSpan authTotal = authEnd - authStart;
                    TimeSpan authWorked = totalAutorisedNotWorked;
                    TimeSpan authNotWorked = authTotal - authWorked;
                    hretrv += (float)authNotWorked.TotalHours;
                }

                // 🔹 Étape 2.5 : Appliquer l'arrondi (EN MINUTES)
                if (arrondi > 0)
                {
                    // Convertir les heures en minutes
                    float totalMinutes = (float)hretrv * 60f;

                    // Arrondir au multiple supérieur
                    totalMinutes = (float)(Math.Floor(totalMinutes / arrondi) * arrondi);

                    // Reconvertir en heures
                    hretrv = totalMinutes / 60f;
                }
                // ⚠ Plancher à 0 : un Tothre négatif (cas pathologique pointage incomplet où la
                // ligne `hretrv += (HS - Retard)/60` retranche plus que les heures travaillées)
                // se répercutait sur l'affichage (-00:02 / -03:56) et faussait HS qui dépend de
                // Tothre côté CalculateHeureSuppOptimise.
                if (hretrv < 0) hretrv = 0;
                // ✅ Convertir des heures (double) en TimeSpan
                TimeSpan totalHeureTimeSpan = TimeSpan.FromHours(hretrv);

                presence.Tothre = $"{totalHeureTimeSpan.Hours:D2}:{totalHeureTimeSpan.Minutes:D2}";

                // Étape 4 : Contrôle des plafonds
                EtatPresenceParametreDto param = await _parametreRepository.GetEtatPresenceParametresAsync(presence.Soccod);

                // Cf. CalcHreTrav : tolère param == null (tenant sans paramétrage EtatPresence).
                if (param != null &&
                    !string.IsNullOrEmpty(presence.Tothre) &&
                    TimeSpan.TryParse(presence.Tothre, out TimeSpan tothreTime) &&
                    param.Nbhtr3M.HasValue)
                {
                    float tothreDecimal = (float)tothreTime.TotalHours;

                    if (param.Nbhtr3M.Value != 0 && param.Tauxtr3M != 0 && param.Nbhtr3M.Value < tothreDecimal)
                    {
                        presence.Tothre = param.Tauxtr3M?.ToString("0.##");
                    }
                }
                var presenceobj = _mapper.Map<PresenceDto, Presence>(presence);
                presence.Tothre = GenericMethodes.ConvertDoubleToHHmm(GenericMethodes.CalculateHoursWithLimits(presenceobj, empparam));

                return presence.Tothre;
            }
            catch (Exception)
            {
                throw;
            }
        }

        private List<TimeSpan> GetOverlappingPeriods((TimeSpan start, TimeSpan end) basePeriod, List<(TimeSpan start, TimeSpan end)> workedPeriods)
        {
            List<TimeSpan> overlaps = new();

            foreach (var work in workedPeriods)
            {
                if (work.end <= basePeriod.start || work.start >= basePeriod.end)
                    continue;

                var overlapStart = work.start > basePeriod.start ? work.start : basePeriod.start;
                var overlapEnd = work.end < basePeriod.end ? work.end : basePeriod.end;

                overlaps.Add(overlapEnd - overlapStart);
            }

            return overlaps;
        }

        private double CalcNbHeure(string? ent1, string? sort1, string? ent2, string? sort2, string? ent3, string? sort3, float? repas)
        {
            try
            {

                // Parse the string inputs to TimeSpan or DateTime before performing subtraction  
                TimeSpan hours1 = TimeSpan.Zero;
                TimeSpan hours2 = TimeSpan.Zero;
                TimeSpan hours3 = TimeSpan.Zero;
                if (!string.IsNullOrEmpty(ent1) && !string.IsNullOrEmpty(sort1))
                {
                    hours1 = DateTime.Parse(sort1).TimeOfDay - DateTime.Parse(ent1).TimeOfDay;
                }

                if (!string.IsNullOrEmpty(ent2) && !string.IsNullOrEmpty(sort2))
                {
                    hours2 = DateTime.Parse(sort2).TimeOfDay - DateTime.Parse(ent2).TimeOfDay;
                }

                if (!string.IsNullOrEmpty(ent3) && !string.IsNullOrEmpty(sort3))
                {
                    hours3 = DateTime.Parse(sort3).TimeOfDay - DateTime.Parse(ent3).TimeOfDay;
                }
                // En État Périodique, le "Total Travaillé" = temps réellement passé entre
                // les pointages (matin + après-midi + heures supp). On NE DÉDUIT PLUS la
                // pause-déjeuner :
                //   - Si l'employé a 4 pointages (matin/AM séparés), le gap entre 12:00 et
                //     14:00 EST la pause et est déjà exclu de la somme.
                //   - Si l'employé a 1 plage continue, on lui affiche désormais le temps
                //     total de présence (9h pour 08:00→17:00), conforme à la demande
                //     produit : "ne diminuer pas les heures de repas des heures travaillées
                //     en état périodique".
                // Le paramètre `repas` reste sur la signature pour compatibilité avec les
                // appelants existants ; il est simplement ignoré.
                _ = repas;
                var res = hours1.TotalHours + hours2.TotalHours + hours3.TotalHours;
                if (res < 0)
                    res = 0;
                return res;
            }
            catch (Exception)
            {
                throw;
            }
        }
       // PresenceRepository.cs implementation example
        public async Task<Presence?> GetPresenceByEmployeeAndTimeAsync(string soccod, string empcode, DateTime time)
        {
            // Check if a presence record exists within a 1-minute window to avoid duplicates
            var timeWindow = TimeSpan.FromMinutes(1);
            var startTime = time.Subtract(timeWindow);
            var endTime = time.Add(timeWindow);

            return await _dbContext.Presences
                .FirstOrDefaultAsync(p =>
                    p.Soccod == soccod &&
                    p.Empcod == empcode &&
                    p.Predat >= startTime &&
                    p.Predat <= endTime);
        }
        public async Task<PresenceSemaineData> GetPresenceSemaineDataAsync(string soccod, string empcod, string mois, string annee, string semaine,string emppanier)
        {
            try
            {

                float? nbhFerierTrv = 0;
                int? nbNuits = 0;
                float? hreNuits = 0;
                float? retards = 0;
                float? hreabs = 0;
                float? nbhFerier = 0;
                float? hreRepos = 0;
                int? nbjourFerier = 0;
                float totalHours = 0;
                float? nbJours = 0;
                float? maladie = 0;
                int? nbJourPointer = 0;
                float? nbjourCng = 0;
                float? nbHreCng = 0;
                int nbJourRepos = 0;
                float? deplacement = 0;
                float? nbhAllaitement = 0;
                float? csf = 0;
                float? hcsf = 0;
                float? css = 0;
                float? map = 0;
                float? fm = 0;
                float? absnj = 0;
                float? absj = 0;
                float? absnp = 0;
                float? ct = 0;
                float? hct = 0;
                float? act = 0;
                int? panier = 0;
                float? joursameditrv = 0;
                float? hresameditrv = 0;
                IDictionary<string, string> weekDetails = new Dictionary<string, string>();

                // Validate input parameters
                if (string.IsNullOrEmpty(soccod) || string.IsNullOrEmpty(empcod) ||
                    string.IsNullOrEmpty(mois) || string.IsNullOrEmpty(annee))
                {
                    return null;
                }
                // Parse month and year
                if (!int.TryParse(mois, out int month) || !int.TryParse(annee, out int year))
                {
                    return null;
                }

                // Get the company's month configuration
                ParametreMoisPointageDto parametreMoisPointage = await _parametreRepository.GetParametreMoisPointageAsync(soccod);
                if (parametreMoisPointage == null)
                {
                    return null;
                }

                // Determine the actual start and end dates based on company parameters
                DateTime startDate, endDate;
                // If a specific week is requested (not "0" which means all weeks)
               
                // For the start date
                if (parametreMoisPointage.Moisdeb == "P") // Previous month
                {
                    var previousMonth = month == 1 ? 12 : month - 1;
                    var previousYear = month == 1 ? year - 1 : year;
                    startDate = new DateTime(previousYear, previousMonth, parametreMoisPointage.DebutCalc);
                }
                else // Current month
                {
                    startDate = new DateTime(year, month, parametreMoisPointage.DebutCalc);
                }

                // For the end date
                if (parametreMoisPointage.Moisfin == "P") // Previous month
                {
                    var previousMonth = month == 1 ? 12 : month - 1;
                    var previousYear = month == 1 ? year - 1 : year;
                    endDate = new DateTime(previousYear, previousMonth, int.Parse(parametreMoisPointage.Joufin));
                }
                else // Current month
                {
                    endDate = new DateTime(year, month, int.Parse(parametreMoisPointage.Joufin));
                }

                // Adjust for month boundaries (e.g., if day is 31 but month only has 30 days)
                startDate = AdjustDayToMonth(startDate);
                endDate = AdjustDayToMonth(endDate);

                // Filter by employee and date range
                var query = _dbContext.Presences
                    .Where(p => p.Soccod == soccod &&
                                p.Empcod == empcod &&
                                p.Predat >= startDate &&
                                p.Predat <= endDate);
                DateTime weekStart;
                DateTime weekEnd;
                if (semaine != "0" && int.TryParse(semaine, out int weekNumber) && weekNumber > 0)
                {
                    if (weekNumber == 1)
                    {
                        // First week: start from startDate, even if it's not Monday
                        weekStart = startDate;

                        // End on first Sunday or endDate
                        weekEnd = weekStart;
                        while (weekEnd.DayOfWeek != DayOfWeek.Sunday && weekEnd < endDate)
                        {
                            weekEnd = weekEnd.AddDays(1);
                        }

                        // Adjust endDate to this week's end to constrain the loop later
                        endDate = weekEnd;
                    }
                    else
                    {
                        // Find the (weekNumber - 1)th Sunday after startDate
                        int sundaysFound = 0;
                        DateTime currentDay = startDate;

                        while (sundaysFound < weekNumber - 1 && currentDay <= endDate)
                        {
                            if (currentDay.DayOfWeek == DayOfWeek.Sunday)
                            {
                                sundaysFound++;
                            }
                            currentDay = currentDay.AddDays(1);
                        }

                        // Set weekStart to next Monday
                        weekStart = currentDay;
                        while (weekStart.DayOfWeek != DayOfWeek.Monday && weekStart <= endDate)
                        {
                            weekStart = weekStart.AddDays(1);
                        }

                        // Set weekEnd to the following Sunday or endDate
                        weekEnd = weekStart;
                        while (weekEnd.DayOfWeek != DayOfWeek.Sunday && weekEnd < endDate)
                        {
                            weekEnd = weekEnd.AddDays(1);
                        }
                    }

                    // Cap weekEnd within the overall endDate range
                    weekEnd = weekEnd > endDate ? endDate : weekEnd;

                    // Filter presence records in that week
                    if (weekStart <= endDate && weekEnd >= startDate && weekStart <= weekEnd)
                    {
                        query = query.Where(p => p.Predat >= weekStart && p.Predat <= weekEnd);
                    }
                    else
                    {
                        query = query.Where(p => false); // Week outside of period
                    }
                    endDate = weekEnd;
                    startDate = weekStart;
                }

                // Step 1: Generate all dates in the selected period
                List<DateTime> allDates = new List<DateTime>();
                DateTime day = startDate;
                while (day <= endDate)
                {
                    allDates.Add(day);
                    day = day.AddDays(1);
                }

                // Step 2: Load all relevant presence records
                var presences = await query.ToListAsync();
                var presencesByDate = presences
                    .Where(p => p.Predat.HasValue)
                    .ToDictionary(p => p.Predat.Value.Date);
                // Step 3: Iterate over all days, with or without presence
                foreach (var date in allDates)
                {
                    AutDto autorisation = await _autorisationRepository.GetAutLib(soccod, empcod, date);
                    IDictionary<string, bool> countedSanction = new Dictionary<string, bool>();
                    //presencesByDate.TryGetValue(date.Date, out var presence); // May be null
                    if(date != null && presencesByDate.TryGetValue(date.Date,out var presence))
                    {
                        weekDetails.Add(date.ToString(), GetWeekDetails(presence, date));
                        // Do all your processing, even if `presence` is null
                        // For example, check sanctions:
                        SanctionDto? sanction = await _sanctionRepository.GetAbsenceAsync(soccod, empcod, date);
                        if (sanction != null)
                        {
                            if (sanction.Abspaye == "N")
                                absnp += sanction.Connbjour;
                            if (sanction.Abscng == "6")
                            {
                                deplacement = sanction.Connbjour;
                                fm = sanction.Connbjour;
                            }
                            if (sanction.Abscng == "1")
                            {
                                csf = sanction.Connbjour;
                                if (parametreMoisPointage.Nbhconge != 0)
                                    hcsf += parametreMoisPointage.Nbhconge;
                            }
                            if (sanction.Abscng == "5")
                                css = sanction.Connbjour;
                            if (sanction.Abscng == "4")
                                map = sanction.Connbjour;
                            if (sanction.Abscng == "3")
                                absnj = sanction.Connbjour;
                            if (sanction.Abscng == "2")
                                absj = sanction.Connbjour;
                            if (sanction.Abscng == "8")
                                act = sanction.Connbjour;
                            if (sanction.Abscng == "9" && sanction.Abslib.ToLower() == "maladie")
                                maladie = sanction.Connbjour;
                            if (sanction.Abscng == "A")
                            {
                                ct = sanction.Connbjour;
                            }
                            if (!string.IsNullOrEmpty(sanction?.Concod))
                            {
                                if (!countedSanction.TryGetValue(sanction.Concod, out bool isSanctionCounted))
                                {
                                    if (sanction.Abspaye == "N")
                                        nbJours -= sanction.Connbjour;

                                    countedSanction.Add(sanction.Concod, true);
                                }
                            }

                        }

                        IDictionary<string, bool> countedConge = new Dictionary<string, bool>();
                        if (((GenericMethodes.NotPresent(presence) || !GenericMethodes.IsValid(presence)) && sanction == null))
                        {
                            string? poste = await _employeRepository.GetEmpPoste(soccod, empcod, date);
                            var (isRepos, emprepos) = await _parametreRepository.IsEmpcodReposAsync(soccod, date, poste, empcod);
                            string conge = await _congeRepository.GetCongeLibAsync(soccod, empcod, date);
                            if (!isRepos && string.IsNullOrEmpty(conge))
                            {
                                var res = await _absenceService.CalculateHeureAbsences(presence, soccod, poste, date,autorisation,GenericMethodes.ConvertHHmmToDouble(presence.Tothre));
                                if (!GenericMethodes.IsValid(presence) || (GenericMethodes.NotPresent(presence)))
                                {
                                    hreabs += res;
                                    absnp++;
                                    absnj++;
                                }

                            }
                            if (!string.IsNullOrEmpty(conge))
                            {
                                string? codpost = await _employeRepository.GetEmpPoste(soccod, empcod, date);
                                NombreConge nombreConge = await _congeCalculationService
                                    .CalculerNbJourAndHreCongePaye(soccod, empcod, date, codpost);
                                if (!string.IsNullOrEmpty(sanction?.Concod))
                                {
                                    if (nombreConge.Concod != null && !countedConge.TryGetValue(nombreConge?.Concod, out bool isCongeCounted) && nombreConge?.nbJourConge != 0)
                                    {
                                        nbjourCng += nombreConge?.nbJourConge;
                                        if (parametreMoisPointage.Nbhconge != 0)
                                            nbHreCng += parametreMoisPointage.Nbhconge;
                                        else
                                            nbHreCng += nombreConge?.nbHeureConge;
                                        nbJours -= nombreConge?.nbJourConge;
                                        countedConge.Add(nombreConge.Concod, true);
                                    }
                                }
                                                                
                            }

                            bool isFerier = await _jourFerierRepository.IsFerier(soccod, date);
                            if (isFerier)
                            {
                                var codpost = await _employeRepository.GetEmpPoste(soccod, empcod, date);
                                var hreJour = await _posteRepository.GetJourHeures(soccod, date, codpost);
                                nbhFerier += hreJour;
                            }
                        }


                        // If there's a presence record, process it
                        if (presence != null)
                        {
                                // ... ton code existant pour les sanctions, congés, fériés, etc. ...

                                bool isFerier = await _jourFerierRepository.IsFerier(soccod, date);
                                string? conge = await _congeRepository.GetCongeLibAsync(soccod, empcod, date);

                                // Calcul du panier uniquement si ce n'est ni congé ni férié
                                if (!isFerier && string.IsNullOrEmpty(conge))
                                {
                                        float nbHeuresJour = 0;

                                        if (!string.IsNullOrEmpty(presence.Tothre) && TimeSpan.TryParseExact(presence.Tothre, "hh\\:mm", null, out TimeSpan h))
                                        {
                                            nbHeuresJour = (float)h.TotalHours;
                                        }
                                        DateTime startMonthReal;
                                        if(month == 1)
                                            startMonthReal = new DateTime(year, 12, parametreMoisPointage.DebutReel);
                                        else
                                            startMonthReal = new DateTime(year, month - 1, parametreMoisPointage.DebutReel);
                                        if (startMonthReal <= presence.Dmdate)
                                        {
                                             if (emppanier == "1" && nbHeuresJour >= 7) panier++;
                                             if (emppanier == "2" && nbHeuresJour >= 6) panier++;
                                        }
                                        var codpost = await _posteRepository.GetEmpPoste(soccod, empcod, date, presence.Catcod);
                                        var (isrepos, emprepos) = await _parametreRepository.IsEmpcodReposAsync(soccod, date, codpost, empcod); 
                                        if(presence.Predat.Value.DayOfWeek == DayOfWeek.Saturday && GenericMethodes.ConvertHHmmToDouble(presence.Tothre)>0 && isrepos)
                                            {
                                              joursameditrv++;
                                              hresameditrv += GenericMethodes.ConvertHHmmToDouble(presence.Tothre);
                                            }
                                }
                            ParametreNuitDto parametreNuit = await _parametreRepository.GetParametresNuitAsync(soccod);
                            TimeSpan? heureDebutNuit = TimeSpan.TryParse(parametreNuit.Nuitdeb, out var debut) ? debut : null;
                            TimeSpan? heureFinNuit = TimeSpan.TryParse(parametreNuit.Nuitfin, out var fin) ? fin : null;
                            if (heureDebutNuit.HasValue && heureFinNuit.HasValue)
                            {
                                TimeSpan? heureEntree = TimeSpan.TryParse(presence.Preentmatup, out var ent) ? ent :
                                 TimeSpan.TryParse(presence.Preentamidiup, out var ent2) ? ent2 : null;

                                TimeSpan? heureSortie = TimeSpan.TryParse(presence.Presortamidiup, out var sort) ? sort :
                                                         TimeSpan.TryParse(presence.Presortmatup, out var sort2) ? sort2 : null;
                                if (heureDebutNuit.HasValue && heureFinNuit.HasValue && heureEntree.HasValue && heureSortie.HasValue)
                                {
                                    DateTime dateDebut = date.Date;
                                    DateTime entree = dateDebut.Add(heureEntree.Value);
                                    DateTime sortie = dateDebut.Add(heureSortie.Value);

                                    DateTime debutNuit = dateDebut.Add(heureDebutNuit.Value);
                                    DateTime finNuit = heureFinNuit > heureDebutNuit
                                        ? dateDebut.Add(heureFinNuit.Value)
                                        : dateDebut.AddDays(1).Add(heureFinNuit.Value); // nuit qui passe minuit

                                    // Ajuster si la sortie est après minuit
                                    if (sortie < entree)
                                        sortie = sortie.AddDays(1);

                                    // Calcul de l’intersection
                                    DateTime overlapStart = entree > debutNuit ? entree : debutNuit;
                                    DateTime overlapEnd = sortie < finNuit ? sortie : finNuit;

                                    if (overlapEnd > overlapStart)
                                    {
                                        var heuresNuit = (float)(overlapEnd - overlapStart).TotalHours;
                                        hreNuits += heuresNuit;
                                        nbNuits++;
                                    }
                                }

                            }
                            if (presence.Prerepos == "0" && !string.IsNullOrWhiteSpace(presence.Codposte))
                            {
                                var poste = await _posteRepository.GetPoste(soccod, presence.Codposte);
                                var presencedto = _mapper.Map<Presence, PresenceDto>(presence);
                                var retard = await _retardService.CalculateHeureRetard(presencedto, poste, autorisation);
                                retards += retard.Item1;
                            }
                            if (GenericMethodes.IsValid(presence) && !GenericMethodes.NotPresent(presence))
                                nbJourPointer++;
                            NombreConge nombreConge = await _congeCalculationService
                              .CalculerNbJourAndHreCongePaye(soccod, empcod, presence?.Predat, presence?.Codposte);
                            if (nombreConge.Concod != null && !countedConge.TryGetValue(nombreConge?.Concod, out bool isCongeCounted) && nombreConge?.nbJourConge != 0)
                            {
                                nbjourCng += nombreConge?.nbJourConge;
                                if (parametreMoisPointage.Nbhconge != 0)
                                    nbHreCng += parametreMoisPointage.Nbhconge;
                                else
                                    nbHreCng += nombreConge?.nbHeureConge;
                                nbJours -= nombreConge?.nbJourConge;
                                countedConge.Add(nombreConge.Concod, true);
                            }

                            if (sanction?.Connbjour != 0 && nombreConge?.nbJourConge != 0 && !string.IsNullOrEmpty(presence?.Tothre) || presence?.Tothre == "00:00")
                                nbJours++;
                            nbhAllaitement += await _allaitementRepository.GetNbhAllaitementAsync(soccod, empcod, date);
                            if (!string.IsNullOrEmpty(presence.Tothre) && TimeSpan.TryParseExact(presence.Tothre, "hh\\:mm", null, out TimeSpan hours))
                            {
                                var hreFerierTrav = await _jourFerierRepository.GetHeureFerieTrav(soccod, presence.Predat, presence.Tothre);

                                nbhFerierTrv += hreFerierTrav;
                                if (hreFerierTrav != 0)
                                {
                                    var hreJour = await _posteRepository.GetJourHeures(soccod, date, presence.Codposte);
                                    nbjourFerier++;
                                    nbJours--;
                                    nbhFerier += hreJour;
                                }

                                totalHours += (float)hours.TotalHours;
                                if (presence.Prerepos == "1")
                                {
                                    var effectivePoste = await _posteRepository.GetEmpPoste(soccod, empcod, date, presence.Catcod);
                                    if (!string.IsNullOrEmpty(effectivePoste))
                                        presence.Codposte = effectivePoste;
                                    var (isrepos, emprepos) = await _parametreRepository.IsEmpcodReposAsync(soccod,date,presence.Codposte,empcod);
                                    if (isrepos)
                                    {
                                        hreRepos += (float)hours.TotalHours;
                                        nbJourRepos++;
                                    }
                                }
                            }
                        }
                    }
                }
                if (nbJours < 0) nbJours = 0;
                return new PresenceSemaineData {
                    NbJourConge = nbjourCng, NbHeureConge = nbHreCng, NbJourPointer = nbJourPointer, NbJourFerier = nbjourFerier,NbJourCngPaye = nbjourCng,
                    NbhFerierTrv = nbhFerierTrv,HreFerier = nbhFerier,NbhAllaitement = nbhAllaitement, TotalHours = totalHours ,HeureRepos = hreRepos,
                    JourRepos = nbJourRepos,Deplacement = deplacement,NbJours = nbJours,CSF = csf,HCSF = hcsf,Maladie = maladie,CSS = css,MAP = map,
                    FM = fm,Absnj = absnj,Absj = absj,CT = ct,ACT = act,Absnp = absnp,WeekDetails = weekDetails,TotalRetards = retards,
                    NbNuits = nbNuits,HreNuits = hreNuits, TotalAbsence = hreabs,Panier = panier,HreSamediTrv = hresameditrv,JourSamediTrv = joursameditrv
                };

            }
            catch (Exception)
            {
                throw;
            }
        }

        private string GetWeekDetails(Presence presence, DateTime date)
        {
            try
            {
                if (presence != null)
                    return presence.Tothre;
                else
                    return  "_";  
            }
            catch (Exception)
            {
                throw;
            }
        }
        // Helper method to adjust day to fit within month boundaries
        private DateTime AdjustDayToMonth(DateTime date)
        {
            // If the day exceeds the number of days in the month, use the last day of the month
            int daysInMonth = DateTime.DaysInMonth(date.Year, date.Month);
            return date.Day > daysInMonth ? new DateTime(date.Year, date.Month, daysInMonth) : date;
        }

        public async Task<PresenceStatistics> GetStatisticsAsync(DateTime startDate, DateTime endDate)
        {
            var presences = await _dbContext.Presences
                .Where(p => p.Predat >= startDate && p.Predat <= endDate)
                .ToListAsync();

            var totalEmployees = presences.Select(p => p.Empcod).Distinct().Count();
            var today = DateTime.Today;
            var todayPresences = presences.Where(p => p.Predat.Value.Date == today).ToList();

            return new PresenceStatistics
            {
                TotalEmployees = totalEmployees,
                PresentToday = todayPresences.Count(p => p.Preentmatup != null),
                AbsentToday = todayPresences.Count(p => p.Preentmatup == null),
                TotalRetards = presences.Count(p => !string.IsNullOrEmpty(p.Preentmatup)),
                AttendanceRate = totalEmployees > 0
                    ? (decimal)todayPresences.Count(p => p.Preentmatup != null) / totalEmployees * 100
                    : 0
            };
        }

        public async Task<List<AbsenceInfo>> GetRecentAbsencesAsync(DateTime startDate, DateTime endDate, int limit)
        {
            return await _dbContext.Presences
                .Where(p => p.Predat >= startDate && p.Predat <= endDate && p.Preentmatup == null)
                .OrderByDescending(p => p.Predat)
                .Take(limit)
                .Select(p => new AbsenceInfo
                {
                    EmployeeName = p.Empcod,
                    Date = p.Predat.Value.Date,
                    Motif = p.Empreg ?? "Non spécifié"
                })
                .ToListAsync();
        }

        public async Task<GlobalStatistics> GetGlobalStatisticsAsync()
        {
            var totalEmployees = await _dbContext.Employes.CountAsync();
            var thisMonth = DateTime.Today.Month;
            var thisYear = DateTime.Today.Year;

            var monthlyPresences = await _dbContext.Presences
                .Where(p => p.Predat.Value.Month == thisMonth && p.Predat.Value.Year == thisYear)
                .ToListAsync();

            var totalHours = 20;
            //var totalHours = monthlyPresences.Sum(p => p.Tothre ?? 0);
            var workDays = DateTime.DaysInMonth(thisYear, thisMonth);
            var expectedPresences = totalEmployees * workDays;
            var actualPresences = monthlyPresences.Count(p => p.Preentmatup != null);

            return new GlobalStatistics
            {
                TotalEmployees = totalEmployees,
                AverageMonthlyAttendance = expectedPresences > 0
                    ? (decimal)actualPresences / expectedPresences * 100
                    : 0,
                TotalHoursThisMonth = totalHours
            };
        }

        public async Task<bool> UpdateTotcmpAsync(string soccod, string empcod, DateTime date, float totcmp)
        {
            try
            {
                var presence = await _dbContext.Presences
                    .Where(p => p.Soccod == soccod && p.Empcod == empcod && p.Dmdate == date)
                    .FirstOrDefaultAsync();
                if (presence != null)
                {
                    presence.Totcmp = totcmp;
                    await _dbContext.SaveChangesAsync();
                }
                return true;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<List<DailyPointageDto>> GetDailyPointageAsync(string soccod, DateTime date)
        {
            try
            {
                // 1. Get all active employees for this company
                var employees = await _dbContext.Employes
                    .Where(e => e.Soccod == soccod && (e.Empsort == null || e.Empsort > date))
                    .Select(e => new { e.Empcod, e.Emplib, e.Empmat, e.Poscod, e.Catcod })
                    .ToListAsync();

                var empCodes = employees.Select(e => e.Empcod).ToList();

                // 2. Get existing presences for today
                var presences = await _dbContext.Presences
                    .Where(p => p.Soccod == soccod && p.Predat.Value.Date == date.Date && empCodes.Contains(p.Empcod))
                    .ToDictionaryAsync(p => p.Empcod);

                // 3. Get conges for today
                var conges = await _dbContext.Conges
                    .Where(c => c.Soccod == soccod && empCodes.Contains(c.Empcod)
                        && c.Condep <= date && c.Conret >= date
                        && (c.Condg != "0" && c.Condg != null && c.Condg != ""))
                    .Select(c => new { c.Empcod, c.Abscod })
                    .ToListAsync();
                var congeDict = conges.GroupBy(c => c.Empcod).ToDictionary(g => g.Key, g => g.First().Abscod ?? "Congé");

                // 4. Get feriers
                var ferier = await _dbContext.Feriers
                    .FirstOrDefaultAsync(f => f.Soccod == soccod && f.Ferdate.Value.Date == date.Date);

                // 5. Get postes cache
                var posteCodes = employees.Where(e => !string.IsNullOrEmpty(e.Poscod)).Select(e => e.Poscod).Distinct().ToList();
                var postes = await _dbContext.Postes
                    .Where(p => p.Soccod == soccod && posteCodes.Contains(p.Codposte))
                    .ToDictionaryAsync(p => p.Codposte);

                // 6. Get planhoraire for today
                var plans = await _dbContext.Set<Planhoraire>()
                    .Where(p => p.Soccod == soccod && p.Plandate.Value.Date == date.Date && empCodes.Contains(p.Empcod))
                    .ToDictionaryAsync(p => p.Empcod);

                var result = new List<DailyPointageDto>();

                foreach (var emp in employees)
                {
                    string? codposte = await _posteRepository.GetEmpPoste(soccod, emp.Empcod, date, emp.Catcod);
                    if (string.IsNullOrEmpty(codposte))
                        codposte = emp.Poscod;
                    if (string.IsNullOrEmpty(codposte) && plans.TryGetValue(emp.Empcod, out var plan))
                        codposte = plan.Planposte;

                    postes.TryGetValue(codposte ?? "", out var poste);
                    string poslib = poste?.Libposte ?? codposte ?? "";

                    bool isRepos = false;
                    if (!string.IsNullOrEmpty(codposte))
                    {
                        var (isPreRepos, emprepos) = await _parametreRepository.IsEmpcodReposAsync(soccod, date, codposte, emp.Empcod);
                        if (!isPreRepos)
                            isRepos = await _parametreRepository.IsReposAsync(soccod, date, codposte);
                        else
                            isRepos = isPreRepos;
                    }

                    bool hasConge = congeDict.ContainsKey(emp.Empcod);
                    bool isFerie = ferier != null;
                    bool hasPresence = presences.TryGetValue(emp.Empcod, out var presence);

                    string status;
                    string motif = "";
                    bool isExpected = true;

                    if (isFerie)
                    {
                        status = "ferie";
                        motif = ferier.Fermotif ?? "Jour férié";
                        isExpected = false;
                    }
                    else if (isRepos)
                    {
                        status = "repos";
                        motif = "Jour de repos";
                        isExpected = false;
                    }
                    else if (hasConge)
                    {
                        status = "conge";
                        motif = congeDict[emp.Empcod] ?? "Congé";
                        isExpected = false;
                    }
                    else if (hasPresence && presence != null)
                    {
                        bool hasEntry = !string.IsNullOrEmpty(presence.Preentmatup);
                        bool hasExit = !string.IsNullOrEmpty(presence.Presortmatup) || !string.IsNullOrEmpty(presence.Presortamidiup);
                        status = hasExit ? "present" : "en_cours";
                    }
                    else
                    {
                        status = "absent";
                        motif = "Absent";
                    }

                    result.Add(new DailyPointageDto
                    {
                        Empcod = emp.Empcod,
                        Emplib = emp.Emplib ?? "",
                        Empmat = emp.Empmat ?? "",
                        Codposte = codposte ?? "",
                        Poslib = poslib,
                        Entree1 = hasPresence && presence?.Preentmatup != null ? presence.Preentmatup : "",
                        Sortie1 = hasPresence && presence?.Presortmatup != null ? presence.Presortmatup : "",
                        Entree2 = hasPresence && presence?.Preentamidiup != null ? presence.Preentamidiup : "",
                        Sortie2 = hasPresence && presence?.Presortamidiup != null ? presence.Presortamidiup : "",
                        TotalHeure = hasPresence ? presence.Tothre ?? "" : "",
                        Status = status,
                        Motif = motif,
                        IsExpected = isExpected
                    });
                }

                return result.OrderBy(r => r.Emplib).ToList();
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<EntryReminderDto> GetEntryReminderAsync(string soccod, string empcod)
        {
            try
            {
                var today = DateTime.Today;
                string formattedEmpcod = await FormatEmpcodCached(soccod, empcod);
                var emp = await _employeRepository.GetByEmpcod(soccod, formattedEmpcod);

                if (emp == null)
                    return new EntryReminderDto { ShouldRemind = false, Message = "Employé introuvable", Poste = "", HasMarkedEntry = false, IsConge = false, IsFerie = false, IsRepos = false };

                string? codposte = await _posteRepository.GetEmpPoste(soccod, formattedEmpcod, today, emp.Catcod);
                if (string.IsNullOrEmpty(codposte))
                    codposte = emp.Poscod;

                var poste = await _posteRepository.GetPoste(soccod, codposte);
                string poslib = poste?.Libposte ?? codposte ?? "";

                // Check repos
                bool isRepos = false;
                if (!string.IsNullOrEmpty(codposte))
                {
                    var (isPreRepos, _) = await _parametreRepository.IsEmpcodReposAsync(soccod, today, codposte, formattedEmpcod);
                    if (!isPreRepos)
                        isRepos = await _parametreRepository.IsReposAsync(soccod, today, codposte);
                    else
                        isRepos = isPreRepos;
                }

                // Check ferier
                var ferier = await _dbContext.Feriers
                    .FirstOrDefaultAsync(f => f.Soccod == soccod && f.Ferdate.Value.Date == today.Date);
                bool isFerie = ferier != null;

                // Check conge
                bool hasConge = await _dbContext.Conges
                    .AnyAsync(c => c.Soccod == soccod && c.Empcod == formattedEmpcod
                        && c.Condep <= today && c.Conret >= today
                        && (c.Condg != "0" && c.Condg != null && c.Condg != ""));

                // Check if already marked entry
                var presence = await _dbContext.Presences
                    .FirstOrDefaultAsync(p => p.Soccod == soccod && p.Empcod == formattedEmpcod
                        && p.Predat.Value.Date == today.Date);
                bool hasMarkedEntry = presence != null && !string.IsNullOrEmpty(presence.Preentmatup);

                // Get expected entry time from poste
                string heureEntree = null;
                if (poste != null)
                {
                    var dayOfWeek = today.DayOfWeek;
                    heureEntree = dayOfWeek switch
                    {
                        DayOfWeek.Monday => poste.Lunhdmat,
                        DayOfWeek.Tuesday => poste.Marhdmat,
                        DayOfWeek.Wednesday => poste.Merhdmat,
                        DayOfWeek.Thursday => poste.Jeuhdmat,
                        DayOfWeek.Friday => poste.Venhdmat,
                        DayOfWeek.Saturday => poste.Samhdmat,
                        DayOfWeek.Sunday => poste.Dimhdmat,
                        _ => null
                    };
                }

                bool shouldRemind = !isRepos && !isFerie && !hasConge && !hasMarkedEntry;

                string message = "";
                if (hasMarkedEntry)
                    message = "Vous avez déjà pointé votre entrée.";
                else if (isFerie)
                    message = $"Aujourd'hui est un jour férié ({ferier?.Fermotif}).";
                else if (isRepos)
                    message = "Aujourd'hui est votre jour de repos.";
                else if (hasConge)
                    message = "Vous êtes en congé aujourd'hui.";
                else if (!string.IsNullOrEmpty(heureEntree))
                    message = $"N'oubliez pas de pointer votre entrée. Heure prévue: {heureEntree}";
                else
                    message = "N'oubliez pas de pointer votre entrée.";

                return new EntryReminderDto
                {
                    ShouldRemind = shouldRemind,
                    Poste = poslib,
                    HeureEntree = heureEntree,
                    HasMarkedEntry = hasMarkedEntry,
                    IsRepos = isRepos,
                    IsConge = hasConge,
                    IsFerie = isFerie,
                    Message = message
                };
            }
            catch (Exception)
            {
                throw;
            }
        }

        // ── Selon pointage : choix du poste à l'instant du pointage ──────────────
        // Une classe horaire de type 'S' (Categorie.Catperiode) regroupe plusieurs
        // postes coexistant dans la même période (Lcategorie.Codposte + Categorie.
        // Catsem2..Catsem6). À chaque pointage on doit déterminer lequel correspond
        // à l'horaire réel de l'employé en se basant sur les plages de tolérance du
        // jour de la semaine de chaque poste candidat.
        private async Task<string?> ResolveSelonPointagePosteAsync(
            string soccod, string? catcod, DateTime punchAt)
        {
            if (string.IsNullOrEmpty(catcod)) return null;

            var categorie = await _dbContext.Categories
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.Soccod == soccod && c.Catcod == catcod);

            // Classe « Périodique » → un seul poste pour la période, pas de reroutage.
            if (categorie?.Catperiode != "S") return null;

            var dateOnly = punchAt.Date;

            // Lcategorie active à la date — porte le poste principal de la période.
            var lcat = await _dbContext.Lcategories
                .AsNoTracking()
                .Where(l => l.Soccod == soccod && l.Catcod == catcod
                         && l.Catdu.HasValue && l.Catau.HasValue
                         && l.Catdu.Value <= dateOnly && l.Catau.Value >= dateOnly)
                .OrderByDescending(l => l.Catdu)
                .FirstOrDefaultAsync();

            var candidates = new List<string>();
            if (!string.IsNullOrEmpty(lcat?.Codposte)) candidates.Add(lcat.Codposte!);
            foreach (var extra in new[]
            {
                categorie.Catsem2, categorie.Catsem3, categorie.Catsem4,
                categorie.Catsem5, categorie.Catsem6,
            })
            {
                if (!string.IsNullOrEmpty(extra) && !candidates.Contains(extra))
                    candidates.Add(extra!);
            }
            if (candidates.Count == 0) return null;

            var postes = await _dbContext.Postes
                .AsNoTracking()
                .Where(p => p.Soccod == soccod && candidates.Contains(p.Codposte))
                .ToListAsync();
            if (postes.Count == 0) return null;

            var punchTime = punchAt.TimeOfDay;

            // 1) Match strict par plage de tolérance matin OU après-midi.
            foreach (var p in postes)
            {
                var (mDeb, mFin, aDeb, aFin) = GetSelonPointageTolerancePlages(dateOnly, p);
                if (mDeb.HasValue && mFin.HasValue && punchTime >= mDeb.Value && punchTime <= mFin.Value)
                    return p.Codposte;
                if (aDeb.HasValue && aFin.HasValue && punchTime >= aDeb.Value && punchTime <= aFin.Value)
                    return p.Codposte;
            }

            // 2) Repli : poste candidat dont l'heure d'entrée prévue (matin sinon
            //    après-midi) est la plus proche de l'instant du pointage.
            Poste? closest = null;
            double minDiffMinutes = double.MaxValue;
            foreach (var p in postes)
            {
                var (mStart, _, eStart, _) = GenericMethodes.GetStartsWorkDay(dateOnly, p);
                TimeSpan? entry = null;
                if (!string.IsNullOrEmpty(mStart) && TimeSpan.TryParse(mStart, out var ms)) entry = ms;
                else if (!string.IsNullOrEmpty(eStart) && TimeSpan.TryParse(eStart, out var es)) entry = es;
                if (!entry.HasValue) continue;

                var diff = Math.Abs((punchTime - entry.Value).TotalMinutes);
                if (diff < minDiffMinutes)
                {
                    minDiffMinutes = diff;
                    closest = p;
                }
            }
            return closest?.Codposte;
        }

        private static (TimeSpan? mDeb, TimeSpan? mFin, TimeSpan? aDeb, TimeSpan? aFin)
            GetSelonPointageTolerancePlages(DateTime date, Poste poste)
        {
            string? mDebRaw = null, mFinRaw = null, aDebRaw = null, aFinRaw = null;
            switch (date.DayOfWeek)
            {
                case DayOfWeek.Monday:    mDebRaw = poste.Lunhdematin; mFinRaw = poste.Lunhfematin; aDebRaw = poste.Lunhdeamidi; aFinRaw = poste.Lunhfeamidi; break;
                case DayOfWeek.Tuesday:   mDebRaw = poste.Marhdematin; mFinRaw = poste.Marhfematin; aDebRaw = poste.Marhdeamidi; aFinRaw = poste.Marhfeamidi; break;
                case DayOfWeek.Wednesday: mDebRaw = poste.Merhdematin; mFinRaw = poste.Merhfematin; aDebRaw = poste.Merhdeamidi; aFinRaw = poste.Merhfeamidi; break;
                case DayOfWeek.Thursday:  mDebRaw = poste.Jeuhdematin; mFinRaw = poste.Jeuhfematin; aDebRaw = poste.Jeuhdeamidi; aFinRaw = poste.Jeuhfeamidi; break;
                case DayOfWeek.Friday:    mDebRaw = poste.Venhdematin; mFinRaw = poste.Venhfematin; aDebRaw = poste.Venhdeamidi; aFinRaw = poste.Venhfeamidi; break;
                case DayOfWeek.Saturday:  mDebRaw = poste.Samhdematin; mFinRaw = poste.Samhfematin; aDebRaw = poste.Samhdeamidi; aFinRaw = poste.Samhfeamidi; break;
                case DayOfWeek.Sunday:    mDebRaw = poste.Dimhdematin; mFinRaw = poste.Dimhfematin; aDebRaw = poste.Dimhdeamidi; aFinRaw = poste.Dimhfeamidi; break;
            }
            static TimeSpan? Parse(string? s) =>
                !string.IsNullOrEmpty(s) && TimeSpan.TryParse(s, out var t) ? t : (TimeSpan?)null;
            return (Parse(mDebRaw), Parse(mFinRaw), Parse(aDebRaw), Parse(aFinRaw));
        }
    }
}
